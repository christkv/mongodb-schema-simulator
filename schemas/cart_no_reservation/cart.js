"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID
  , Inventory = require('./inventory')
  , Order = require('./order');

var Cart = function(db, id) {  
  this.db = db;
  this.id = id || new ObjectID();
  this.products = [];
  this.carts = db.collection('carts');
  this.inventories = db.collection('inventories');
}

Cart.ACTIVE = 'active';
Cart.EXPIRED = 'expired';
Cart.COMPLETED = 'completed';
Cart.CANCELED = 'canceled';

/*
 * Create a new cart instance and save it to mongodb
 */
Cart.prototype.create = function(callback) {
  var self = this;
  self.carts.updateOne({
      _id: self.id, 
    }, {
        state: Cart.ACTIVE
      , modified_on: new Date()
      , products: []
    }, {upsert:true}, function(err) {
      if(err) return callback(err);
      callback(null, self);
    });
}

/*
 * Add product to cart, no validation of availability is made
 * as this is determined at check out only
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
    if(r.modifiedCount == 0) return callback(new Error(f("failed to add product %s to the cart with id %s", product.id, self.id)))
    self.products.push({
        _id: product.id
      , quantity: quantity
      , name: product.name
      , price: product.price
    })
    // Return the cart
    callback(null, self);
  });
}

/*
 * Remove product from cart
 */
Cart.prototype.remove = function(product, callback) {
  var self = this;

  // Remove the reservation from the cart itself
  self.carts.updateOne({
      _id: self.id
    , "products._id": product.id
    , state: Cart.ACTIVE
  }, {
    $pull: { products: {_id: product.id }}
  }, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('failed to remove product %s from cart %s', product.id, self.id)));
    callback(null, self);
  });
}

/*
 * Update the product quantity in the cart
 */
Cart.prototype.update = function(product, quantity, callback) {
  var self = this;
  // Update cart with the new quantity
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
    if(r.modifiedCount == 0) return callback(new Error(f('failed to set product quantity change of %s for cart %s', quantity, self.id)));
    callback(null, self);
  });
}

/*
 * Attempt to checkout the products in the cart, late validation (like Amazon does)
 */
Cart.prototype.checkout = function(details, callback) {
  var self = this;

  // Fetch latest cart view
  this.carts.findOne({
    _id: this.id
  }, function(err, cart) {
    if(err) return callback(err);
    if(!cart) return callback(new Error(f('could not located cart with id %s', self.id)));

    // Reserve the quantities for all the products (rolling back if some are not possible to cover)
    Inventory.reserve(self.db, self.id, cart.products, function(err) {
      if(err) return callback(err);
    
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
          if(r.modifiedCount == 0) return callback(new Error(f('failed to set cart %s to completed state', self.id)));

          // Commit the change to the inventory
          Inventory.commit(self.db, self.id, function(err, inventory) {
            if(err) return callback(err);
            callback();
          });
        })
      });
    });
  });
}

/*
 * Expired carts can just be set to canceled as there is no need to return inventory
 */
Cart.releaseExpired = function(db, callback) {
  db.collection('carts').updateMany(
      {state: Cart.EXPIRED}
    , { $set: { state: Cart.CANCELED} }, function(err, r) {
      if(err) return callback(err);
      callback();
    });
}

/*
 * Create the optimal indexes for the queries
 */
Cart.createOptimalIndexes = function(db, callback) {
  db.collection('carts').ensureIndex({state: 1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Cart;