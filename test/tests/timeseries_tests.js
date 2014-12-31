"use strict";

var setup = function(db, callback) {
  var TimeSeries = require('../../schemas/time_series/timeseries');

  db.collection('timeseries').drop(function() {
    TimeSeries.createOptimalIndexes(db, function(err) {
      callback();
    });
  });
}

exports['Correctly create and execute ten increments on a timeseries object'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        // Create a fake range of one second
        var timestamp = new Date();
        timestamp.setHours(1);
        timestamp.setMinutes(0);
        timestamp.setSeconds(0);

        // Create a new TimeSeries instance
        var timeSeries = new TimeSeries(db, new ObjectId(), 'device1', {}, timestamp, 'minute');
        timeSeries.create(function(err, r) {
          test.equal(null, err);
          // Left to do
          var left = 60;

          // Increment the counters for all seconds
          for(var i = 0; i < 60; i++) {
            var date = new Date();
            date.setHours(1);
            date.setMinutes(0);
            date.setSeconds(i);

            // Increment the point
            timeSeries.inc(date, 1, function(err, r) {
              left = left - 1;

              if(left == 0) {
                // Grab the document and validate correctness
                db.collection('timeseries').findOne({_id: timeSeries.id}, function(err, doc) {
                  test.equal(null, err);
                  test.ok(doc != null);

                  for(var n in doc.series) {
                    test.equal(doc.series[n], 1);
                  }

                  db.close();
                  test.done();
                });
              }
            });
          }
        });
      });
    });
  }
}

exports['Correctly create and execute ten increments on a timeseries object that is pre allocated for minute'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        // Create a fake range of one second
        var timestamp = new Date();
        timestamp.setHours(1);
        timestamp.setMinutes(0);
        timestamp.setSeconds(0);

        // Create a new pre-allocated TimeSeries instance
        TimeSeries.preAllocateMinute(db, new ObjectId(), 'device1', timestamp, function(err, timeSeries) {
          test.equal(null, err);
          test.ok(timeSeries != null);

          var date = new Date();
          date.setHours(1);
          date.setMinutes(0);
          date.setSeconds(1);

          // Increment the point
          timeSeries.inc(date, 1, function(err, r) {
            test.equal(null, err);

            // Grab the document and validate correctness
            db.collection('timeseries').findOne({_id: timeSeries.id}, function(err, doc) {
              test.equal(null, err);
              test.ok(doc != null);
              test.equal(1, doc.series[1]);
              test.equal(0, doc.series[0]);

              db.close();
              test.done();
            });
          });
        });
      });
    });
  }
}

exports['Correctly create and execute ten increments on a timeseries object that is pre allocated for hour'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        // Create a fake range of one second
        var timestamp = new Date();
        timestamp.setHours(0);
        timestamp.setMinutes(0);
        timestamp.setSeconds(0);

        // Create a new pre-allocated TimeSeries instance
        TimeSeries.preAllocateHour(db, new ObjectId(), 'device1', timestamp, function(err, timeSeries) {
          test.equal(null, err);
          test.ok(timeSeries != null);

          var date = new Date();
          date.setHours(0);
          date.setMinutes(0);
          date.setSeconds(1);

          // Increment the point
          timeSeries.inc(date, 1, function(err, r) {
            test.equal(null, err);

            // Grab the document and validate correctness
            db.collection('timeseries').findOne({_id: timeSeries.id}, function(err, doc) {
              test.equal(null, err);
              test.ok(doc != null);

              test.equal(1, doc.series[0][1]);
              test.equal(0, doc.series[0][0]);

              db.close();
              test.done();
            });
          });
        });
      });
    });
  }
}

exports['Correctly create and execute ten increments on a timeseries object that is pre allocated for day'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        // Create a fake range of one second
        var timestamp = new Date();
        timestamp.setDate(10)
        timestamp.setHours(0);
        timestamp.setMinutes(0);
        timestamp.setSeconds(0);

        // Create a new pre-allocated TimeSeries instance
        TimeSeries.preAllocateDay(db, new ObjectId(), 'device1', timestamp, function(err, timeSeries) {
          test.equal(null, err);
          test.ok(timeSeries != null);

          var date = new Date();
          date.setDate(10)
          date.setHours(0);
          date.setMinutes(0);
          date.setSeconds(1);

          // Increment the point
          timeSeries.inc(date, 1, function(err, r) {
            test.equal(null, err);

            // Grab the document and validate correctness
            db.collection('timeseries').findOne({_id: timeSeries.id}, function(err, doc) {
              test.equal(null, err);
              test.ok(doc != null);

              test.equal(1, doc.series[0][0][1]);
              test.equal(0, doc.series[0][0][0]);

              db.close();
              test.done();
            });
          });
        });
      });
    });
  }
}

exports['Set up 1000 time slots and ensureIndex'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var TimeSeries = require('../../schemas/time_series/timeseries')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        var left = 1000;

        TimeSeries.createOptimalIndexes(db, function(err, r) {
          test.equal(null, err);

          for(var i = 0; i < 1000; i++) {
            var timestamp = new Date();
            timestamp.setMinutes(i);
            timestamp.setSeconds(0);

            // Create a new minute allocation
            TimeSeries.preAllocateMinute(db, new ObjectId(), 'device1', timestamp, function(err, r) {
              test.equal(null, err);
              left = left - 1;

              if(left == 0) {
                db.close();
                test.done();
              }
            });
          }
        });
      });
    });
  }
}