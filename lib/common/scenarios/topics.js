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
    name: 'publish_to_topics'
  , title: 'exercise topics schema'
  , description: 'exercise topics schema'
  , params: {
    // Range of priorities
    sizeInBytes: {
        name: 'size in bytes'
      , type: 'number'
      , default: 100000
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
      topics: 'topics'
    }

    // Get all the schemas
    var Topic = require('../schemas/queue/topic');

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
        topics: db.collection(collectionNames.topics || 'topics')
      }

      // Create any indexes
      Topic.createOptimalIndexes(collections, callback);
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var sizeInBytes = schema.params.sizeInBytes;
      var workObject = schema.params.workObject;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(schema.url, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Create collection and indexes
        db.createCollection(collections.topics, {
          capped:true, size: sizeInBytes
        }, function(err, c) {
          createIndexes(db, collections, callback);
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
      MongoClient.connect(schema.url, function(err, instance) {
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
      var workObject = schema.params.workObject;
      var priorityRange = schema.params.priorityRange;
      var collections = schema.collections ? schema.collections : collections;

      // Get a queue
      var topic = new Topic({topics: db.collection(collections.topics)});
      // Operation start time
      var startTime = microtime.now();

      // Generate a new object from provided template
      services.generateObjectFromTemplate(JSON.stringify(workObject), function(err, doc) {
        if(err) return callback(err);
        // Get a specific set of children
        topic.publish(doc, function(err) {
          if(err) return callback(err);

          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          services.log('second', 'publish_to_topics', {
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
 * Read from a topic
 */
scenarios.push({
    name: 'fetch_from_topics'
  , title: 'exercise topics schema'
  , description: 'exercise topics schema'
  , params: {
    // Range of priorities
    sizeInBytes: {
        name: 'size in bytes'
      , type: 'number'
      , default: 100000
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient
      , Binary = require('mongodb').Binary;

    // Default collection names
    var collections = {
      topics: 'topics'
    }

    // Get all the schemas
    var Topic = require('../schemas/queue/topic');

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
        topics: db.collection(collectionNames.topics || 'topics')
      }

      // Create any indexes
      Topic.createOptimalIndexes(collections, callback);
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var sizeInBytes = schema.params.sizeInBytes;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(schema.url, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Create collection and indexes
        db.createCollection(collections.topics, {
          capped:true, size: sizeInBytes
        }, function(err, c) {
          createIndexes(db, collections, callback);
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
      var collections = schema.collections ? schema.collections : collections;

      // Connect to the database
      MongoClient.connect(schema.url, function(err, instance) {
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
     * Custom execution for the topic
     */
    Scenario.prototype.custom = function(remote, totalOpsLeft, callback) {
      // Number of users
      var numberOfUsers = schema.execution.numberOfUsers;
      var initialDelay = schema.execution.initialDelay || 0;
      var iterations = schema.execution.iterations;
      var resolution = schema.execution.resolution;
      var collections = schema.collections ? schema.collections : collections;
      
      // Total wait time
      var waitTime = resolution * iterations;
      // Number of ticks to emit
      var ticks = numberOfUsers * iterations;

      // The number of cursors we are opening
      var numberOfCursorsLeft = numberOfUsers;

      // The function scope for a cursor
      var cursorScope = function(_cursor) {
        var startTime = null;
        var endTime = null;

        // Cursor data element
        _cursor.on('data', function(doc) {
          // Wile ticks left keep sending
          if(ticks-- > 0) {
            remote.tick(function() {});
          }

          // Record the time
          if(startTime == null) {
            startTime = new Date();
          } else {
            endTime = new Date();

            // Log the time taken for the operation
            services.log('second', 'fetch_from_topics', {
                start: startTime
              , end: endTime
              , time: endTime - startTime
            }); 
            
            // Next measuring point
            startTime = endTime;           
          }
        });
      }

      // All cursors
      var cursors = [];

      // Wait for a bit before connecting
      setTimeout(function() {
        for(var i = 0; i < numberOfUsers; i++) {
          var topic = new Topic({topics: db.collection(collections.topics)});
          var cursor = topic.listen();
          // Save cursor to list
          cursors.push(cursor);
          // Execute the listener in it's own scope
          cursorScope(topic.listen());
        }

        // Wait for process to end
        setTimeout(function() {
          for(var i = 0; i < cursors.length; i++) {
            cursors[i].close();
          }

          callback();
        }, waitTime)
      }, initialDelay);
    }

    return new Scenario(services, scenario, schema);
  }
});
