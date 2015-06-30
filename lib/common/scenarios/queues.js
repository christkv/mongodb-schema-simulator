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
var createIndexes = function(db, collectionNames) {
  // Collections
  var collections = {
    queues: db.collection(collectionNames.queues || 'queues')
  }

  // Return the promise
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Create any indexes
      yield Queue.createOptimalIndexes(collections);
      resolve();
    }).catch(function(err) {
      reject(err);
    });
  });
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
    Scenario.prototype.globalSetup = function(options) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var workObject = schema.params.workObject;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          var db = yield MongoClient.connect(schema.url, {
              server: { poolSize: 1 }
            , replSet: { poolSize: 1 }
            , mongos: { poolSize: 1 }
          });

          // Get the specific schema db if specified
          if(schema.db) db = db.db(schema.db);

          // CreateIndex for all items
          yield createIndexes(db, collections);
          resolve();
        }).catch(function(err) {
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
      if(typeof options == 'function') callback = options, options = {};
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
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      // Return the promise
      return new Promise(function(resolve, reject) {
        if(db) db.close();
        resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
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

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Operation start time
          var startTime = microtime.now();

          // Get a specific set of children
          yield queue.publish(Math.round(priorityRange * Math.random()), workObject, options);

          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          services.log('second', 'publish_to_queues', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          resolve();
        }).catch(function(err) {
          reject(err);
        });
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
    Scenario.prototype.globalSetup = function(options) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var workObject = schema.params.workObject;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          var db = yield MongoClient.connect(schema.url, {
              server: { poolSize: 1 }
            , replSet: { poolSize: 1 }
            , mongos: { poolSize: 1 }
          });

          // Get the specific schema db if specified
          if(schema.db) db = db.db(schema.db);

          // Collections
          var cols = {
            queues: db.collection(collections.queues || 'queues')
          }

          // CreateIndex for all items
          yield createIndexes(db, collections);
          resolve();
        }).catch(function(err) {
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
      if(typeof options == 'function') callback = options, options = {};
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
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      // Return the promise
      return new Promise(function(resolve, reject) {
        if(db) db.close();
        resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
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

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Operation start time
          var startTime = microtime.now();

          // Get a specific set of children
          var work = yield queue.fetchByPriority(options);
          // Mark as done
          yield work.done(options);
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          services.log('second', 'fetch_from_queue_by_priority', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          resolve();
        }).catch(function(err) {
          reject(err);
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
    Scenario.prototype.globalSetup = function(options) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          var db = yield MongoClient.connect(schema.url, {
              server: { poolSize: 1 }
            , replSet: { poolSize: 1 }
            , mongos: { poolSize: 1 }
          });

          // Get the specific schema db if specified
          if(schema.db) db = db.db(schema.db);

          // Collections
          var cols = {
            queues: db.collection(collections.queues || 'queues')
          }

          // CreateIndex for all items
          yield createIndexes(db, collections);
          resolve();
        }).catch(function(err) {
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
      if(typeof options == 'function') callback = options, options = {};
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
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      // Return the promise
      return new Promise(function(resolve, reject) {
        if(db) db.close();
        resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
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

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Operation start time
          var startTime = microtime.now();

          // Get a specific set of children
          var work = yield queue.fetchFIFO(options);
          // Mark as done
          yield work.done(options);
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          services.log('second', 'fetch_from_queue_by_fifo', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          resolve();
        }).catch(function(err) {
          reject(err);
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
});
