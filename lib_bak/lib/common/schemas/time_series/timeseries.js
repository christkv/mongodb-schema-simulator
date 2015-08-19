"use strict";

var f = require('util').format,
  co = require('co');

var clone = function(obj) {
  var o = {};
  for(var name in obj) o[name] = obj[name];
  return o;
}

/*
 * Create a new Timeseries instance
 */
class TimeSeries {
  constructor(collections, id, tag, series, timestamp, resolution) {
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
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Insert the metadata
        yield self.timeseries.insertOne({
            _id: self.id
          , tag: self.tag
          , series: self.series || {}
          , timestamp: self.timestamp
          , modifiedOn: new Date()
        }, options);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Increment a measurement
   */
  inc(time, measurement, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Update statement for time series
        var updateStatement = {
            $inc: {}
          , $setOnInsert: {
              tag: self.tag
            , timestamp: self.timestamp
            , resolution: self.resolution
          }
          , $set: {
            modifiedOn: new Date()
          }
        };

        // Handle the resolution
        if(self.resolution == 'minute') {
          updateStatement['$inc'][f('series.%s', time.getSeconds())] = measurement;
        } else if(self.resolution == 'hour') {
          updateStatement['$inc'][f('series.%s.%s', time.getMinutes(), time.getSeconds())] = measurement;
        } else if(self.resolution == 'day') {
          updateStatement['$inc'][f('series.%s.%s.%s', time.getHours(), time.getMinutes(), time.getSeconds())] = measurement;
        }

        // Clone options
        options = clone(options);
        options.upsert = true;

        // Execute the update
        var r = yield self.timeseries.updateOne({
            _id: self.id
          , tag: self.tag
          , timestamp: self.timestamp
        }, updateStatement, options);

        if(r.upsertedCount == 0 && r.modifiedCount == 0)
          return reject(new Error(f('could not correctly update or upsert the timeseries document with id %s', self.id)));

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Pre allocate a minute worth of measurements in a document
   */
  static preAllocateMinute(collections, id, tag, timestamp) {
    var series = {};

    for(var i = 0; i < 60; i++) {
      series[i] = 0
    }

    return new Promise(function(resolve, reject) {
      co(function* () {
        var timeSeries = new TimeSeries(collections, id, tag, series, timestamp, 'minute');
        yield timeSeries.create();
        resolve(timeSeries);
      }).catch(reject);
    });
  }

  /*
   * Pre allocate an hour worth of measurements in a document
   */
  static preAllocateHour(collections, id, tag, timestamp) {
    var series = {};

    // Allocate minutes
    for(var j = 0; j < 60; j++) {
      series[j] = {};

      // Allocate seconds
      for(var i = 0; i < 60; i++) {
        series[j][i] = 0
      }
    }

    return new Promise(function(resolve, reject) {
      co(function* () {
        var timeSeries = new TimeSeries(collections, id, tag, series, timestamp, 'hour');
        yield timeSeries.create();
        resolve(timeSeries);
      }).catch(reject);
    });
  }

  /*
   * Pre allocate a day worth of measurements in a document
   */
  static preAllocateDay(collections, id, tag, timestamp) {
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

    return new Promise(function(resolve, reject) {
      co(function* () {
        var timeSeries = new TimeSeries(collections, id, tag, series, timestamp, 'day');
        yield timeSeries.create();
        resolve(timeSeries);
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['timeseries'].ensureIndex({tag: 1, timestamp:1});
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = TimeSeries;
