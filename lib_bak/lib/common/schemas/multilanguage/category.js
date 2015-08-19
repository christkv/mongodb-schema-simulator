"use strict";

var f = require('util').format,
  co = require('co');

/*
 * Create a new category instance
 */
class Category {
  constructor(collections, id, names) {
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
  addLocal(local, name, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Build set statement
        var setStatement = {}
        // Set the new local
        setStatement[f('names.%s', local)] = name;

        // Update the category with the new local for the name
        var r = yield self.categories.updateOne({
          _id: self.id
        }, {
          $set: setStatement
        }, options);

        if(r.modifiedCount == 0 && r.n == 0)
          return reject(new Error(f('could not modify category with id %s', self.id)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        // Set up the update statement
        var updateStatement = {};
        updateStatement[f('categories.$.names.%s', local)] = name;

        // Update all the products that have the category cached
        var r = yield self.products.updateMany({
          'categories._id': self.id
        }, {
          $set: updateStatement
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve();
      }).catch(reject);
    });
  }

  /*
   * Remove a new name local from the category, update relevant products
   */
  removeLocal(local, options) {
    var self = this;
    options = options || {};

    // Build set statement
    var setStatement = {}
    // UnSet the new local
    setStatement[f('names.%s', local)] = '';

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Update the category with the new local for the name
        var r = yield self.categories.updateOne({
          _id: self.id
        }, {
          $unset: setStatement
        }, options);

        if(r.modifiedCount == 0 && r.n == 0)
          return reject(new Error(f('could not modify category with id %s', self.id)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        // Set up the update statement
        var updateStatement = {};
        updateStatement[f('categories.$.names.%s', local)] = '' ;

        // Update all the products that have the category cached
        var r = yield self.products.updateMany({
          'categories._id': self.id
        }, {
          $unset: updateStatement
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve();
      }).catch(reject);
    });
  }

  /*
   * Create a new mongodb category document
   */
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Insert a new category
        var r = yield self.categories.insertOne({
            _id: self.id
          , names: self.names
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Reload the category information
   */
  reload() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function* () {
        var doc = yield self.categories.findOne({_id: self.id});
        self.names = doc.names;
        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Category;
