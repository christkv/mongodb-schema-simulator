var Case = require('../lib/child/case')
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
    self.collection = db.collection(f('embedded_%s', process.pid));
    // Return after setup
    callback();
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
  callback();
}

/*
 * Adding to pre-allocated embedded document array random sized entries max of 1000
 */
Embedded.prototype.preAllocated = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

module.exports = Embedded;