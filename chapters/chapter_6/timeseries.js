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
  // Used to fill in documents in time series fashion
  this.counter = 0;
  this.second = 0
}

// Inherit from Case
inherits(TimeSeries, Case);

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
      timestamp_minute : timestamp,
      seconds : {
        "0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,
        "10":0,"11":0,"12":0,"13":0,"14":0,"15":0,"16":0,"17":0,"18":0,"19":0,
        "20":0,"21":0,"22":0,"23":0,"24":0,"25":0,"26":0,"27":0,"28":0,"29":0,
        "30":0,"31":0,"32":0,"33":0,"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,
        "40":0,"41":0,"42":0,"43":0,"44":0,"45":0,"46":0,"47":0,"48":0,"49":0,
        "50":0,"51":0,"52":0,"53":0,"54":0,"55":0,"56":0,"57":0,"58":0,"59":0
      }      
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
 * Setup and tear down methods for the TimeSeries class
 */
TimeSeries.prototype.setup = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Total number of preallocations
  self.totalPreallocations = self.args.c * self.args.r;

  // Connect to the server
  this.connect(function(err, db) {
    if(err) return callback(err);
    // Set our collection
    self.collection = db.collection('timeseries');

    // Drop the collection
    self.collection.drop(function() {
      // Return if trying with no index
      if(self.args.m == 'write_pre_allocated' || self.args.m == 'write_pre_allocated_serially') 
        return preAllocate(self, callback)

      callback();
    });
  });
}

TimeSeries.prototype.teardown = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Execute updates in a specific pre-allocated document and second
 */
var executeUpdatesSerially = function(collection, counter, second, callback) {
  // Random number of updates in a particular second
  var numberOfUpdates = Math.round(Math.random() * 100) + 1;

  // Update statement
  var updateStatement = {$inc: {}};
  updateStatement["$inc"]["seconds." + second] = 1;

  // Select the right pre-alloc bucket
  var id = "" + process.pid + "_" + counter;
  
  // Serialize operations
  var next = function(collection, numberLeft, counter, second, callback) {
    if(numberLeft == 0) return callback();

    collection.update({
      _id: id
    }, updateStatement, {upsert:true}, function(err, r) {
      // console.dir(r.result)
      next(collection, numberLeft - 1, counter, second, callback);
    });
  }

  next(collection, numberOfUpdates, counter, second, callback);
}

/*
 * Execute seconds in a specific pre-allocated document and second
 */
var executeSecondsSerially = function(collection, counter, callback) {
  var numberLeft = 60;

  var next = function(collection, numberLeft, counter, i, callback) {
    if(numberLeft == 0) return callback();
    
    executeUpdatesSerially(collection, counter, i, function(err) {
      next(collection, numberLeft - 1, counter, i + 1, callback);
    });    
  }

  next(collection, 60, counter, 0, callback);
}

/*
 * Write time series data with no pre-allocated documents
 */
TimeSeries.prototype.writeNoPrealloc = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  executeSecondsSerially(this.collection, this.counter++, function(err) {
    callback();
  });
}

/*
 * Write time series data with pre-allocated documents for each time series serially
 */
TimeSeries.prototype.writePrealloc = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  executeSecondsSerially(this.collection, this.counter++, function(err) {
    callback();
  });
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
    , method: 'writeNoPrealloc'
    , description: 'Write new random timeSeries documents to disk using growing documents'
  }, {
      name: 'write_pre_allocated'
    , method: 'writePrealloc'
    , description: 'Write new random timeSeries documents to disk using pre_allocated documents with serial execution of writes'
  }]  
}