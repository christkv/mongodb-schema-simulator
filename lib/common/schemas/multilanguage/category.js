"use strict";

var f = require('util').format;

/*
 * Create a new category instance
 */
var Category = function(collections, id, names) {
  this.id = id == null ? new ObjectID() : id;

  // Hash of all the names by local ('en-us') etc
  // { 'en-us': 'computers' }
  this.names = names || {};
  
  // Collections used
  this.categories = collections['categories'];
  this.products = collections['products'];
}

/*
 * Add a new name local to the category, update relevant products
 */
Category.prototype.addLocal = function(local, name, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
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
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0 && r.n == 0) return callback(new Error(f('could not modify category with id %s', self.id)));
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    
    // Set up the update statement
    var updateStatement = {};
    updateStatement[f('categories.$.names.%s', local)] = name;

    // Update all the products that have the category cached
    self.products.updateMany({
      'categories._id': self.id
    }, {
      $set: updateStatement
    }, options, function(err, r) {
      if(err) return callback(err);
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);
      callback();
    });
  });
}

/*
 * Remove a new name local from the category, update relevant products
 */
Category.prototype.removeLocal = function(local, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
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
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0 && r.n == 0) return callback(new Error(f('could not modify category with id %s', self.id)));
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    
    // Set up the update statement
    var updateStatement = {};
    updateStatement[f('categories.$.names.%s', local)] = '' ;

    // Update all the products that have the category cached
    self.products.updateMany({
      'categories._id': self.id
    }, {
      $unset: updateStatement
    }, options, function(err, r) {
      if(err) return callback(err);
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);
      callback();
    });
  });
}

/*
 * Create a new mongodb category document
 */
Category.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Insert a new category
  this.categories.insertOne({
      _id: this.id
    , names: this.names
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
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
Category.createOptimalIndexes = function(collections, callback) {
  callback();
}

module.exports = Category;