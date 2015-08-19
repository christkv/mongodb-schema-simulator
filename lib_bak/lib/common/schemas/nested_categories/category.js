"use strict";

var f = require('util').format,
  co = require('co'),
  ObjectID = require('mongodb').ObjectID;

/*
 * Create a new category instance
 */
class Category {
  constructor(collections, id, name, category, parent) {
    this.id = id == null ? new ObjectID() : id;
    this.name = name;
    this.category = category;
    this.categories = collections['categories'];

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
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Insert a new category
        yield self.categories.insertOne({
            _id: self.id
          , name: self.name
          , category: self.category
          , parent: self.parent
        }, options);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Reload the product information
   */
  reload() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function* () {
        yield self.categories.findOne({_id: self.id});
        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Find all direct children categories of a provided category path
   */
  static findAllDirectChildCategories(collections, path, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Regular expression
        var regexp = new RegExp(f('^%s$', path));
        var coveredIndex = typeof options.coveredIndex == 'boolean' ? options.coveredIndex : false;

        // Execute as covered index
        if(coveredIndex) {
          var cursor = collections['categories'].find({parent: regexp})
            .project({_id: 0, name: 1, category:1});

          if(options.readPreference) {
            cursor.setReadPreference(options.readPreference);
          }

          // Locate all the categories
          var docs = yield cursor.toArray();

          // Map all the docs to category instances
          return resolve(docs.map(function(x) {
            return new Category(collections, x._id, x.name, x.category, x.parent);
          }));
        }

        // Locate all the categories
        var cursor = collections['categories'].find({parent: regexp});

        if(options.readPreference) {
          cursor.setReadPreference(options.readPreference);
        }

        var docs = yield cursor.toArray();

        // Map all the docs to category instances
        resolve(docs.map(function(x) {
          return new Category(collections, x._id, x.name, x.category, x.parent);
        }))
      }).catch(reject);
    });
  }

  /*
   * Find all children categories below the provided category path
   */
  static findAllChildCategories(collections, path, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Regular expression
        var regexp = new RegExp(f('^%s', path));
        var coveredIndex = typeof options.coveredIndex == 'boolean' ? options.coveredIndex : false;

        // Execute as covered index
        if(coveredIndex) {
          var cursor = collections['categories'].find({parent: regexp})
            .project({_id: 0, name: 1, category:1, parent:1});

          if(options.readPreference) {
            cursor.setReadPreference(options.readPreference);
          }

          // Locate all the categories
          var docs = yield cursor.toArray();

          // Map all the docs to category instances
          return resolve(docs.map(function(x) {
            return new Category(collections, x._id, x.name, x.category, x.parent);
          }));
        }

        // Locate all the categories
        var cursor = collections['categories'].find({parent: regexp});

        if(options.readPreference) {
          cursor.setReadPreference(options.readPreference);
        }

        var docs = yield cursor.toArray();

        // Map all the docs to category instances
        resolve(docs.map(function(x) {
          return new Category(collections, x._id, x.name, x.category, x.parent);
        }));
      }).catch(reject);
    });
  }

  /*
   * Find a specific category by it's path
   */
  static findOne(collections, path, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var coveredIndex = typeof options.coveredIndex == 'boolean' ? options.coveredIndex : false;

        // Execute as covered index
        if(coveredIndex) {
          options['fields'] = {_id: 0, name: 1, category:1, parent:1};
          // Locate all the categories
          var doc = yield collections['categories'].findOne({category: path}, options);

          if(!doc)
            return reject(new Error(f('could not locate category with path %s', path)));

          // Return the mapped category
          return resolve(new Category(collections, doc._id, doc.name, doc.category, doc.parent));
        }

        var finalOptions = {};
        if(options.readPreference) {
          finalOptions.readPreference = options.readPreference;
        }

        // Locate all the categories
        var doc = yield collections['categories'].findOne({category: path}, finalOptions);

        if(!doc)
          return reject(new Error(f('could not locate category with path %s', path)));

        // Return the mapped category
        resolve(new Category(collections, doc._id, doc.name, doc.category, doc.parent));
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['categories'].ensureIndex({category:1});
        yield collections['categories'].ensureIndex({parent:1});
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Category;
