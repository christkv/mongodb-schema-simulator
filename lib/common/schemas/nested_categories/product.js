"use strict";

var f = require('util').format
  , Category = require('./category');

/*
 * Create a product instance
 */
var Product = function(collections, id, name, cost, currency, categories) {
  this.id = id;
  this.name = name;
  this.cost = cost;
  this.currency = currency;
  this.categories = categories;
  this.products = collections['products'];
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
 * Find all products for a specific category
 */
Product.findByCategory = function(collections, path, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  // Get all the products
  collections['products'].find({
    categories: path
  }).toArray(function(err, products) {
    if(err) return callback(err);
    callback(null, products.map(function(x) {
      return new Product(collections, x._id, x.name, x.cost, x.currency, x.categories);
    }));
  });
}

/*
 * Find all products for a categories direct children
 */
Product.findByDirectCategoryChildren = function(collections, path, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Locate all the categories
  Category.findAllDirectChildCategories(collections, path, function(err, categories) {
    if(err) return callback(err);

    // Convert to paths
    var paths = categories.map(function(x) {
      return x.category;
    });

    // Get all the products
    collections['products'].find({
      categories: { $in: paths }
    }).toArray(function(err, products) {
      if(err) return callback(err);
      callback(null, products.map(function(x) {
        return new Product(collections, x._id, x.name, x.cost, x.currency, x.categories);
      }));
    });
  });
}

/*
 * Find all products for a specific category tree
 */
Product.findByCategoryTree = function(collections, path, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  // Locate all the categories
  Category.findAllChildCategories(collections, path, function(err, categories) {
    if(err) return callback(err);

    // Convert to paths
    var paths = categories.map(function(x) {
      return x.category;
    });

    // Get all the products
    collections['products'].find({
      categories: { $in: paths }
    }).toArray(function(err, products) {
      if(err) return callback(err);
      callback(null, products.map(function(x) {
        return new Product(collections, x._id, x.name, x.cost, x.currency, x.categories);
      }));
    });
  });
}

/*
 * Create the optimal indexes for the queries
 */
Product.createOptimalIndexes = function(collections, callback) {
  collections['products'].ensureIndex({categories:1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Product;