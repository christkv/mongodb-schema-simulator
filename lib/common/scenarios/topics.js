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

    // Unpack the parameters
    var numberOfTopics = 1;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
        topics: db.collection(collectionNames.topics || 'topics')
      }

      // Create any indexes
      Topic.createOptimalIndexes(collections, function(err) {
        // Create indexes for all the collections
        var left = numberOfTopics;

        // Iterate over all the files
        for(var i = 0; i < numberOfTopics; i++) {
          // Create any indexes
          Topic.createOptimalIndexes({
            topics: db.collection(f('topic_%s', i))
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
      var numberOfTopics = 1;
      var sizeInBytes = schema.schema.params.sizeInBytes;
      var workObject = schema.schema.params.workObject;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Collections
        var cols = {
          topics: db.collection(collections.topics || 'topics')
        }

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        var left = numberOfTopics;
        // Create topics collections
        for(var i = 0; i < numberOfTopics; i++) {
          db.createCollection(f('topic_%s', i), {
            capped:true, size: sizeInBytes
          }, function(err, c) {
            left = left - 1;
            if(left == 0) {
              // CreateIndex for all items
              createIndexes(db, collections, function(err) {
                callback();
              });
            }
          });
        }
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
      // var workObject = schema.schema.params.workObject;
      var priorityRange = schema.schema.params.priorityRange;
      var numberOfTopics = 1;
      // Adjust the index
      this.index = (this.index + 1) % numberOfTopics;

      // Get a queue
      var topic = new Topic({topics: db.collection(f('topic_%s', this.index))}, f('topic_%s', this.index));
      // Operation start time
      var startTime = microtime.now();

      // Generate a new object from provided template
      services.generateObjectFromTemplate(JSON.stringify(schema.schema.params.workObject), function(err, doc) {
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

    // Unpack the parameters
    var numberOfTopics = 1;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
        topics: db.collection(collectionNames.topics || 'topics')
      }

      // Create any indexes
      Topic.createOptimalIndexes(collections, function(err) {
        // Create indexes for all the collections
        var left = numberOfTopics;

        // Iterate over all the files
        for(var i = 0; i < numberOfTopics; i++) {
          // Create any indexes
          Topic.createOptimalIndexes({
            topics: db.collection(f('topic_%s', i))
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
      var numberOfTopics = 1;
      var sizeInBytes = schema.schema.params.sizeInBytes;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Collections
        var cols = {
          topics: db.collection(collections.topics || 'topics')
        }

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        var left = numberOfTopics;
        // Create topics collections
        for(var i = 0; i < numberOfTopics; i++) {
          db.createCollection(f('topic_%s', i), {
            capped:true, size: sizeInBytes
          }, function(err, c) {
            left = left - 1;
            if(left == 0) {
              // CreateIndex for all items
              createIndexes(db, collections, function(err) {
                callback();
              });
            }
          });
        }
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
      var numberOfTopics = 1;
      // Adjust the index
      this.index = (this.index + 1) % numberOfTopics;

      // Get a queue
      var topic = new Topic({topics: db.collection(f('topic_%s', this.index))}, f('topic_%s', this.index));

      // Operation start time
      var startTime = microtime.now();

      // Get first item from the topic
      var cursor = topic.listen();
      cursor.on('data', function(data) {
        // Operation end time
        var endTime = microtime.now();

        // Log the time taken for the operation
        services.log('second', 'fetch_from_topics', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        cursor.close();
      });

      // End signal of cursor
      cursor.on('end', function() {
        callback();
      });
    }

    return new Scenario(services, scenario, schema);
  }
});
