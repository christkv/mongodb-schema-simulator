"use strict";

var ObjectID = require('mongodb').ObjectID;

var Product = function(collection, id, name, properties) {
  this.id = id == null ? new ObjectID() : id;
  this.name = name;
  this.properties = properties;
  this.products = collection;  
}

/*
 * Create a new product MongoDB document
 */
Product.prototype.create = function(callback) {
  var self = this;
  // Insert a product
  this.products.insertOne({
      _id: this.id
    , name: this.name
    , properties: this.properties
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Reload the product information
 */
Product.prototype.reload = function(callback) {
  var self = this;

  // Find a product
  this.products.findOne({_id: this.id}, function(err, doc) {    
    if(err) return callback(err);
    if(!doc) {
      console.dir("-------------------- did not find :: " + self.id)
      return callback(null, self)
    }
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