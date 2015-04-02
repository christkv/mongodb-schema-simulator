"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID;

/*
 * Create a new category instance
 */
var Category = function(collections, id, name, category, parent) {
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
Category.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Insert a new category
  this.categories.insertOne({
      _id: this.id
    , name: this.name
    , category: this.category
    , parent: this.parent
  }, options, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Find all direct children categories of a provided category path
 */
Category.findAllDirectChildCategories = function(collections, path, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

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
    return cursor.toArray(function(err, docs) {
      if(err) return callback(err);

      // Map all the docs to category instances
      callback(null, docs.map(function(x) {
        return new Category(collections, x._id, x.name, x.category, x.parent);
      }))
    });    
  }

  // Locate all the categories
  var cursor = collections['categories'].find({parent: regexp});

  if(options.readPreference) {
    cursor.setReadPreference(options.readPreference);
  }

  cursor.toArray(function(err, docs) {
    if(err) return callback(err);

    // Map all the docs to category instances
    callback(null, docs.map(function(x) {
      return new Category(collections, x._id, x.name, x.category, x.parent);
    }))
  });
}

/*
 * Find all children categories below the provided category path
 */
Category.findAllChildCategories = function(collections, path, options, callback) {
  var self = this;
  if(typeof options == 'function') callback = options, options = {};
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
    return cursor.toArray(function(err, docs) {
      if(err) return callback(err);

      // Map all the docs to category instances
      callback(null, docs.map(function(x) {
        return new Category(collections, x._id, x.name, x.category, x.parent);
      }));
    });  
  }

  // Locate all the categories
  var cursor = collections['categories'].find({parent: regexp});

  if(options.readPreference) {
    cursor.setReadPreference(options.readPreference);
  }

  cursor.toArray(function(err, docs) {
    if(err) return callback(err);

    // Map all the docs to category instances
    callback(null, docs.map(function(x) {
      return new Category(collections, x._id, x.name, x.category, x.parent);
    }));
  });  
}

/*
 * Find a specific category by it's path
 */
Category.findOne = function(collections, path, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var coveredIndex = typeof options.coveredIndex == 'boolean' ? options.coveredIndex : false;

  // Execute as covered index
  if(coveredIndex) {
    options['fields'] = {_id: 0, name: 1, category:1, parent:1};
    // Locate all the categories
    return collections['categories'].findOne({category: path}
      , options , function(err, doc) {
        if(err) return callback(err);
        if(!doc) return callback(new Error(f('could not locate category with path %s', path)));
        callback(null, new Category(collections, doc._id, doc.name, doc.category, doc.parent));
    })  
  }

  var finalOptions = {};
  if(options.readPreference) {
    finalOptions.readPreference = options.readPreference;
  }

  // Locate all the categories
  collections['categories'].findOne({category: path}, finalOptions, function(err, doc) {
    if(err) return callback(err);
    if(!doc) return callback(new Error(f('could not locate category with path %s', path)));
    callback(null, new Category(collections, doc._id, doc.name, doc.category, doc.parent));
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
Category.createOptimalIndexes = function(collections, callback) {
  collections['categories'].ensureIndex({category:1}, function(err, result) {
    if(err) return callback(err);

    collections['categories'].ensureIndex({parent:1}, function(err, result) {
      if(err) return callback(err);
      callback();
    });
  });
}

module.exports = Category;