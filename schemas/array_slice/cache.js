"use strict";

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
var SliceCache = function(db, id, sliceAt) {
  this.db = db;
  this.id = id;
  this.sliceAt = sliceAt;
  this.cache = this.db.collection('cache');
}

/*
 * Create a new cache entry with optional pre-allocation
 */
SliceCache.prototype.create = function(object, callback) {
  var self = this;

  // Make sure we have the callback
  if(typeof object == 'function') callback = object, object = null;

  // Pre-allocated array
  var data = [];

  // If we have an object we can pre-allocate the maximum array size
  if(object) {
    // Create array of max object size
    for(var i = 0; i < this.sliceAt; i++) {
      data.push(object);
    }
  }

  // Insert the metadata
  this.cache.insertOne({
      _id: this.id
    , sliceAt: this.sliceAt
    , data: data
  }, function(err, r) {
    if(err) return callback(err);

    // If we have an object, remove the array with an
    // update leaving the document pre-allocated
    if(!object) return callback(null, self);

    // Remove array
    this.cache.updateOne({
      _id: self.id
    }, { $set: { data: [] } }, function(err, r) {
      if(err) return callback(err);
      if(r.modifiedCount == 0) return callback(new Error(f('failed to clear out pre-allocated array for object %s', self.id)));
      callback(null, self);
    });
  });
}

/*
 * Push the object to the end of the list keeping in mind our slice option
 */
SliceCache.prototype.push = function(items, position, callback) {
  var self = this;
  // Handle optional position parameter
  if(typeof position == 'function') callback = position, position = null;
  // Treat this as an array operation
  if(!Array.isArray(items)) {
    items = [items];
  }

  // The push operation
  var pushOperation =  {
    data: {
        $each: items
      , $slice: this.sliceAt
    }
  }

  // We provided a position for adding the items
  if(typeof position == 'number') {
    pushOperation.data['$position'] position;
  }

  // Push and slice
  this.cache.updateOne({
    _id: this.id
  }, { 
    $push: pushOperation
  }, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('failed to push items to cache object with id %s', self.id)));
    callback(null, self);
  });
}

module.exports = SliceCache;