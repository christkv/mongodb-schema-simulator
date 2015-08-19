"use strict";

var ObjectID = require('mongodb').ObjectID,
  co = require('co');

class Product {
  constructor(collections, id, name, properties) {
    this.id = id == null ? new ObjectID() : id;
    this.name = name;
    this.properties = properties;
    this.products = collections['products'];
  }

  /*
   * Create a new product MongoDB document
   */
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Insert a product
        var r = yield self.products.insertOne({
            _id: self.id
          , name: self.name
          , properties: self.properties
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

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
        // Find a product
        var doc = yield self.products.findOne({_id: self.id});
        if(!doc) {
          return resolve(self);
        }

        self.name = doc.name;
        self.price = doc.price;
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

module.exports = Product;
