"use strict";

var microtime = require('microtime')
  , co = require('co')
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
    var createIndexes = function(db, collectionNames) {
      // Collections
      var collections = {
        topics: db.collection(collectionNames.topics || 'topics')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Create any indexes
          yield Topic.createOptimalIndexes(collections);
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options) {
      options = options || {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var sizeInBytes = schema.params.sizeInBytes;
      var workObject = schema.params.workObject;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          var db = yield MongoClient.connect(schema.url);

          // Get the specific schema db if specified
          if(schema.db) db = db.db(schema.db);

          // Create collection and indexes
          yield db.createCollection(collections.topics, {
            capped:true, size: sizeInBytes
          });

          yield createIndexes(db, collections);
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalTeardown = function(options) {
      // Return the promise
      return new Promise(function(resolve, reject) {
        resolve();
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.setup = function(options) {
      var self = this;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          var instance = yield MongoClient.connect(schema.url);
          db = schema.db ? instance.db(schema.db) : instance;
          self.index = 0;
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      return new Promise(function(resolve, reject) {
        return resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
      options = options || {};

      // Get all the values
      var workObject = schema.params.workObject;
      var priorityRange = schema.params.priorityRange;
      var collections = schema.collections ? schema.collections : collections;

      // Get a queue
      var topic = new Topic({topics: db.collection(collections.topics)});

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Operation start time
          var startTime = microtime.now();

          // Generate a new object from provided template
          var doc = yield services.generateObjectFromTemplate(JSON.stringify(workObject));
          // Get a specific set of children
          yield topic.publish(doc);

          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          yield services.log('second', 'publish_to_topics', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
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
    var createIndexes = function(db, collectionNames) {
      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Collections
          var collections = {
            topics: db.collection(collectionNames.topics || 'topics')
          }

          // Create any indexes
          yield Topic.createOptimalIndexes(collections);
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options) {
      options = options || {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var sizeInBytes = schema.params.sizeInBytes;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          var db = yield MongoClient.connect(schema.url);

          // Get the specific schema db if specified
          if(schema.db) db = db.db(schema.db);

          // Create collection and indexes
          yield db.createCollection(collections.topics, {
            capped:true, size: sizeInBytes
          });

          yield createIndexes(db, collections);
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalTeardown = function(options) {
      // Return the promise
      return new Promise(function(resolve, reject) {
        resolve();
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.setup = function(options) {
      options = options || {};
      var self = this;
      var collections = schema.collections ? schema.collections : collections;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          var instance = yield MongoClient.connect(schema.url);
          db = schema.db ? instance.db(schema.db) : instance;
          self.index = 0;
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      return new Promise(function(resolve, reject) {
        return resolve();
      });
    }

    /*
     * Custom execution for the topic
     */
    Scenario.prototype.custom = function(agent) {
      // Number of users
      var numberOfUsers = schema.execution.numberOfUsers;
      var initialDelay = schema.execution.initialDelay || 0;
      var iterations = schema.execution.iterations || 100;
      var resolution = schema.execution.resolution || 1000;
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
          co(function*() {
            // console.log("=================================== DATA")
            // Record the time
            if(startTime == null) {
              startTime = microtime.now();
            } else {
              endTime = microtime.now();

              // Log the time taken for the operation
              yield services.log('second', 'fetch_from_topics', {
                  start: startTime
                , end: endTime
                , time: endTime - startTime
              }, {noTick: true});

              // Next measuring point
              startTime = endTime;
            }
          });
        });
      }

      // All cursors
      var cursors = [];
            // console.log("=================================== TOPIC EXECUTE CALLED")

      return new Promise(function(resolve, reject) {
            // console.log("=================================== TOPIC EXECUTE START")
        // Wait for a bit before connecting
        setTimeout(function() {
            // console.log("=================================== START TOPICS")
          for(var i = 0; i < numberOfUsers; i++) {
            var topic = new Topic({topics: db.collection(collections.topics)});
            var cursor = topic.listen();
            // Save cursor to list
            cursors.push(cursor);
            // console.log("=================================== TOPIC LISTEN")
            // Execute the listener in it's own scope
            cursorScope(topic.listen());
          }

          // Wait for process to end
          setTimeout(function() {
            // console.log("=================================== TOPIC LISTEN DONE")
            for(var i = 0; i < cursors.length; i++) {
              cursors[i].close();
            }

            // Resolve
            resolve();
          }, waitTime)
        }, initialDelay);
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    }

    return new Scenario(services, scenario, schema);
  }
});
