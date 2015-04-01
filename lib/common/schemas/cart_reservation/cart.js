"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID
  , Inventory = require('./inventory')
  , Order = require('./order');

var clone = function(obj) {
  var o = {};
  for(var name in obj) o[name] = obj[name];
  return o;
}

var Cart = function(collections, id) {  
  this.id = id == null ? new ObjectID() : id;
  this.collections = collections;
  this.products = [];
  this.carts = collections['carts'];
}

Cart.ACTIVE = 'active';
Cart.EXPIRED = 'expired';
Cart.COMPLETED = 'completed';
Cart.CANCELED = 'canceled';

/*
 * Create a new cart instance and save it to mongodb
 */
Cart.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  options = clone(options);
  options.upsert = true;

  this.carts.updateOne({
      _id: this.id, 
    }, {
        state: Cart.ACTIVE
      , modified_on: new Date()
      , products: []
    }, options, function(err, r) {
      if(err) return callback(err);
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);
      callback(null, self);
    });
}

var rollback = function(cart, product, quantity, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  cart.carts.updateOne({
    _id: cart.id, state: Cart.ACTIVE, 'products._id': product.id
  }, {
    $pull: { products: { _id: product.id } }
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    callback(new Error(f("failed to reserve the quantity %s of product %s for cart %s", quantity, product.id, cart.id)))
  });
}

/*
 * Add product and quantity to cart if available in inventory
 */
Cart.prototype.add = function(product, quantity, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  options = clone(options);
  options.upsert = true;

  // Add product to cart, and create cart with upsert
  // if it does not already exist
  this.carts.updateOne({
    _id: self.id, state: Cart.ACTIVE
  }, {
      $set: { modified_on: new Date() }
    , $push: {
      products: {
          _id: product.id
        , quantity: quantity
        , name: product.name
        , price: product.price
      }
    }
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f("failed to add product %s to the cart with id %s", product.id, self.id)))
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);

    // Next update the inventory, if there is enough
    // quantity available, push the cart information to the
    // list of reservations product quantities
    new Inventory(self.collections, product.id).reserve(self.id, quantity, options, function(err, inventory) {
      if(err) return rollback(self, product, quantity, callback);
      self.products.push({
          _id: product.id
        , quantity: quantity
        , name: product.name
        , price: product.price
      });
      // return
      callback(null, self);
    });
  });
}

/*
 * Remove product from cart and return quantity to inventory
 */
Cart.prototype.remove = function(product, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Remove from inventory reservation
  new Inventory(self.collections, product.id).release(self.id, options, function(err, r) {
    if(err) return callback(err);

    // Remove the reservation from the cart itself
    self.carts.updateOne({
        _id: self.id
      , "products._id": product.id
      , state: Cart.ACTIVE
    }, {
      $pull: { products: {_id: product.id }}
    }, options, function(err, r) {
      if(err) return callback(err);
      if(r.modifiedCount == 0) return callback(new Error(f('failed to remove product %s from cart %s', product.id, self.id)));
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);
      callback(null, self);
    })
  })
}

/*
 * Update the quantity of a product in the cart
 */
Cart.prototype.update = function(product, quantity, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Get the latest cart view
  self.carts.findOne({_id: self.id}, function(err, doc) {
    if(err) return callback(err);
    if(!doc) return callback(new Error(f('could not locate cart with id %s', self.id)));

    // Old quantity for the product
    var oldQuantity = 0;
    // Locate the product we wish to update
    for(var i = 0; i < doc.products.length; i++) {
      if(doc.products[i]._id == product.id) {
        oldQuantity = doc.products[i].quantity;
      }
    }

    // Calculate the delta
    var delta = quantity - oldQuantity;

    // Update the quantity in the cart
    self.carts.updateOne({
        _id: self.id
      , "products._id": product.id
      , state: Cart.ACTIVE
    }, {
      $set: {
          modified_on: new Date()
        , "products.$.quantity": quantity
      }
    }, options, function(err, r) {
      if(err) return callback(err);
      if(r.modifiedCount == 0) return callback(new Error(f('could not locate the cart with id %s or product not found in cart', self.id)));
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);

      // Attempt to reserve the quantity from the product inventory
      new Inventory(self.collections, product.id).adjust(self.id, quantity, delta, options ,function(err1, inventory) {
        if(err1 == null) return callback(null, self);
        // Rollback as we could not apply the adjustment in the reservation
        self.carts.updateOne({
            _id: self.id
          , "products._id": product.id
          , state: Cart.ACTIVE
        }, {
          $set: {
              modified_on: new Date()
            , "products.$.quantity": oldQuantity
          }
        }, options, function(err, r) {
          if(err) return callback(err);
          if(r.modifiedCount == 0) return callback(new Error(f('failed to rollback product quantity change of %s for cart %s', delta, self.id)));
          if(r.result.writeConcernError) return callback(r.result.writeConcernError);
          // Return original error message from the inventory reservation attempt
          callback(err1, null);
        })
      });
    })
  });
}

/*
 * Perform the checkout of the products in the cart
 */
Cart.prototype.checkout = function(details, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  self.carts.findOne({_id: self.id}, function(err, cart) {
    if(err) return callback(err);
    if(!cart) return callback(new Error(f('could not locate cart with id %s', self.id)));
    // Create a new order instance
    var order = new Order(self.collections, new ObjectID()
      , details.shipping
      , details.payment
      , cart.products);
    // Create the document
    order.create(options, function(err, order) {
      if(err) return callback(err);

      // Set the state of the cart as completed
      self.carts.updateOne({
          _id: self.id
        , state: Cart.ACTIVE
      }, {
        $set: { state: Cart.COMPLETED }
      }, options, function(err, r) {
        if(err) return callback(err);
        if(r.modifiedCount == 0) return callback(new Error(f('failed to set cart %s to completed state', self.id)));
        if(r.result.writeConcernError) return callback(r.result.writeConcernError);

        // Commit the change to the inventory
        Inventory.commit(self.collections, self.id, options, function(err, inventory) {
          if(err) return callback(err);
          callback();
        });
      })
    });
  });
}

/*
 * Release any of the expired carts
 */
Cart.releaseExpired = function(collections, options, callback) {
  if(typeof options == 'function') callback = options, options = {};

  collections['carts'].find({state: Cart.EXPIRED}).toArray(function(err, carts) {
    if(err) return callback(err);
    if(carts.length == 0) return callback();
    var left = carts.length;

    // Process each cart
    var processCart = function(cart, callback) {
      // Release all reservations for this cart
      Inventory.releaseAll(collections, cart._id, options, function(err) {
        // Set cart to expired
        collections['carts'].updateOne(
            { _id: cart._id }
          , { $set: { state: Cart.CANCELED }}, options, callback);
      });
    }

    // Release all the carts
    for(var i = 0; i < carts.length; i++) {
      processCart(carts[i], function(err) {
        left = left - 1;

        if(left == 0) callback();
      });
    }
  });
}

/*
 * Create the optimal indexes for the queries
 */
Cart.createOptimalIndexes = function(collections, callback) {
  collections['carts'].ensureIndex({state: 1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Cart;