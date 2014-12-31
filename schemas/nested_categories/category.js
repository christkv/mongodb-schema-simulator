"use strict";

var f = require('util').format;

/*
 * Create a new category instance
 */
var Category = function(db, id, name, category, parent) {
  this.db = db;
  this.id = id;
  this.name = name;
  this.category = category;  
  this.categories = db.collection('categories');  

  // If no parent was passed in
  if(!parent) {
    // Split up the category to locate the parent
    var paths = category.split('/');
    paths.pop();
    // Merged all paths to get parent
    this.parent = paths.join('/');    
    // Special case of the root
    if(this.parent == '' && category != '/') this.parent = '/';
  }
}

/*
 * Create a new mongodb category document
 */
Category.prototype.create = function(callback) {
  var self = this;
  // Insert a new category
  this.categories.insertOne({
      _id: this.id
    , name: this.name
    , category: this.category
    , parent: this.parent
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Find all direct children categories of a provided category path
 */
Category.findAllDirectChildCategories = function(db, path, callback) {
  var self = this;

  // Regular expression
  var regexp = new RegExp(f('^%s$', path));
  
  // Locate all the categories
  db.collection('categories').find({parent: regexp}).toArray(function(err, docs) {
    if(err) return callback(err);

    // Map all the docs to category instances
    callback(null, docs.map(function(x) {
      return new Category(db, x._id, x.name, x.category, x.parent);
    }))
  });
}

/*
 * Find all children categories below the provided category path
 */
Category.findAllChildCategories = function(db, path, callback) {
  var self = this;
  // Regular expression
  var regexp = new RegExp(f('^%s', path));
  
  // Locate all the categories
  db.collection('categories').find({parent: regexp}).toArray(function(err, docs) {
    if(err) return callback(err);

    // Map all the docs to category instances
    callback(null, docs.map(function(x) {
      return new Category(db, x._id, x.name, x.category, x.parent);
    }));
  });  
}

/*
 * Find a specific category by it's path
 */
Category.findOne = function(db, path, callback) {
  // Locate all the categories
  db.collection('categories').findOne({category: path}, function(err, doc) {
    if(err) return callback(err);
    if(!doc) return callback(new Error(f('could not locate category with path %s', path)));
    callback(null, new Category(db, doc._id, doc.name, doc.category, doc.parent));
  })  
}

/*
 * Reload the product information
 */
Category.prototype.reload = function(callback) {
  var self = this;

  this.categories.findOne({_id: this.id}, function(err, doc) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Create the optimal indexes for the queries
 */
Category.createOptimalIndexes = function(db, callback) {
  db.collection('categories').ensureIndex({category:1}, function(err, result) {
    if(err) return callback(err);

    db.collection('categories').ensureIndex({parent:1}, function(err, result) {
      if(err) return callback(err);
      callback();
    });
  });
}

module.exports = Category;