"use strict";

var f = require('util').format;

/*
 * Create a new Timeseries instance
 */
var TimeSeries = function(db, id, tag, series, timestamp, resolution) {
  this.db = db;
  this.id = id;
  this.series = series;
  this.timestamp = timestamp;
  this.tag = tag;
  this.resolution = resolution;
  this.timeseries = this.db.collection('timeseries');
}

/*
 * Create a new timeseries bucket document on mongodb
 */
TimeSeries.prototype.create = function(callback) {
  var self = this;
  // Insert the metadata
  this.timeseries.insertOne({
      _id: this.id
    , tag: this.tag
    , series: this.series || {}
    , timestamp: this.timestamp
    , modifiedOn: new Date()
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Increment a measurement
 */
TimeSeries.prototype.inc = function(time, measurement, callback) {
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

  // Timestamp query
  var timestampQuery = {};

  // Set the start time
  var start = new Date();
  start.setTime(time.getTime());
  start.setSeconds(0);
  start.setMilliseconds(0);

  // Set the end time
  var end = new Date();
  end.setTime(time.getTime());
  end.setMilliseconds(0);

  // Handle the resolution
  if(this.resolution == 'minute') {
    updateStatement['$inc'][f('series.%s', time.getSeconds())] = measurement;

    // Set the end time
    end.setSeconds(59);
  } else if(this.resolution == 'hour') {
    updateStatement['$inc'][f('series.%s.%s', time.getMinutes(), time.getSeconds())] = measurement;

    // Set the minutes
    start.setMinutes(0);
    start.setSeconds(0);

    // Set the end
    end.setMinutes(59);
    end.setSeconds(0);    
  } else if(this.resolution == 'day') {
    updateStatement['$inc'][f('series.%s.%s.%s', time.getHours(), time.getMinutes(), time.getSeconds())] = measurement;

    // Set the minutes
    start.setHours(0)
    start.setMinutes(0);
    start.setSeconds(0);

    // Set the end
    end.setHours(59);
    end.setMinutes(0);
    end.setSeconds(0);    
  }

  // Set up the start and end off the query
  timestampQuery['$lte'] = end;
  timestampQuery['$gte'] = start;

  // Execute the update
  this.timeseries.updateOne({
      _id: this.id
    , timestamp: timestampQuery
  }, updateStatement, { upsert:true }, function(err, r) {
    if(err) return callback(err);
    if(r.result.nUpserted == 0 && r.result.nModified == 0) 
      return callback(new Error(f('could not correctly update or upsert the timeseries document with id %s', self.id)));
    callback(null, self);
  })
}

/*
 * Pre allocate a minute worth of measurements in a document
 */
TimeSeries.preAllocateMinute = function(db, id, tag, timestamp, callback) {
  var series = {};

  for(var i = 0; i < 60; i++) {
    series[i] = 0
  }

  new TimeSeries(db, id, tag, series, timestamp, 'minute').create(callback);
}

/*
 * Pre allocate an hour worth of measurements in a document
 */
TimeSeries.preAllocateHour = function(db, id, tag, timestamp, callback) {
  var series = {};

  // Allocate minutes
  for(var j = 0; j < 60; j++) {
    series[j] = {};

    // Allocate seconds
    for(var i = 0; i < 60; i++) {
      series[j][i] = 0
    }    
  }

  new TimeSeries(db, id, tag, series, timestamp, 'hour').create(callback);
}

/*
 * Pre allocate a day worth of measurements in a document
 */
TimeSeries.preAllocateDay = function(db, id, tag, timestamp, callback) {
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

  new TimeSeries(db, id, tag, series, timestamp, 'day').create(callback);
}

/*
 * Create the optimal indexes for the queries
 */
TimeSeries.createOptimalIndexes = function(db, callback) {
  db.collection('timeseries').ensureIndex({timestamp:1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = TimeSeries;