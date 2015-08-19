"use strict";

var co = require('co');

var setup = function(db, callback) {
  var TimeSeries = require('../../lib/common/schemas/time_series/timeseries');

  // All the collections used
  var collections = {
    timeseries: db.collection('timeseries')
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      try { yield collections['timeseries'].drop(); } catch(err) {};
      yield TimeSeries.createOptimalIndexes(collections);
      resolve();
    }).catch(reject);
  });
}

exports['Correctly create and execute ten increments on a timeseries object'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../lib/common/schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
        timeseries: db.collection('timeseries')
      }

      // Cleanup
      yield setup(db);

      // Create a fake range of one second
      var timestamp = new Date();
      timestamp.setHours(1);
      timestamp.setMinutes(0);
      timestamp.setSeconds(0);

      // Create a new TimeSeries instance
      var timeSeries = new TimeSeries(collections, new ObjectId(), 'device1', {}, timestamp, 'minute');
      yield timeSeries.create();

      // Increment the counters for all seconds
      for(var i = 0; i < 60; i++) {
        var date = new Date();
        date.setHours(1);
        date.setMinutes(0);
        date.setSeconds(i);

        // Increment the point
        yield timeSeries.inc(date, 1);

        // Grab the document and validate correctness
        var doc = yield collections['timeseries'].findOne({_id: timeSeries.id});
        test.ok(doc != null);

        for(var n in doc.series) {
          test.equal(doc.series[n], 1);
        }
      }

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Correctly create and execute ten increments on a timeseries object that is pre allocated for minute'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../lib/common/schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
        timeseries: db.collection('timeseries')
      }

      // Cleanup
      yield setup(db);

      // Create a fake range of one second
      var timestamp = new Date();
      timestamp.setHours(1);
      timestamp.setMinutes(0);
      timestamp.setSeconds(0);

      // Create a new pre-allocated TimeSeries instance
      var timeSeries = yield TimeSeries.preAllocateMinute(collections, new ObjectId(), 'device1', timestamp);
      test.ok(timeSeries != null);

      var date = new Date();
      date.setHours(1);
      date.setMinutes(0);
      date.setSeconds(1);

      // Increment the point
      yield timeSeries.inc(date, 1);

      // Grab the document and validate correctness
      var doc = yield collections['timeseries'].findOne({_id: timeSeries.id});
      test.ok(doc != null);
      test.equal(1, doc.series[1]);
      test.equal(0, doc.series[0]);

      db.close();
      test.done();
    }).catch(function(err) {
      console.log(err.stack)
      process.nextTick(function() {throw err});
    });
  }
}

exports['Correctly create and execute ten increments on a timeseries object that is pre allocated for hour'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../lib/common/schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
        timeseries: db.collection('timeseries')
      }

      // Cleanup
      yield setup(db);

      // Create a fake range of one second
      var timestamp = new Date();
      timestamp.setHours(0);
      timestamp.setMinutes(0);
      timestamp.setSeconds(0);

      // Create a new pre-allocated TimeSeries instance
      var timeSeries = yield TimeSeries.preAllocateHour(collections, new ObjectId(), 'device1', timestamp);
      test.ok(timeSeries != null);

      var date = new Date();
      date.setHours(0);
      date.setMinutes(0);
      date.setSeconds(1);

      // Increment the point
      yield timeSeries.inc(date, 1);

      // Grab the document and validate correctness
      var doc = yield collections['timeseries'].findOne({_id: timeSeries.id});
      test.ok(doc != null);

      test.equal(1, doc.series[0][1]);
      test.equal(0, doc.series[0][0]);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Correctly create and execute ten increments on a timeseries object that is pre allocated for day'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../lib/common/schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
        timeseries: db.collection('timeseries')
      }

      // Cleanup
      yield setup(db);

      // Create a fake range of one second
      var timestamp = new Date();
      timestamp.setDate(10)
      timestamp.setHours(0);
      timestamp.setMinutes(0);
      timestamp.setSeconds(0);

      // Create a new pre-allocated TimeSeries instance
      var timeSeries = yield TimeSeries.preAllocateDay(collections, new ObjectId(), 'device1', timestamp);
      test.ok(timeSeries != null);

      var date = new Date();
      date.setDate(10)
      date.setHours(0);
      date.setMinutes(0);
      date.setSeconds(1);

      // Increment the point
      yield timeSeries.inc(date, 1);

      // Grab the document and validate correctness
      var doc = yield collections['timeseries'].findOne({_id: timeSeries.id});
      test.ok(doc != null);

      test.equal(1, doc.series[0][0][1]);
      test.equal(0, doc.series[0][0][0]);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Set up 1000 time slots and ensureIndex'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../lib/common/schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
        timeseries: db.collection('timeseries')
      }

      // Cleanup
      yield setup(db);

      var left = 1000;

      yield TimeSeries.createOptimalIndexes(collections);

      for(var i = 0; i < 1000; i++) {
        var timestamp = new Date();
        timestamp.setMinutes(i);
        timestamp.setSeconds(0);

        // Create a new minute allocation
        yield TimeSeries.preAllocateMinute(collections, new ObjectId(), 'device1', timestamp);
      }

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}
