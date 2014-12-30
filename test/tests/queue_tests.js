var setup = function(db, callback) {
  var Queue = require('../../schemas/queue/queue')
    , Topic = require('../../schemas/queue/topic');

  db.collection('queues').drop(function() {
    db.collection('topics').drop(function() {
      Queue.createOptimalIndexes(db, function(err) {
        Topic.createOptimalIndexes(db, function(err) {
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
      , Topic = require('../../schemas/queue/topic')
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        // Create a queue
        var queue = new Queue(db, 'queues', 'work');
        // Add some items to queue
        var addQueues = function(callback) {
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
        addQueues(function() {
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