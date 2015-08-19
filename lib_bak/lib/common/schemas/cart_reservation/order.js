"use strict";

var f = require('util').format,
  co = require('co'),
  ObjectID = require('mongodb').ObjectID;

class Order {
  constructor(collections, id, shipping, payment, products) {
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
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var total = 0;

        for(var i = 0; i < self.products.length; i++) {
          total = total + (self.products[i].quantity * self.products[i].price);
        }

        // Create a new order
        var r = yield self.orders.insertOne({
            _id: self.id
          , total: total
          , shipping: self.shipping
          , payment: self.payment
          , products: self.products
        }, options);

        if(r.result.nInserted == 0)
          return reject(new Error(f('failed to insert order for cart %s', self.id)));

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Order;
