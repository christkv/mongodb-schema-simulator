"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID;

var Order = function(collections, id, shipping, payment, products) {  
  this.id = id == null ? new ObjectID() : id;
  this.shipping = shipping;
  this.payment = payment;
  this.products = products

  // Orders collection
  this.orders = collections['orders'];
}

/*
 * Create a new order after checkout of the cart
 */
Order.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
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
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.nInserted == 0) return callback(new Error(f('failed to insert order for cart %s', self.id)));
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    callback();
  })
}

/*
 * Create the optimal indexes for the queries
 */
Order.createOptimalIndexes = function(collections, callback) {
  callback();
}

module.exports = Order;