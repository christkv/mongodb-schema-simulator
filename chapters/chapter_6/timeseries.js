var Case = require('../../lib/child/case')
  , f = require('util').format
  , ObjectId = require('mongodb').ObjectID
  , crypto = require('crypto')
  , inherits = require('util').inherits;

var TimeSeries = function(module, args) {
  if(!(this instanceof TimeSeries)) return new TimeSeries();
  Case.call(this, Array.prototype.slice.call(arguments, 0));
  this.args = args;
  this.module = module;
  this.collection = null;

  // Iterate
  this.read = 0;
  this.ratio = 3;
  // Pick a random counter
  this.counter = Math.round(Math.random() * 100000);
  this.originalStart = this.counter;
}

// Inherit from Case
inherits(TimeSeries, Case);

/*
 * Setup and tear down methods for the TimeSeries class
 */
TimeSeries.prototype.setup = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Connect to the server
  this.connect(function(err, db) {
    if(err) return callback(err);
    // Set our collection
    self.collection = db.collection('timeseries');
    callback();
  });
}

TimeSeries.prototype.teardown = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Mix read and writes of documents to disk 50/50, single document fetch by TimeSeries key
 */
TimeSeries.prototype.write = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

// Export schema
module.exports = {
    abr: 'time_series'
  , description: 'Show case Time Series pattern'
  , chapter: 2
  , module: f('%s', __filename)
  , entry: 'start'
  , class: TimeSeries
  , methods: [{
      name: 'write_no_prealloc'
    , method: 'write'
    , description: 'Write new random timeSeries documents to disk using growing documents'
  }, {
      name: 'write_pre_allocated'
    , method: 'readWrite'
    , description: 'Write new random timeSeries documents to disk using pre_allocated documents'
  }]  
}