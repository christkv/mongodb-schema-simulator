"use strict";

var co = require('co');

var setup = function(db, callback) {
  var Queue = require('../../lib/common/schemas/queue/queue')
    , Topic = require('../../lib/common/schemas/queue/topic');

  // All the collections used
  var collections = {
      queues: db.collection('queues')
    , queues2: db.collection('queues2')
    , topics: db.collection('topics')
    , topics2: db.collection('topics2')
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      try { yield collections['queues'].drop(); } catch(err) {};
      try { yield collections['queues2'].drop(); } catch(err) {};
      try { yield collections['topics'].drop(); } catch(err) {};
      try { yield collections['topics2'].drop(); } catch(err) {};
      yield Queue.createOptimalIndexes(collections);
      yield Topic.createOptimalIndexes(collections);
      resolve();
    }).catch(reject);
  });
}

exports['Should correctly insert job into queue'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Queue = require('../../lib/common/schemas/queue/queue')
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          queues: db.collection('queues')
        , topics: db.collection('topics')
      }

      // Cleanup
      yield setup(db);
      // Create a queue
      var queue = new Queue(collections);

      // Add some items to queue
      var addToQueue = function() {
        return new Promise(function(resolve, reject) {
          co(function* () {
            yield queue.publish(1, {work:1});
            yield queue.publish(5, {work:2});
            yield queue.publish(3, {work:3});
            resolve();
          }).catch(reject);
        });
      }

      // Add the queues
      yield addToQueue();
      var work = yield queue.fetchByPriority();
      test.ok(work != null);
      test.equal(5, work.doc.priority);

      var work = yield queue.fetchFIFO();
      test.ok(work != null);
      test.equal(1, work.doc.priority);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Should correctly insert job into topic and listen to it'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Topic = require('../../lib/common/schemas/queue/topic')
      , MongoClient = require('mongodb').MongoClient;


    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          queues: db.collection('queues2')
        , topics: db.collection('topics2')
      }

      // Cleanup
      yield setup(db);

      // Create a queue
      var topic = new Topic(collections, 10000, 10000);
      yield topic.create()
      test.ok(topic != null);

      // Add some items to queue
      var addToTopic = function(callback) {
        return new Promise(function(resolve, reject) {
          co(function* () {
            yield topic.publish({work:1});
            yield topic.publish({work:2});
            yield topic.publish({work:3});
            resolve();
          }).catch(reject);
        });
      }

      // Add the queues
      yield addToTopic();

      // Set the timeout
      setTimeout(function() {
        var docs = [];
        var cursor = topic.listen(null, {awaitData: false});
        cursor.on('data', function(doc) {
          docs.push(doc);
        });

        cursor.on('end', function() {
          test.equal(3, docs.length);

          db.close();
          test.done();
        });
      }, 2000);
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}
