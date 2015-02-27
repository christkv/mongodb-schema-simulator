var microtime = require('microtime')
  , f = require('util').format
  , fs = require('fs');
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

/*
 * Publish message to queue
 */
scenarios.push({
    name: 'publish_to_queues'
  , title: 'exercise queues schema'
  , description: 'exercise queues schema'
  , params: {
    // Number of queues to read from
    numberOfQueues: {
        name: 'number of queues to read from'
      , type: 'number'
      , default: 10
    }
    // Range of priorities
    , priorityRange: {
        name: 'range of priority'
      , type: 'number'
      , default: 10
    }
    // Default work object template
    , workObject: {
        name: 'default work object template'
      , type: 'object'
      , default: {}
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient
      , Binary = require('mongodb').Binary;

    // Default collection names
    var collections = {
      queues: 'queues'
    }

    // Get all the schemas
    var Queue = require('../schemas/queue/queue');

    // Db instance
    var db = null;

    // Unpack the parameters
    var numberOfQueues = schema.schema.params.numberOfQueues;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
        queues: db.collection(collectionNames.queues || 'queues')
      }

      // Create any indexes
      Queue.createOptimalIndexes(collections, function(err) {
        // Create indexes for all the collections
        var left = numberOfQueues;

        // Iterate over all the files
        for(var i = 0; i < numberOfQueues; i++) {
          // Create any indexes
          Queue.createOptimalIndexes({
            queues: db.collection(f('queue_%s', i))
          }, function(err) {
            left = left - 1;
            if(left == 0) callback();
          });
        }
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfQueues = schema.schema.params.numberOfQueues;
      var workObject = schema.schema.params.workObject;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(scenario.url, {
          server: { poolSize: 1 }
        , replSet: { poolSize: 1 }
        , mongos: { poolSize: 1 }
      }, function(err, db) {
        if(err) return callback(err);

        // Collections
        var cols = {
          queues: db.collection(collections.queues || 'queues')
        }

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          var left = numberOfQueues;
          // Create queue collections
          for(var i = 0; i < numberOfQueues; i++) {
            db.createCollection(f('queue_%s', i), function(err, c) {
              left = left - 1;
              if(left == 0) callback()
            });
          }
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalTeardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.setup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      var self = this;
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        if(err) return callback(err);
        db = schema.db ? instance.db(schema.db) : instance;
        self.index = 0;
        callback();
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};

      // Get all the values
      var workObject = schema.schema.params.workObject;
      var priorityRange = schema.schema.params.priorityRange;
      var numberOfQueues = schema.schema.params.numberOfQueues;
      // Adjust the index
      this.index = (this.index + 1) % numberOfQueues

      // Get a queue
      var queue = new Queue({queues: db.collection(f('queue_%s', this.index))});

      // Operation start time
      var startTime = microtime.now();

      // Get a specific set of children
      queue.publish(Math.round(priorityRange * Math.random()), workObject, function(err) {
        if(err) return callback(err);

        // Operation end time
        var endTime = microtime.now();

        // Log the time taken for the operation
        services.log('second', 'publish_to_queues', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        callback();
      });
    }

    return new Scenario(services, scenario, schema);
  }
});

/*
 * Retrieve Messages by priority
 */
scenarios.push({
    name: 'fetch_from_queue_by_priority'
  , title: 'exercise queues schema'
  , description: 'exercise queues schema'
  , params: {
    // Number of queues to read from
    numberOfQueues: {
        name: 'number of queues to read from'
      , type: 'number'
      , default: 10
    }
    // Range of priorities
    , priorityRange: {
        name: 'range of priority'
      , type: 'number'
      , default: 10
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient
      , Binary = require('mongodb').Binary;

    // Default collection names
    var collections = {
      queues: 'queues'
    }

    // Get all the schemas
    var Queue = require('../schemas/queue/queue');

    // Db instance
    var db = null;

    // Unpack the parameters
    var numberOfQueues = schema.schema.params.numberOfQueues;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Create indexes for all the collections
      var left = numberOfQueues;

      // Iterate over all the files
      for(var i = 0; i < numberOfQueues; i++) {
        // Create any indexes
        Queue.createOptimalIndexes({
          queues: db.collection(f('queue_%s', i))
        }, function(err) {
          left = left - 1;
          if(left == 0) callback();
        });
      }
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfQueues = schema.schema.params.numberOfQueues;
      var workObject = schema.schema.params.workObject;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(scenario.url, {
          server: { poolSize: 1 }
        , replSet: { poolSize: 1 }
        , mongos: { poolSize: 1 }
      }, function(err, db) {
        if(err) return callback(err);

        // Collections
        var cols = {
          queues: db.collection(collections.queues || 'queues')
        }

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          var left = numberOfQueues;
          // Create queue collections
          for(var i = 0; i < numberOfQueues; i++) {
            db.createCollection(f('queue_%s', i), function(err, c) {
              left = left - 1;
              if(left == 0) callback()
            });
          }
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalTeardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.setup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      var self = this;
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;
        self.index = 0;
        callback();
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};

      // Get all the values
      var workObject = schema.schema.params.workObject;
      var priorityRange = schema.schema.params.priorityRange;
      var numberOfQueues = schema.schema.params.numberOfQueues;

      // Adjust the index
      this.index = (this.index + 1) % numberOfQueues

      // Get a queue
      var queue = new Queue({queues: db.collection(f('queue_%s', this.index))});
      // Operation start time
      var startTime = microtime.now();

      // Get a specific set of children
      queue.fetchByPriority(function(err, work) {
        if(err) return callback(err);

        // Mark as done
        work.done(function() {
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          services.log('second', 'fetch_from_queue_by_priority', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          callback();
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
});

/*
 * Retrieve Messages by fifo
 */
scenarios.push({
    name: 'fetch_from_queue_by_fifo'
  , title: 'exercise queues schema'
  , description: 'exercise queues schema'
  , params: {
    // Number of queues to read from
    numberOfQueues: {
        name: 'number of queues to read from'
      , type: 'number'
      , default: 10
    }
    // Range of priorities
    , priorityRange: {
        name: 'range of priority'
      , type: 'number'
      , default: 10
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient
      , Binary = require('mongodb').Binary;

    // Default collection names
    var collections = {
      queues: 'queues'
    }

    // Get all the schemas
    var Queue = require('../schemas/queue/queue');

    // Db instance
    var db = null;

    // Unpack the parameters
    var numberOfQueues = schema.schema.params.numberOfQueues;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Create indexes for all the collections
      var left = numberOfQueues;

      // Iterate over all the files
      for(var i = 0; i < numberOfQueues; i++) {
        // Create any indexes
        Queue.createOptimalIndexes({
          queues: db.collection(f('queue_%s', i))
        }, function(err) {
          left = left - 1;
          if(left == 0) callback();
        });
      }
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfQueues = schema.schema.params.numberOfQueues;
      var workObject = schema.schema.params.workObject;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(scenario.url, {
          server: { poolSize: 1 }
        , replSet: { poolSize: 1 }
        , mongos: { poolSize: 1 }
      }, function(err, db) {
        if(err) return callback(err);

        // Collections
        var cols = {
          queues: db.collection(collections.queues || 'queues')
        }

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          var left = numberOfQueues;
          // Create queue collections
          for(var i = 0; i < numberOfQueues; i++) {
            db.createCollection(f('queue_%s', i), function(err, c) {
              left = left - 1;
              if(left == 0) callback()
            });
          }
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalTeardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.setup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      var self = this;
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        if(err) return callback(err);
        db = schema.db ? instance.db(schema.db) : instance;
        self.index = 0;
        callback();
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};

      // Get all the values
      var workObject = schema.schema.params.workObject;
      var priorityRange = schema.schema.params.priorityRange;
      var numberOfQueues = schema.schema.params.numberOfQueues;
      // Adjust the index
      this.index = (this.index + 1) % numberOfQueues

      // Get a queue
      var queue = new Queue({queues: db.collection(f('queue_%s', this.index))});
      // Operation start time
      var startTime = microtime.now();

      // Get a specific set of children
      queue.fetchFIFO(function(err, work) {
        if(err) return callback(err);

        // Mark as done
        work.done(function() {
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          services.log('second', 'fetch_from_queue_by_fifo', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          callback();
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
});

/*
 * Retrieve Messages by fifo
 */
scenarios.push({
    name: 'fetch_from_queue_by_fifo_no_findandmodify'
  , title: 'exercise queues schema'
  , description: 'exercise queues schema'
  , params: {
    // Number of queues to read from
    numberOfQueues: {
        name: 'number of queues to read from'
      , type: 'number'
      , default: 10
    }
    // Range of priorities
    , priorityRange: {
        name: 'range of priority'
      , type: 'number'
      , default: 10
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient
      , Binary = require('mongodb').Binary;

    // Default collection names
    var collections = {
      queues: 'queues'
    }

    // Get all the schemas
    var Queue = require('../schemas/queue/queue');

    // Db instance
    var db = null;

    // Unpack the parameters
    var numberOfQueues = schema.schema.params.numberOfQueues;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Create indexes for all the collections
      var left = numberOfQueues;

      // Iterate over all the files
      for(var i = 0; i < numberOfQueues; i++) {
        // Create any indexes
        Queue.createOptimalIndexes({
          queues: db.collection(f('queue_%s', i))
        }, function(err) {
          left = left - 1;
          if(left == 0) callback();
        });
      }
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfQueues = schema.schema.params.numberOfQueues;
      var workObject = schema.schema.params.workObject;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(scenario.url, {
          server: { poolSize: 1 }
        , replSet: { poolSize: 1 }
        , mongos: { poolSize: 1 }
      }, function(err, db) {
        if(err) return callback(err);

        // Collections
        var cols = {
          queues: db.collection(collections.queues || 'queues')
        }

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          var left = numberOfQueues;
          // Create queue collections
          for(var i = 0; i < numberOfQueues; i++) {
            db.createCollection(f('queue_%s', i), function(err, c) {
              left = left - 1;
              if(left == 0) callback()
            });
          }
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalTeardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.setup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      var self = this;
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        if(err) return callback(err);
        db = schema.db ? instance.db(schema.db) : instance;
        self.index = 0;
        callback();
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};

      // Get all the values
      var workObject = schema.schema.params.workObject;
      var priorityRange = schema.schema.params.priorityRange;
      var numberOfQueues = schema.schema.params.numberOfQueues;
      // Adjust the index
      this.index = (this.index + 1) % numberOfQueues

      // Get a queue
      var queue = new Queue({queues: db.collection(f('queue_%s', this.index))});
      // Operation start time
      var startTime = microtime.now();

      // Get a specific set of children
      queue.fetchFIFONoFindAndModify(function(err, work) {
        if(err) return callback(err);

        // Mark as done
        work.done(function() {
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          services.log('second', 'fetch_from_queue_by_fifo', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          callback();
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
});
