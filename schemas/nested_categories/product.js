"use strict";

var f = require('util').format
  , Category = require('./category');

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
 * Find all products for a specific category
 */
Product.findByCategory = function(db, path, callback) {
  // Get all the products
  db.collection('products').find({
    categories: path
  }).toArray(function(err, products) {
    if(err) return callback(err);
    callback(null, products.map(function(x) {
      return new Product(db, x._id, x.name, x.cost, x.currency, x.categories);
    }));
  });
}

/*
 * Find all products for a categories direct children
 */
Product.findByDirectCategoryChildren = function(db, path, callback) {
  var self = this;

  // Locate all the categories
  Category.findAllDirectChildCategories(db, path, function(err, categories) {
    if(err) return callback(err);

    // Convert to paths
    var paths = categories.map(function(x) {
      return x.category;
    });

    // Get all the products
    db.collection('products').find({
      categories: { $in: paths }
    }).toArray(function(err, products) {
      if(err) return callback(err);
      callback(null, products.map(function(x) {
        return new Product(db, x._id, x.name, x.cost, x.currency, x.categories);
      }));
    });
  });
}

/*
 * Find all products for a specific category tree
 */
Product.findByCategoryTree = function(db, path, callback) {
  // Locate all the categories
  Category.findAllChildCategories(db, path, function(err, categories) {
    if(err) return callback(err);

    // Convert to paths
    var paths = categories.map(function(x) {
      return x.category;
    });

    // Get all the products
    db.collection('products').find({
      categories: { $in: paths }
    }).toArray(function(err, products) {
      if(err) return callback(err);
      callback(null, products.map(function(x) {
        return new Product(db, x._id, x.name, x.cost, x.currency, x.categories);
      }));
    });
  });
}

/*
 * Create the optimal indexes for the queries
 */
Product.createOptimalIndexes = function(db, callback) {
  db.collection('products').ensureIndex({categories:1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Product;