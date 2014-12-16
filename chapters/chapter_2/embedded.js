var Case = require('../../lib/child/case')
  , f = require('util').format
  , ObjectId = require('mongodb').ObjectID
  , inherits = require('util').inherits;

var Embedded = function(module, args) {
  if(!(this instanceof Embedded)) return new Embedded();
  Case.call(this, Array.prototype.slice.call(arguments, 0));
  this.args = args;
  this.module = module;
  this.collection = null;
}

// Inherit from Case
inherits(Embedded, Case);

// Pre-allocated array
var _id = new ObjectId();
// Create pre-allocated array
var _b = [];  
for(var i = 0; i < 1000; i++) {
  _b.push(_id)
}

/*
 * Pre-allocate second boxes for the total amount of entries
 */
var preAllocate = function(self, callback) {
  // Total number of preallocations
  self.totalPreallocations = self.args.c * self.args.r;
  var counter = 0;
  var left = self.totalPreallocations;
  // Set the timestamp
  var timestamp = new Date();
  timestamp.setMilliseconds(0);
  timestamp.setSeconds(counter);

  // Insert the pre-allocated documents
  for(var i = 0; i < self.totalPreallocations; i++) {
    // Just using a dummy counter as the timestamp here
    self.collection.insert({
      _id: "" + process.pid + "_" + counter++,
      b: _b
    }, function(err) {
      left = left - 1;

      if(left == 0) {
        self.counter = 0;
        callback();
      }
    });

    // Set the seconds
    timestamp.setSeconds(timestamp.getSeconds() + 1);
  }
}

/*
 * Setup and tear down methods for the embedded class
 */
Embedded.prototype.setup = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Connect to the server
  this.connect(function(err, db) {
    if(err) return callback(err);
    // Set our collection
    self.collection = db.collection(f('embedded'));

    // Drop the collection
    self.collection.drop(function() {
      // Return if trying with no index
      if(self.args.m == 'pre_allocated') 
        return preAllocate(self, callback)

      callback();
    });
  });
}

Embedded.prototype.teardown = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Growing embedded document array to fixed 1000 entries
 */
Embedded.prototype.embedded = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var id = new ObjectId();

  // Number of entries to push into the document
  var number = 1000;
  var self = this;

  // Process all the updates
  var pushToDoc = function(c, id, collection, callback) {
    if(c == 0) return callback();

    collection.updateOne({_id: id}, {$push: {b: {c: id}}}, {w:1}, function(err, r) {
      if(err) return callback(err);
      pushToDoc(c - 1, id, collection, callback);
    });
  }

  // Insert an empty document
  var doc = {_id: id, a:1, b: []};
  this.collection.insert(doc, {w:1}, function(err, r) {
    if(err) return callback(err);
    pushToDoc(number, id, self.collection, callback);
  });
}

/*
 * Growing embedded document array to random sized entries max of 1000
 */
Embedded.prototype.embeddedRandom = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var id = new ObjectId();

  // Number of entries to push into the document
  var number = Math.round(Math.random() * 1000) + 1;
  var self = this;

  // Process all the updates
  var pushToDoc = function(c, id, collection, callback) {
    if(c == 0) return callback();

    collection.updateOne({_id: id}, {$push: {b: {c: id}}}, {w:1}, function(err, r) {
      if(err) return callback(err);
      pushToDoc(c - 1, id, collection, callback);
    });
  }

  // Insert an empty document
  var doc = {_id: id, a:1, b: []};
  this.collection.insert(doc, {w:1}, function(err, r) {
    if(err) return callback(err);
    pushToDoc(number, id, self.collection, callback);
  });
}

/*
 * Adding to pre-allocated embedded document array random sized entries max of 1000
 */
Embedded.prototype.preAllocated = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var id = new ObjectId();
  var self = this;

  // Number of entries to push into the document
  var number = 1000
  var self = this;

  // Process all the updates
  var pushToDoc = function(c, id, collection, callback) {
    if(c == 0) return callback();

    collection.updateOne({_id: "" + process.pid + "_" + c}, {$push: {b: id}}, {w:1}, function(err, r) {
      if(err) return callback(err);
      pushToDoc(c - 1, id, collection, callback);
    });
  }

  // Insert an empty document
  var doc = {_id: id, a:1, b: _b};
  this.collection.insert(doc, {w:1}, function(err, r) {
    if(err) return callback(err);

    // Set empty array (in effect pre-allocating array space)
    self.collection.updateOne({_id: id}, {$set: {b: []}}, {w:1}, function(err, r) {
      if(err) return callback(err);
      pushToDoc(number, id, self.collection, callback);
    });
  });
}

// Export schema
module.exports = {
    abr: 'embedded_growing_list'
  , description: 'Show case growing embedded documents'
  , chapter: 2
  , module: f('%s', __filename)
  , entry: 'start'
  , class: Embedded
  , methods: [{
      name: 'embedded'
    , method: 'embedded'
    , description: 'Growing embedded document array to fixed 1000 entries'
  }, {
      name: 'embedded_random'
    , method: 'embeddedRandom'
    , description: 'Growing embedded document array to random sized entries max of 1000'
  }, {
      name: 'pre_allocated'
    , method: 'preAllocated'
    , description: "Adding 1000 items to pre-allocated embedded document array"
  }]  
}