"use strict";

var microtime = require('microtime')
  , f = require('util').format
  , fs = require('fs')
  , Queue = require('../schemas/queue/queue');

// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

// Set up all indexes
var createIndexes = function(db, collectionNames, callback) {
  // Collections
  var collections = {
    queues: db.collection(collectionNames.queues || 'queues')
  }

  // Create any indexes
  Queue.createOptimalIndexes(collections, callback);
}

/*
 * Publish message to queue
 */
scenarios.push({
    name: 'publish_to_queues'
  , title: 'exercise queues schema'
  , description: 'exercise queues schema'
  , params: {
    // Range of priorities
    priorityRange: {
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

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var workObject = schema.params.workObject;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(schema.url, {
          server: { poolSize: 1 }
        , replSet: { poolSize: 1 }
        , mongos: { poolSize: 1 }
      }, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // CreateIndex for all items
        createIndexes(db, collections, callback);
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
      var workObject = schema.params.workObject;
      var priorityRange = schema.params.priorityRange;

      // Get a queue
      var collections = schema.collections ? schema.collections : collections;
      var queue = new Queue({queues: db.collection(collections.queues)});

      // Get write concern
      var writeConcern = schema.writeConcern || {};

      // Metadata read preference
      var options = writeConcern.queues || {w:1, wtimeout: 10000}

      // Operation start time
      var startTime = microtime.now();

      // Get a specific set of children
      queue.publish(Math.round(priorityRange * Math.random()), workObject, options, function(err) {
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
    // Range of priorities
    priorityRange: {
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

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var workObject = schema.params.workObject;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(schema.url, {
          server: { poolSize: 1 }
        , replSet: { poolSize: 1 }
        , mongos: { poolSize: 1 }
      }, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Collections
        var cols = {
          queues: db.collection(collections.queues || 'queues')
        }

        // CreateIndex for all items
        createIndexes(db, collections, callback);
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
      // Get write concern
      var writeConcern = schema.writeConcern || {};

      // Metadata read preference
      var options = writeConcern.queues || {w:1, wtimeout: 10000}

      // Get a queue
      var queue = new Queue({queues: db.collection(collections.queues)});
      // Operation start time
      var startTime = microtime.now();

      // Get a specific set of children
      queue.fetchByPriority(options, function(err, work) {
        if(err) return callback(err);
        // Mark as done
        work.done(options, function() {
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
    // Range of priorities
    priorityRange: {
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

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(schema.url, {
          server: { poolSize: 1 }
        , replSet: { poolSize: 1 }
        , mongos: { poolSize: 1 }
      }, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Collections
        var cols = {
          queues: db.collection(collections.queues || 'queues')
        }

        // CreateIndex for all items
        createIndexes(db, collections, callback);
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
      var priorityRange = schema.params.priorityRange;
      var collections = schema.collections ? schema.collections : collections;
      // Get write concern
      var writeConcern = schema.writeConcern || {};

      // Metadata read preference
      var options = writeConcern.queues || {w:1, wtimeout: 10000}

      // Get a queue
      var queue = new Queue({queues: db.collection(collections.queues)});
      // Operation start time
      var startTime = microtime.now();

      // Get a specific set of children
      queue.fetchFIFO(options, function(err, work) {
        if(err) return callback(err);

        // Mark as done
        work.done(options, function() {
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
