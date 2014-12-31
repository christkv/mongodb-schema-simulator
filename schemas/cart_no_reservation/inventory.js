"use strict";

var f = require('util').format;

var Inventory = function(db, id) {  
  this.db = db;
  this.id = id;
  this.inventories = db.collection('inventories';)
}

/*
 * Attempt to reserve a list of products and their quantities
 * rolls back if if it cannot satisfy all the product reservations and
 * returns the list of the ones that could not be covered
 */
Inventory.reserve = function(db, id, products, callback) {
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
        reserved: {
          quantity: product.quantity, cartId: id, created_on: new Date()
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

    for(var i = 0; i < products.length; i++) {
      inventories.updateOne({
          _id: products[i]._id
        ,  "reserved._id": id
      }, {
          $inc: { quantity: products[i].quantity }
        , $pull : { reserved: {_id: id } }
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
  var inventories = db.collection('inventories');

  // Attempt to reserve all the products for the cart in parallel
  for(var i = 0; i < products.length; i++) {
    reserveProduct(inventories, id, products[i], function(err, product) {
      left = left - 1;
      if(err) errors.push(err);
      applied.puhs(product);

      if(left == 0 && errors.length == 0) return callback();
      if(left == 0) rollback(inventories, id, applied, callback);
    });
  }
}

/*
 * Commit all the reservations by removing them from the reserved array
 */
Inventory.commit = function(db, id, callback) {
  db.collection('inventories').updateMany({
    'reserved._id': id
  }, {
    $pull: { reserved: {_id: id } }
  }, function(err, r) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Inventory;