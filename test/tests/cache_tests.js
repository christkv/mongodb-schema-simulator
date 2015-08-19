"use strict";

var co = require('co');

var setup = function(db) {
  var SliceCache = require('../../lib/common/schemas/array_slice/cache');

  // All the collections used
  var collections = {
    cache: db.collection('cache')
  }

  return new Promise(function(resolve, reject) {
    co(function*() {
      try { yield collections['cache'].drop(); } catch(err) {};
      yield SliceCache.createOptimalIndexes(collections);
      resolve();
    }).catch(function(err) {
      reject(err);
    });
  });
}

exports['Should correctly a 5 line cache no pre-allocation'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID
      , MongoClient = configuration.require.MongoClient
      , SliceCache = require('../../lib/common/schemas/array_slice/cache');

    co(function*() {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
        cache: db.collection('cache')
      }

      // Cleanup
      yield setup(db);

      // Cache object
      var cache = new SliceCache(collections, new ObjectID(), 5);
      // Create the cache document on MongoDB
      var cache = yield cache.create();

      // Push 6 items and see the cutoff
      var r = yield cache.push([
          {a:1}, {a:2}, {a:3}
        , {a:4}, {a:5}, {a:6}
      ]);

      // Fetch the cache
      var doc = yield collections['cache'].findOne({_id: cache.id});
      test.equal(5, doc.data.length);
      test.equal(2, doc.data[0].a);
      test.equal(6, doc.data[4].a);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Should correctly a 5 line cache with pre-allocation'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID
      , MongoClient = configuration.require.MongoClient
      , SliceCache = require('../../lib/common/schemas/array_slice/cache');

    co(function*() {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
        cache: db.collection('cache')
      }

      // Cleanup
      yield setup(db);


      // Cache object
      var cache = new SliceCache(collections, new ObjectID(), 5);
      // Create the cache document on MongoDB
      var chache = yield cache.create({a:1});

      // Push 6 items and see the cutoff
      var r = yield cache.push([
        {a:1}, {a:2}, {a:3}
      ]);

      // Fetch the cache
      var doc = yield collections['cache'].findOne({_id: cache.id});
      test.equal(3, doc.data.length);
      test.equal(1, doc.data[0].a);
      test.equal(3, doc.data[2].a);
      test.equal(null, doc.data[4]);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}
