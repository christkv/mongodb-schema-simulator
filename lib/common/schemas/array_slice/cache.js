"use strict";

var f = require('util').format
  , co = require('co')
  , ObjectID = require('mongodb').ObjectID;

/*
  Uses $slice to keep the latest X number of items in the cache avoiding
  growing documents

  Allow for layered cache

  a positive sliceAt will slice from the front and a negative from the end

  ex:
    var array =  [ 40, 50, 60 ]
    var sliceAt = -5
    var items = [ 80, 78, 86 ]
    var result = [  50,  60,  80,  78,  86 ]

    var array =  [ 89, 90 ]
    var sliceAt = 3
    var items = [ 100, 20 ]
    var result = [  89,  90,  100 ]
*/
class SliceCache {
  constructor(collections, id, sliceAt) {
    this.id = id == null ? new ObjectID() : id;
    this.collections = collections;
    this.sliceAt = sliceAt;
    this.cache = collections['cache'];
  }

  /*
   * Create a new cache entry with optional pre-allocation
   */
  create(object) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Pre-allocated array
        var data = [];

        // If we have an object we can pre-allocate the maximum array size
        if(object) {
          // Create array of max object size
          for(var i = 0; i < self.sliceAt; i++) {
            data.push(object);
          }
        }

        // Insert the metadata
        var r = yield self.cache.insertOne({
            _id: self.id
          , sliceAt: self.sliceAt
          , data: data
        });

        // If we have an object, remove the array with an
        // update leaving the document pre-allocated
        if(!object) return resolve(self);

        // Remove array (keeps the document in place with pre-allocated space)
        var r = yield self.cache.updateOne({
          _id: self.id
        }, { $set: { data: [] } })

        if(r.modifiedCount == 0)
          return reject(new Error(f('failed to clear out pre-allocated array for object %s', self.id)));

        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Push the object to the end of the list keeping in mind our slice option
   */
  push(items, position, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Treat this as an array operation
        if(!Array.isArray(items)) {
          items = [items];
        }

        // The push operation
        var pushOperation =  {
          data: {
              $each: items
            , $slice: -self.sliceAt
          }
        }

        // We provided a position for adding the items
        if(typeof position == 'number') {
          pushOperation.data['$position'] = position;
        }

        // Push and slice
        var r = yield self.cache.updateOne({
          _id: self.id
        }, {
          $push: pushOperation
        }, options);

        if(r.modifiedCount == 0)
          return callback(new Error(f('failed to push items to cache object with id %s', self.id)));

        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(cachesCollection, options) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }
}


// var SliceCache = function(collections, id, sliceAt) {
//   this.id = id == null ? new ObjectID() : id;
//   this.collections = collections;
//   this.sliceAt = sliceAt;
//   this.cache = collections['cache'];
// }

// /*
//  * Create a new cache entry with optional pre-allocation
//  */
// SliceCache.prototype.create = function(object, callback) {
//   var self = this;
//
//   // Make sure we have the callback
//   if(typeof object == 'function') callback = object, object = null;
//
//   // Pre-allocated array
//   var data = [];
//
//   // If we have an object we can pre-allocate the maximum array size
//   if(object) {
//     // Create array of max object size
//     for(var i = 0; i < this.sliceAt; i++) {
//       data.push(object);
//     }
//   }
//
//   // Insert the metadata
//   this.cache.insertOne({
//       _id: this.id
//     , sliceAt: this.sliceAt
//     , data: data
//   }, function(err, r) {
//     if(err) return callback(err);
//
//     // If we have an object, remove the array with an
//     // update leaving the document pre-allocated
//     if(!object) return callback(null, self);
//
//     // Remove array (keeps the document in place with pre-allocated space)
//     self.cache.updateOne({
//       _id: self.id
//     }, { $set: { data: [] } }, function(err, r) {
//       if(err) return callback(err);
//       if(r.modifiedCount == 0) return callback(new Error(f('failed to clear out pre-allocated array for object %s', self.id)));
//       callback(null, self);
//     });
//   });
// }

// /*
//  * Push the object to the end of the list keeping in mind our slice option
//  */
// SliceCache.prototype.push = function(items, position, options, callback) {
//   var self = this;
//   // Handle optional position parameter
//   if(typeof options == 'function') {
//     callback = options;
//     options = typeof position == 'number' ? {} : position;
//   } else if(typeof position == 'function') {
//     callback = position, position = null;
//     options = {};
//   }
//   // Treat this as an array operation
//   if(!Array.isArray(items)) {
//     items = [items];
//   }
//
//   // The push operation
//   var pushOperation =  {
//     data: {
//         $each: items
//       , $slice: -this.sliceAt
//     }
//   }
//
//   // We provided a position for adding the items
//   if(typeof position == 'number') {
//     pushOperation.data['$position'] = position;
//   }
//
//   // Push and slice
//   this.cache.updateOne({
//     _id: this.id
//   }, {
//     $push: pushOperation
//   }, options, function(err, r) {
//     if(err) return callback(err);
//     if(r.modifiedCount == 0) return callback(new Error(f('failed to push items to cache object with id %s', self.id)));
//     callback(null, self);
//   });
// }
//
// /*
//  * Create the optimal indexes for the queries
//  */
// SliceCache.createOptimalIndexes = function(cachesCollection, callback) {
//   callback();
// }

module.exports = SliceCache;
