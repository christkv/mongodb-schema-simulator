"use strict";

var f = require('util').format;

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

Category.findAllDirectChildCategories = function(path, callback) {
  var self = this;
  // Regular expression
  var regexp = new RegExp(f('^%s$', path));
  
  // Locate all the categories
  this.categories.find({parent: regexp}).toArray(function(err, docs) {
    if(err) return callback(err);

    // Map all the docs to category instances
    callback(null, docs.map(function(x) {
      return new Category(self.db, x._id, x.category, x.parent);
    }))
  });
}

Category.findAllChildCategories = function(path, callback) {
  var self = this;
  // Regular expression
  var regexp = new RegExp(f('^%s', path));
  
  // Locate all the categories
  this.categories.find({parent: regexp}).toArray(function(err, docs) {
    if(err) return callback(err);

    // Map all the docs to category instances
    callback(null, docs.map(function(x) {
      return new Category(self.db, x._id, x.category, x.parent);
    }));
  });  
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

module.exports = Category;