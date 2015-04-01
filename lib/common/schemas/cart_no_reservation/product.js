"use strict";

var ObjectID = require('mongodb').ObjectID;

var Product = function(collections, id, name, properties) {
  this.id = id == null ? new ObjectID() : id;
  this.name = name;
  this.properties = properties;
  this.products = collections['products'];  
}

/*
 * Create a new product MongoDB document
 */
Product.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Insert a product
  this.products.insertOne({
      _id: this.id
    , name: this.name
    , properties: this.properties
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    callback(null, self);
  });
}

/*
 * Reload the product information
 */
Product.prototype.reload = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Find a product
  this.products.findOne({_id: this.id}, options, function(err, doc) {    
    if(err) return callback(err);
    if(!doc) {
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
Product.createOptimalIndexes = function(collections, callback) {
  callback();
}

module.exports = Product;