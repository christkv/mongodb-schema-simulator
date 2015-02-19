"use strict";

var setup = function(db, callback) {
  var Queue = require('../../schemas/queue/queue')
    , Topic = require('../../schemas/queue/topic');

  // All the collections used
  var collections = {
      queues: db.collection('queues')
    , topics: db.collection('topics')
  }

  collections['queues'].drop(function() {
    collections['topics'].drop(function() {
      Queue.createOptimalIndexes(collections, function(err) {
        Topic.createOptimalIndexes(collections, function(err) {
          callback();
        });
      });
    });
  });
}

exports['Should correctly insert job into queue'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var Queue = require('../../schemas/queue/queue')
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          queues: db.collection('queues')
        , topics: db.collection('topics')
      }

      // Cleanup
      setup(db, function() {
        // Create a queue
        var queue = new Queue(collections);
        // Add some items to queue
        var addToQueue = function(callback) {
          queue.publish(1, {work:1}, function(err) {
            test.equal(null, err);

            queue.publish(5, {work:2}, function(err) {
              test.equal(null, err);
                
              queue.publish(3, {work:3}, function(err) {
                test.equal(null, err);
                callback();
              });
            });
          });
        }

        // Add the queues
        addToQueue(function() {
          queue.fetchByPriority(function(err, work) {
            test.equal(null, err)
            test.ok(work != null);
            test.equal(5, work.doc.priority);

            queue.fetchFIFO(function(err, work) {
              test.equal(null, err)
              test.ok(work != null);
              test.equal(1, work.doc.priority);

              db.close();
              test.done();
            });
          });
        });
      })
    });
  }
}

exports['Should correctly insert job into queue no findAndModify'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var Queue = require('../../schemas/queue/queue')
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          queues: db.collection('queues1')
        , topics: db.collection('topics1')
      }

      // Cleanup
      setup(db, function() {
        // Create a queue
        var queue = new Queue(collections);
        // Add some items to queue
        var addToQueue = function(callback) {
          queue.publish(1, {work:1}, function(err) {
            test.equal(null, err);

            queue.publish(5, {work:2}, function(err) {
              test.equal(null, err);
                
              queue.publish(3, {work:3}, function(err) {
                test.equal(null, err);
                callback();
              });
            });
          });
        }

        // Add the queues
        addToQueue(function() {
          queue.fetchByPriorityNoFindAndModify(function(err, work) {
            test.equal(null, err)
            test.ok(work != null);
            test.equal(5, work.doc.priority);

            queue.fetchFIFONoFindAndModify(function(err, work) {
              test.equal(null, err)
              test.ok(work != null);
              test.equal(1, work.doc.priority);

              db.close();
              test.done();
            });
          });
        });
      })
    });
  }
}

exports['Should correctly insert job into topic and listen to it'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var Topic = require('../../schemas/queue/topic')
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          queues: db.collection('queues2')
        , topics: db.collection('topics2')
      }

      // Cleanup
      setup(db, function() {
        // Create a queue
        var topic = new Topic(collections, 10000, 10000);
        topic.create(function(err, topic) {
          test.equal(null, err);
          test.ok(topic != null);
          
          // Add some items to queue
          var addToTopic = function(callback) {
            topic.publish({work:1}, function(err) {
              test.equal(null, err);

              topic.publish({work:2}, function(err) {
                test.equal(null, err);
                  
                topic.publish({work:3}, function(err) {
                  test.equal(null, err);
                  callback();
                });
              });
            });
          }

          // Add the queues
          addToTopic(function() {
            var docs = [];
            var cursor = topic.listen();
            cursor.on('data', function(doc) {
              docs.push(doc);
            });

            cursor.on('end', function() {
              test.equal(3, docs.length);

              db.close();
              test.done();
            });
          });
        });
      });
    });
  }
}