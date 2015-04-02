"use strict";

var f = require('util').format;

var clone = function(obj) {
  var o = {};
  for(var name in obj) o[name] = obj[name];
  return o;
}

/*
 * Create a new Timeseries instance
 */
var TimeSeries = function(collections, id, tag, series, timestamp, resolution) {
  this.collections = collections;
  this.id = id == null ? new ObjectID() : id;
  this.series = series;
  this.timestamp = timestamp;
  this.tag = tag;
  this.resolution = resolution;
  this.timeseries = collections['timeseries'];
}

/*
 * Create a new timeseries bucket document on mongodb
 */
TimeSeries.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Insert the metadata
  this.timeseries.insertOne({
      _id: this.id
    , tag: this.tag
    , series: this.series || {}
    , timestamp: this.timestamp
    , modifiedOn: new Date()
  }, options, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Increment a measurement
 */
TimeSeries.prototype.inc = function(time, measurement, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Update statement for time series
  var updateStatement = {
      $inc: {}
    , $setOnInsert: {
        tag: this.tag
      , timestamp: this.timestamp
      , resolution: this.resolution
    }
    , $set: {
      modifiedOn: new Date()
    }
  };

  // Handle the resolution
  if(this.resolution == 'minute') {
    updateStatement['$inc'][f('series.%s', time.getSeconds())] = measurement;
  } else if(this.resolution == 'hour') {
    updateStatement['$inc'][f('series.%s.%s', time.getMinutes(), time.getSeconds())] = measurement;
  } else if(this.resolution == 'day') {
    updateStatement['$inc'][f('series.%s.%s.%s', time.getHours(), time.getMinutes(), time.getSeconds())] = measurement;
  }

  // Clone options
  options = clone(options);
  options.upsert = true;

  // Execute the update
  this.timeseries.updateOne({
      _id: this.id
    , tag: this.tag
    , timestamp: this.timestamp
  }, updateStatement, options, function(err, r) {
    if(err) return callback(err);
    if(r.upsertedCount == 0 && r.modifiedCount == 0)
      return callback(new Error(f('could not correctly update or upsert the timeseries document with id %s', self.id)));
    callback(null, self);
  })
}

/*
 * Pre allocate a minute worth of measurements in a document
 */
TimeSeries.preAllocateMinute = function(collections, id, tag, timestamp, callback) {
  var series = {};

  for(var i = 0; i < 60; i++) {
    series[i] = 0
  }

  new TimeSeries(collections, id, tag, series, timestamp, 'minute').create(callback);
}

/*
 * Pre allocate an hour worth of measurements in a document
 */
TimeSeries.preAllocateHour = function(collections, id, tag, timestamp, callback) {
  var series = {};

  // Allocate minutes
  for(var j = 0; j < 60; j++) {
    series[j] = {};

    // Allocate seconds
    for(var i = 0; i < 60; i++) {
      series[j][i] = 0
    }
  }

  new TimeSeries(collections, id, tag, series, timestamp, 'hour').create(callback);
}

/*
 * Pre allocate a day worth of measurements in a document
 */
TimeSeries.preAllocateDay = function(collections, id, tag, timestamp, callback) {
  var series = {};

  // Allocate hours
  for(var k = 0; k < 24; k++) {
    series[k] = {};

    // Allocate minutes
    for(var j = 0; j < 60; j++) {
      series[k][j] = {};

      // Allocate seconds
      for(var i = 0; i < 60; i++) {
        series[k][j][i] = 0
      }
    }
  }

  new TimeSeries(collections, id, tag, series, timestamp, 'day').create(callback);
}

/*
 * Create the optimal indexes for the queries
 */
TimeSeries.createOptimalIndexes = function(collections, callback) {
  collections['timeseries'].ensureIndex({tag: 1, timestamp:1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = TimeSeries;
