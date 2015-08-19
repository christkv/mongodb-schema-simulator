"use strict";

var co = require('co');

/*
 * Create a new product instance
 */
class Product {
  constructor(collections, id, name, cost, currency, categories) {
    this.id = id == null ? new ObjectID() : id;
    this.name = name;
    this.cost = cost;
    this.currency = currency;
    this.categories = categories;
    this.products = collections['products'];
  }

  /*
   * Create a new mongodb product document
   */
  create() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Insert a new category
        yield self.products.insertOne({
            _id: self.id
          , name: self.name
          , cost: self.cost
          , currency: self.currency
          , categories: self.categories
        });

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Reload the product information
   */
  reload() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function* () {
        var doc = yield self.products.findOne({_id: self.id});
        self.id = doc.id;
        self.name = doc.name;
        self.price = doc.price;
        self.currency = doc.currency;
        self.categories = doc.categories;
        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['products'].ensureIndex({'categories._id':1});
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Product;
