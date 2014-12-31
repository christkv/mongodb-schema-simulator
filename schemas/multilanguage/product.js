"use strict";

/*
 * Create a new product instance
 */
var Product = function(db, id, name, cost, currency, categories) {
  this.db = db;
  this.id = id;
  this.name = name;
  this.cost = cost;
  this.currency = currency;
  this.categories = categories;
  this.products = db.collection('products');  
}

/*
 * Create a new mongodb product document
 */
Product.prototype.create = function(callback) {
  var self = this;
  // Insert a new category
  this.products.insertOne({
      _id: this.id
    , name: this.name
    , cost: this.cost
    , currency: this.currency
    , categories: this.categories
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

  this.products.findOne({_id: this.id}, function(err, doc) {
    if(err) return callback(err);
    self.id = doc.id;
    self.name = doc.name;
    self.price = doc.price;
    self.currency = doc.currency;
    self.categories = doc.categories;
    callback(null, self);
  });
}

/*
 * Create the optimal indexes for the queries
 */
Product.createOptimalIndexes = function(db, callback) {
  db.collection('products').ensureIndex({'categories._id':1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Product;