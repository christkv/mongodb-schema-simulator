"use strict";

var ObjectID = require('mongodb').ObjectID;

var Product = function(db, id) {
  this.db = db;
  this.id = id || new ObjectID();
  this.products = db.collection('products');  
}

/*
 * Reload the product information
 */
Product.prototype.reload = function(callback) {
  var self = this;

  this.products.findOne({_id: this.id}, function(err, doc) {
    if(err) return callback(err);
    self.name = doc.name;
    self.price = doc.price;
    callback(null, self);
  });
}

/*
 * Create the optimal indexes for the queries
 */
Product.createOptimalIndexes = function(db, callback) {
  callback();
}

module.exports = Product;