"use strict";

var f = require('util').format;

/*
 * Create a new category instance
 */
var Category = function(categories, products, id, names) {
  this.id = id == null ? new ObjectID() : id;

  // Hash of all the names by local ('en-us') etc
  // { 'en-us': 'computers' }
  this.names = names || {};
  
  // Collections used
  this.categories = categories;
  this.products = products;
}

/*
 * Add a new name local to the category, update relevant products
 */
Category.prototype.addLocal = function(local, name, callback) {
  var self = this;
  // Build set statement
  var setStatement = {}
  // Set the new local
  setStatement[f('names.%s', local)] = name;

  // Update the category with the new local for the name
  this.categories.updateOne({
    _id: this.id
  }, {
    $set: setStatement
  }, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('could not modify category with id %s', self.id)));
    
    // Set up the update statement
    var updateStatement = {};
    updateStatement[f('categories.$.names.%s', local)] = name;

    // Update all the products that have the category cached
    self.products.updateMany({
      'categories._id': self.id
    }, {
      $set: updateStatement
    }, function(err, r) {
      if(err) return callback(err);
      callback();
    });
  });
}

/*
 * Remove a new name local from the category, update relevant products
 */
Category.prototype.removeLocal = function(local, callback) {
  var self = this;
  // Build set statement
  var setStatement = {}
  // UnSet the new local
  setStatement[f('names.%s', local)] = '';

  // Update the category with the new local for the name
  this.categories.updateOne({
    _id: this.id
  }, {
    $unset: setStatement
  }, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('could not modify category with id %s', self.id)));
    
    // Set up the update statement
    var updateStatement = {};
    updateStatement[f('categories.$.names.%s', local)] = '' ;

    // Update all the products that have the category cached
    self.products.updateMany({
      'categories._id': self.id
    }, {
      $unset: updateStatement
    }, function(err, r) {
      if(err) return callback(err);
      callback();
    });
  });
}

/*
 * Create a new mongodb category document
 */
Category.prototype.create = function(callback) {
  var self = this;
  // Insert a new category
  this.categories.insertOne({
      _id: this.id
    , names: this.names
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Reload the category information
 */
Category.prototype.reload = function(callback) {
  var self = this;

  this.categories.findOne({_id: this.id}, function(err, doc) {
    if(err) return callback(err);
    self.names = doc.names;
    callback(null, self);
  });
}

/*
 * Create the optimal indexes for the queries
 */
Category.createOptimalIndexes = function(db, callback) {
  callback();
}

module.exports = Category;