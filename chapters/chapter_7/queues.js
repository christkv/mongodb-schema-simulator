var Case = require('../../lib/child/case')
  , f = require('util').format
  , ObjectId = require('mongodb').ObjectID
  , crypto = require('crypto')
  , inherits = require('util').inherits;

var Queues = function(module, args) {
  if(!(this instanceof Queues)) return new Queues();
  Case.call(this, Array.prototype.slice.call(arguments, 0));
  this.args = args;
  this.module = module;
  this.collection = null;
  // Used to fill in documents in time series fashion
  this.counter = 0;
}

// Inherit from Case
inherits(Queues, Case);

/*
 * Setup and tear down methods for the Queues class
 */
Queues.prototype.setup = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Connect to the server
  this.connect(function(err, db) {
    if(err) return callback(err);
    
    // Set our collection
    self.collection = db.collection('queues');

    // Drop the collection
    self.collection.drop(function() {
      callback();
    });
  });
}

Queues.prototype.teardown = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Single queue writer and multiple readers
 */
Queues.prototype.singleWriterMultipleReaders = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Multiple queue writer and multiple readers
 */
Queues.prototype.multipleWritersMultipleReaders = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Multiple queue writer and single reader
 */
Queues.prototype.multipleWritersAndSingleReader = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

// Export schema
module.exports = {
    abr: 'queues'
  , description: 'Show case Queue patterns'
  , chapter: 2
  , module: f('%s', __filename)
  , entry: 'start'
  , class: Queues
  , methods: [{
      name: '1_writers_n_readers'
    , method: 'singleWriterMultipleReaders'
    , description: 'Single queue writer and multiple readers'
  }, {
      name: 'n_writers_m_readers'
    , method: 'multipleWritersMultipleReaders'
    , description: 'Multiple queue writer and multiple readers'
  }, {
      name: 'm_writers_s_readers'
    , method: 'multipleWritersAndSingleReader'
    , description: 'Multiple queue writer and single reader'
  }]  
}