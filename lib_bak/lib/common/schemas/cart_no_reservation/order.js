"use strict";

var f = require('util').format,
    ObjectID = require('mongodb').ObjectID,
    co = require('co');

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
    options = options || {}
    var total = 0;

    for(var i = 0; i < this.products.length; i++) {
      total = total + (this.products[i].quantity * this.products[i].price);
    }

    return new Promise(function(resolve, reject) {
      co(function* () {
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

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self)
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      resolve();
    });
  }
}

module.exports = Order;
