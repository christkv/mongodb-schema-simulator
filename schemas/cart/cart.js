"use strict";

var f = require('util').format;

var Cart = function(db, id) {  
  this.db = db;
  this.id = id;
  this.carts = db.collection('carts');
  this.inventories = db.collection('inventories');
}

Cart.ACTIVE = 'active';

Cart.prototype.create = function(callback) {
  var self = this;
  // Add an index on the session id
  self.carts.ensureIndex({sessionId:1}, function() {
    self.carts.updateOne({
        sessionId: self.id, 
      }, {
        status: Cart.ACTIVE, modified_on: new Date()
      }, {upsert:true}, callback);
  });
}

var rollback = function(cart, product, quantity, callback) {
  cart.carts.updateOne({
    sessionId: self.id, status: Cart.ACTIVE, products._id: product.id
  }, {
    $pull: { products: { _id: product.id } }
  }, function(err, r) {
    if(err) return callback(err);
    callback(new Error(f("failed to reserve the quantity %s of product %s for cart %s", quantity, product.id, cart.id)))
  });
}

Cart.prototype.add = function(product, quantity, callback) {
  var self = this;

  // Add product to cart, and create cart with upsert
  // if it does not already exist
  this.carts.updateOne({
    sessionId: self.id, status: Cart.ACTIVE
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
    this.inventories.updateOne({
      _id: product.id, quantity: { $gte: quantity }
    }, {
        $inc: {quantity: -quantity}
      , $push: {
        quantity: quantity, sessionId: self.id, created_on: new Date()
      }
    }, function(err, r) {
      if(err) return callback(err);
      if(r.nUpdated == 0) return rollback(self, product, quantity, callback);
      callback();
    });
  });
}

Cart.prototype.remove = function(product, callback) {
}

Cart.prototype.update = function(product, quantity, callback) {
}

Cart.product.checkout = function(callback) {  
}

module.exports = Cart;