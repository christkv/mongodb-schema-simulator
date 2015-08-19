"use strict";

var f = require('util').format,
  co = require('co'),
  Category = require('./category');

/*
 * Create a product instance
 */
class Product {
  constructor(collections, id, name, cost, currency, categories) {
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
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Insert a new category
        yield self.products.insertOne({
            _id: self.id
          , name: self.name
          , cost: self.cost
          , currency: self.currency
          , categories: self.categories
        }, options);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Find all products for a specific category
   */
  static findByCategory(collections, path, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Get all the products
        var cursor = collections['products'].find({
          categories: path
        })

        if(options.readPreference) {
          cursor.setReadPreference(options.readPreference);
        }

        var products = yield cursor.toArray();
        resolve(products.map(function(x) {
          return new Product(collections, x._id, x.name, x.cost, x.currency, x.categories);
        }));
      }).catch(reject);
    });
  }

  /*
   * Find all products for a categories direct children
   */
  static findByDirectCategoryChildren(collections, path, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Locate all the categories
        var categories = yield Category.findAllDirectChildCategories(collections, path, options);
        // Convert to paths
        var paths = categories.map(function(x) {
          return x.category;
        });

        // Get all the products
        var cursor = collections['products'].find({
          categories: { $in: paths }
        })

        if(options.readPreference) {
          cursor.setReadPreference(options.readPreference);
        }

        var products = yield cursor.toArray();
        resolve(products.map(function(x) {
          return new Product(collections, x._id, x.name, x.cost, x.currency, x.categories);
        }));
      }).catch(reject);
    });
  }

  /*
   * Find all products for a specific category tree
   */
  static findByCategoryTree(collections, path, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Locate all the categories
        var categories = yield Category.findAllChildCategories(collections, path, options);

        // Convert to paths
        var paths = categories.map(function(x) {
          return x.category;
        });

        // Get all the products
        var cursor = collections['products'].find({
          categories: { $in: paths }
        })

        if(options.readPreference) {
          cursor.setReadPreference(options.readPreference);
        }

        var products = yield cursor.toArray();
        resolve(products.map(function(x) {
          return new Product(collections, x._id, x.name, x.cost, x.currency, x.categories);
        }));
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['products'].ensureIndex({categories:1});
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Product;
