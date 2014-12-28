"use strict";

var f = require('util').format;

var Order = function(db, id, shipping, payment, products) {  
  this.db = db;
  this.id = id;
  this.shipping = shipping;
  this.payment = payment;
  this.products = products

  // Orders collection
  this.orders = db.collection('orders');
}

/*
 * Create a new order after checkout of the cart
 */
Order.prototype.create = function(callback) {
  var self = this;
  var total = 0;

  for(var i = 0; i < this.products.length; i++) {
    total = total + (this.products[i].quantity * this.products[i].price);
  }

  // Create a new order
  this.orders.insertOne({
      _id: self.id
    , total: total
    , shipping: self.shipping
    , payment: self.payment
    , products: self.products
  }, function(err, r) {
    if(err) return callback(err);
    if(r.result.nInserted == 0) return callback(new Error(f('failed to insert order for cart %s', self.id)));
    callback();
  })
}

module.exports = Order;