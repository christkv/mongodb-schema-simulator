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
