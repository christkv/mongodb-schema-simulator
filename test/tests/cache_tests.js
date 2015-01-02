"use strict";

var setup = function(db, callback) {
  var SliceCache = require('../../schemas/array_slice/cache');

  db.collection('cache').drop(function() {
    SliceCache.createOptimalIndexes(db, function() {
      callback();
    });
  });
}

exports['Should correctly a 5 line cache no pre-allocation'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID
      , MongoClient = configuration.require.MongoClient
      , SliceCache = require('../../schemas/array_slice/cache');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        var cache = new SliceCache(db, new ObjectID(), 5);
        cache.create(function(err, cache) {
          test.equal(null, err);

          // Push 6 items and see the cutoff
          cache.push([
              {a:1}, {a:2}, {a:3}
            , {a:4}, {a:5}, {a:6}
          ], function(err, r) {
            test.equal(null, err);

            // Fetch the cache
            db.collection('cache').findOne({_id: cache.id}, function(err, doc) {
              test.equal(null, err);
              test.equal(5, doc.data.length);
              test.equal(2, doc.data[0].a);
              test.equal(6, doc.data[4].a);

              db.close();
              test.done();
            });
          });
        });
      });
    });
  }
}

exports['Should correctly a 5 line cache with pre-allocation'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID
      , MongoClient = configuration.require.MongoClient
      , SliceCache = require('../../schemas/array_slice/cache');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        var cache = new SliceCache(db, new ObjectID(), 5);
        cache.create({a:1}, function(err, cache) {
          test.equal(null, err);

          // Push 6 items and see the cutoff
          cache.push([
            {a:1}, {a:2}, {a:3}            
          ], function(err, r) {
            test.equal(null, err);

            // Fetch the cache
            db.collection('cache').findOne({_id: cache.id}, function(err, doc) {
              test.equal(null, err);
              test.equal(3, doc.data.length);
              test.equal(1, doc.data[0].a);
              test.equal(3, doc.data[2].a);
              test.equal(null, doc.data[4]);

              db.close();
              test.done();
            });
          });
        });
      });
    });
  }
}
