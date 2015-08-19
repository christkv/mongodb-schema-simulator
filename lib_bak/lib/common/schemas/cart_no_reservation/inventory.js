"use strict";

var f = require('util').format,
  ObjectID = require('mongodb').ObjectID,
  co = require('co');

class Inventory {
  constructor(collections, id, quantity) {
    this.id = id == null ? new ObjectID() : id;
    this.quantity = quantity;
    this.inventories = collections['inventories'];
  }

  /*
   * Create an inventory mongodb document
   */
  create(options) {
    var self = this;
    options = options || {}

    return new Promise(function(resolve, reject) {
      co(function* () {
        var r = yield self.inventories.insertOne({
            _id: self.id
          , quantity: self.quantity
          , reservations: []
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Attempt to reserve a list of products and their quantities
   * rolls back if if it cannot satisfy all the product reservations and
   * returns the list of the ones that could not be covered
   */
  static reserve(collections, id, products, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        if(products.length == 0) return callback();

        // Products left to reserve
        var left = products.length;

        // Attempt to reserve a product
        var reserveProduct = function(inventories, id, product, callback) {
          co(function* () {
            var r = yield inventories.updateOne({
                _id: product._id
              , quantity: { $gte: product.quantity }
            }, {
                $inc: {quantity: -product.quantity}
              , $push: {
                reservations: {
                  quantity: product.quantity, _id: id, created_on: new Date()
                }
              }
            }, options);

            if(r.modifiedCount == 0)
              return callback(new Error(f('failed to reserve product %s for cart %s', product._id, id)));

            if(r.result.writeConcernError)
              return callback(r.result.writeConcernError);

            callback(null, product);
          }).catch(function(err) {
            err.product = product;
            callback(err);
          });
        }

        // Rollback products
        var rollback = function(inventories, id, products) {
          return new Promise(function(resolve, reject) {
            co(function* () {
              // If we have no products return
              if(products.length == 0)
                return resolve();

              // Rollback all the products
              for(var i = 0; i < products.length; i++) {
                yield inventories.updateOne({
                    _id: products[i]._id
                  ,  "reservations._id": id
                }, {
                    $inc: { quantity: products[i].quantity }
                  , $pull : { reservations: {_id: id } }
                }, options);
              }

              resolve();
            }).catch(function(err) {
              err.product = product;
              reject(err);
            });
          });
        }

        // Get inventories collection
        var inventories = collections['inventories'];
        var left = products.length;

        // Gather any errors
        var errors = [];
        var applied = [];

        // Attempt to reserve all the products for the cart in parallel
        for(var i = 0; i < products.length; i++) {
          reserveProduct(inventories, id, products[i], function(err, product) {
            left = left - 1;

            if(err) {
              errors.push(err);
            } else {
              applied.push(product);
            }

            if(left == 0 && errors.length == 0)
              return resolve(self);

            if(left == 0) {
              co(function*() {
                yield rollback(inventories, id, applied);

                if(errors.length == 0)
                  return resolve(self);

                var error = new Error(f('failed to checkout cart %s', id));
                error.products = errors;
                reject(error);
              }).catch(function(err) {
                reject(err);
              });
            }
          });
        }
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Commit all the reservations by removing them from the reservations array
   */
  static commit(collections, id, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var r = yield collections['inventories'].updateMany({
          'reservations._id': id
        }, {
          $pull: { reservations: {_id: id } }
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);
        resolve();
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
      co(function* () {
        yield collections['inventories'].ensureIndex({"reservations._id": 1});
        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }
}

module.exports = Inventory;
