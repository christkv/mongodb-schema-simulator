var Case = require('../../lib/child/case')
  , f = require('util').format
  , ObjectId = require('mongodb').ObjectID
  , crypto = require('crypto')
  , inherits = require('util').inherits;

var NestedCategories = function(module, args) {
  if(!(this instanceof NestedCategories)) return new NestedCategories();
  Case.call(this, Array.prototype.slice.call(arguments, 0));
  this.args = args;
  this.module = module;
  this.collection = null;
  // Used to fill in documents in time series fashion
  this.counter = 0;
}

// Inherit from Case
inherits(NestedCategories, Case);

/*
 * Setup and tear down methods for the NestedCategories class
 */
NestedCategories.prototype.setup = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Connect to the server
  this.connect(function(err, db) {
    if(err) return callback(err);
    
    // Set our collection
    self.collection = db.collection('nested_categories');

    // Drop the collection
    self.collection.drop(function() {
      callback();
    });
  });
}

NestedCategories.prototype.teardown = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Retrieve all child categories under a specific root with indexes
 */
NestedCategories.prototype.childCategoriesUnderSpecificRoot = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Retrieve all child categories under a specific root with no indexes
 */
NestedCategories.prototype.childCategoriesUnderSpecificRootNoIndexes = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Retrieve all child categories under a specific root with covered indexes
 */
NestedCategories.prototype.childCategoriesUnderSpecificRootCoveredIndexes = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Retrieve all categories in all branches under a specified root with indexes
 */
NestedCategories.prototype.allCategoriesUnderSpecificRoot = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Retrieve all categories in all branches under a specified root with covered indexes
 */
NestedCategories.prototype.allCategoriesUnderSpecificRootCoveredIndexes = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Retrieve all categories in all branches under a specified root with no indexes
 */
NestedCategories.prototype.allCategoriesUnderSpecificRootNoIndexes = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Retrieve all the products under a specific category with indexes
 */
NestedCategories.prototype.allProductsInCategory = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Retrieve all the products under a specific category with no indexes
 */
NestedCategories.prototype.allProductsInCategoryNoIndexes = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

// Export schema
module.exports = {
    abr: 'nested_categories'
  , description: 'Show case Nested Categories patterns'
  , chapter: 2
  , module: f('%s', __filename)
  , entry: 'start'
  , class: NestedCategories
  , methods: [{
      name: 'child_indexes'
    , method: 'childCategoriesUnderSpecificRoot'
    , description: 'Retrieve all child categories under a specific root with indexes'
  }, {
      name: 'child_no_indexes'
    , method: 'childCategoriesUnderSpecificRootNoIndexes'
    , description: 'Retrieve all child categories under a specific root with no indexes'
  }, {
      name: 'child_covered_indexes'
    , method: 'childCategoriesUnderSpecificRootCoveredIndexes'
    , description: 'Retrieve all child categories under a specific root with covered indexes'
  }, {
      name: 'all'
    , method: 'allCategoriesUnderSpecificRoot'
    , description: 'Retrieve all categories in all branches under a specified root with indexes'
  }, {
      name: 'all_covered_indexes'
    , method: 'allCategoriesUnderSpecificRootCoveredIndexes'
    , description: 'Retrieve all categories in all branches under a specified root with covered indexes'
  }, {
      name: 'all_no_indexes'
    , method: 'allCategoriesUnderSpecificRootNoIndexes'
    , description: 'Retrieve all categories in all branches under a specified root with no indexes'
  }, {
      name: 'all_products'
    , method: 'allProductsInCategory'
    , description: 'Retrieve all the products under a specific category with indexes'
  }, {
      name: 'all_products_no_index'
    , method: 'allProductsInCategoryNoIndexes'
    , description: 'Retrieve all the products under a specific category with no indexes'
  }]  
}