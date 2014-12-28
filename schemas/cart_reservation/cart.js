"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID
  , Inventory = require('./inventory')
  , Order = require('./order');

var Cart = function(db, id) {  
  this.db = db;
  this.id = id;
  this.carts = db.collection('carts');
  this.inventories = db.collection('inventories');
}

Cart.ACTIVE = 'active';
Cart.EXPIRED = 'expired';
Cart.COMPLETED = 'completed';

/*
 * Create a new cart instance and save it to mongodb
 */
Cart.prototype.create = function(callback) {
  self.carts.updateOne({
      _id: self.id, 
    }, {
        state: Cart.ACTIVE
      , modified_on: new Date()
      , products: []
    }, {upsert:true}, callback);
}

var rollback = function(cart, product, quantity, callback) {
  cart.carts.updateOne({
    _id: self.id, state: Cart.ACTIVE, products._id: product.id
  }, {
    $pull: { products: { _id: product.id } }
  }, function(err, r) {
    if(err) return callback(err);
    callback(new Error(f("failed to reserve the quantity %s of product %s for cart %s", quantity, product.id, cart.id)))
  });
}

/*
 * Add product and quantity to cart if available in inventory
 */
Cart.prototype.add = function(product, quantity, callback) {
  var self = this;

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
  }, {upsert:true}, function(err, r) {
    if(err) return callback(err);
    if(r.nUpdated == 0) return callback(new Error(f("failed to add product %s to the cart with id %s", product.id, self.id)))

    // Next update the inventory, if there is enough
    // quantity available, push the cart information to the
    // list of reserved product quantities
    new Inventory(self.db, product.id).reserve(self.id, quantity, function(err, inventory) {
      if(err) return rollback(self, product, quantity, callback);
      callback();
    });
  });
}

/*
 * Remove product from cart and return quantity to inventory
 */
Cart.prototype.remove = function(product, callback) {
  var self = this;

  // Remove from inventory reservation
  new Inventory(self.db, product.id).release(self.id, function(err, r) {
    if(err) return callback(err);

    // Remove the reservation from the cart itself
    self.carts.updateOne({
        _id: self.id
      , "products._id": product.id
      , state: Cart.ACTIVE
    }, {
      $pull: { products: {_id: product.id }}
    }, function(err, r) {
      if(err) return callback(err);
      if(r.result.nModified == 0) return callback(new Error(f('failed to remove product %s from cart %s', product.id, self.id)));
      callback(null, self);
    })
  })
}

/*
 * Update the quantity of a product in the cart
 */
Cart.prototype.update = function(product, quantity, callback) {
  var self = this;

  // Get the latest cart view
  self.carts.findOne({_id: self.id}, function(err, doc) {
    if(err) return callback(err);
    if(!doc) return callback(new Error(f('could not locate cart with id %s', self.id))))

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
    }, function(err, r) {
      if(err) return callback(err);
      if(r.result.nModified == 0) return callback(new Error(f('could not locate the cart with id %s or product not found in cart', self.id)));

      // Attempt to reserve the quantity from the product inventory
      new Inventory(self.db, product.id).adjust(id, quantity, delta, function(err, inventory) {
        if(err == null) return callback(null, self);
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
        }, function(err, r) {
          if(err) return callback(err);
          if(r.result.nModified == 0) return callback(new Error(f('failed to rollback product quantity change of %s for cart %s', delta, self.id)));
          callback(null, self);
        })
      });
    })
  });
}

/*
 * Perform the checkout of the products in the cart
 */
Cart.product.checkout = function(details, callback) {
  var self = this;
  // Create a new order instance
  var order = new Order(self.db, new ObjectID()
    , details.shipping
    , details.payment
    , cart.products);
  // Create the document
  order.create(function(err, order) {
    if(err) return callback(err);

    // Set the state of the cart as completed
    self.carts.updateOne({
        _id: self.id
      , state: Cart.ACTIVE
    }, {
      $set: { state: Cart.COMPLETED }
    }, function(err, r) {
      if(err) return callback(err);
      if(r.result.nModified == 0) return callback(new Error(f('failed to set cart %s to completed state', self.id)));

      // Commit the change to the inventory
      Inventory.commit(self.db, self.id, function(err, inventory) {
        if(err) return callback(err);
        callback();
      });
    })
  });
}

module.exports = Cart;