"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID;

var Inventory = function(collections, id) {  
  this.id = id == null ? new ObjectID() : id;
  this.inventories = collections['inventories'];
}

/*
 * Attempt to reserve a list of products and their quantities
 * rolls back if if it cannot satisfy all the product reservations and
 * returns the list of the ones that could not be covered
 */
Inventory.reserve = function(collections, id, products, callback) {
  var self = this;
  if(products.length == 0) return callback();
  // Gather any errors
  var errors = [];
  var applied = [];
  
  // Products left to reserve
  var left = products.length;

  // Attempt to reserve a product
  var reserveProduct = function(inventories, id, product, callback) {
    inventories.updateOne({
        _id: product._id
      , quantity: { $gte: product.quantity }
    }, {
        $inc: {quantity: -product.quantity}
      , $push: {
        reservations: {
          quantity: product.quantity, _id: id, created_on: new Date()
        }
      }
    }, function(err, r) {
      if(err) {
        err.product = product;
        return callback(err);
      }

      if(r.modifiedCount == 0) {
        var err = new Error(f('failed to reserve product %s for cart %s', product._id, id));
        err.product = product;
        return callback(err);
      }

      callback(null, product);
    });
  }

  // Rollback products
  var rollback = function(inventories, id, products, callback) {
    var left = products.length;
    var errors = [];
    // If we have no products return
    if(products.length == 0) return callback();
    // Rollback all the products
    for(var i = 0; i < products.length; i++) {
      inventories.updateOne({
          _id: products[i]._id
        ,  "reservations._id": id
      }, {
          $inc: { quantity: products[i].quantity }
        , $pull : { reservations: {_id: id } }
      }, function(err) {
        if(err) errors.push(err);
        left = left - 1;

        if(left == 0) {
          if(errors.length > 0) {
            var err = new Error(f('failed to rollback product reservations for %s', id));
            err.errors = errors;
            return callback(err);
          }

          callback();
        }
      })
    }
  }

  // Get inventories collection
  var inventories = collections['inventories'];

  // Attempt to reserve all the products for the cart in parallel
  for(var i = 0; i < products.length; i++) {
    reserveProduct(inventories, id, products[i], function(err, product) {
      left = left - 1;
      if(err) errors.push(err);
      else applied.push(product);

      if(left == 0 && errors.length == 0) return callback();
      if(left == 0) rollback(inventories, id, applied, function(err) {
        if(err) return callback(err);
        if(errors.length == 0) return callback(null, self);
        var error = new Error(f('failed to checkout cart %s', id));
        error.products = errors;
        callback(error);
      });
    });
  }
}

/*
 * Commit all the reservations by removing them from the reservations array
 */
Inventory.commit = function(collections, id, callback) {
  collections['inventories'].updateMany({
    'reservations._id': id
  }, {
    $pull: { reservations: {_id: id } }
  }, function(err, r) {
    if(err) return callback(err);
    callback();
  });
}

/*
 * Create the optimal indexes for the queries
 */
Inventory.createOptimalIndexes = function(collections, callback) {
  collections['inventories'].ensureIndex({"reservations._id": 1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Inventory;