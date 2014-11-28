var Case = require('../lib/child/case')
  , f = require('util').format
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
  callback();
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