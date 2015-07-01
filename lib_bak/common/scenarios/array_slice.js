"use strict";

var microtime = require('microtime')
  , co = require('co')
  , f = require('util').format;
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

// Set up all indexes
var createIndexes = function(db, collectionNames, callback) {
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Get collections
      var collections = {
        cache: db.collection(collectionNames.cache || 'cache')
      }

      // Create any indexes
      yield Cache.createOptimalIndexes(collections);
      resolve();
    }).catch(function(err) {
      reject(err);
    });
  });
}

/*
 * Pre-allocated cache
 */
scenarios.push({
    name: 'cache'
  , title: 'successfully use pre-allocated slice cache'
  , description: 'simulates a successful pre-allocated slice cache with hits'
  , params: {
    // Number of cache objects
    numberOfCacheObjects: {
        name: 'the number of cache objects used'
      , type: 'number'
      , default: 1000
    }
    // Number of items in the cart
    , initialCacheSize: {
        name: 'the initial cache size'
      , type: 'number'
      , default: 256
    }
    // Preallocate object
    , preAllocateObject: {
        name: 'pre allocate object'
      , type: 'boolean'
      , default: true
    }
    // Example object used for the pre-allocation
    , preAllocateExampleObject: {
        name: 'the preallocation object'
      , type: 'object'
      , default: {}
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient;

    // Default collection names
    var collections = {
      cache: 'cache'
    }

    // Get all the schemas
    var Cache = require('../schemas/array_slice/cache');

    // Db instance
    var db = null;

    // Contains the cart scenario
    class Scenario {
      /*
       * Runs only once when starting up on the monitor
       */
      globalSetup(options) {
        options = options || {};

        // Self reference
        var self = this;

        // Unpack the parameters
        var numberOfCacheObjects = schema.params.numberOfCacheObjects;
        var initialCacheSize = schema.params.initialCacheSize;
        var preAllocateObject = schema.params.preAllocateObject;
        var preAllocateExampleObject = schema.params.preAllocateExampleObject;
        var collections = schema.collections ? schema.collections : collections;
        var errors = [];

        // console.log('[SCENARIO-CacheScenario] globalSetup');
        // Connect to the database
        return new Promise(function(resolve, reject) {
          co(function*() {
            var db = MongoClient.connect(schema.url);

            // Get the specific schema db if specified
            if(schema.db) db = db.db(schema.db);

            // Get collections
            var cols = {
              cache: db.collection(collections.accounts || 'cache')
            }

            // CreateIndex for all items
            yield createIndexes(db, collections);

            // Create all the accounts
            var left = numberOfCacheObjects;

            // Do we have a preallocated object
            var params = [];
            if(preAllocateObject) {
              params.push(preAllocateExampleObject);
            }

            // Create accounts
            for(var i = 0; i < numberOfCacheObjects; i++) {
              var account = new Cache(cols, i, initialCacheSize);
              yield account.create.apply(account, params);
            }

            db.close();
            resolve();
          }).catch(function(err) {
            reject(err);
          });
        });
      }

      /*
       * Runs only once when starting up on the monitor
       */
      globalTeardown(options) {
        return new Promise(function(resolve, reject) { resolve(); });
      }

      /*
       * Runs for each executing process
       */
      setup(options) {
        return new Promise(function(resolve, reject) {
          co(function*() {
            var instance = yield MongoClient.connect(schema.url);
            db = schema.db ? instance.db(schema.db) : instance;
            resolve();
          }).catch(function(err) { reject(err); });
        });
      }

      /*
       * Runs for each executing process
       */
      teardown(options) {
        return new Promise(function(resolve, reject) {
          if(db) db.close();
          resolve();
        });
      }

      /*
       * The actual scenario running
       */
      execute(options) {
        options = options || {};

        // Unpack the parameters
        var numberOfCacheObjects = schema.params.numberOfCacheObjects;
        var initialCacheSize = schema.params.initialCacheSize;
        var preAllocateObject = schema.params.preAllocateObject;
        var preAllocateExampleObject = schema.params.preAllocateExampleObject;
        var collections = schema.collections ? schema.collections : collections;

        // Get collections
        var cols = {
          cache: db.collection(collections.accounts || 'cache')
        }

        // Get write concern
        var writeConcern = schema.writeConcern || {};

        // Metadata read preference
        var options = writeConcern.transactions || {w:1, wtimeout: 10000}

        // Get a random cache and push an object
        var id = Math.round(numberOfCacheObjects * Math.random()) % numberOfCacheObjects;

        // Cache insert start time
        var startTime = microtime.now();

        // Return the promise
        return new Promise(function(resolve, reject) {
          co(function*() {
            // Get a cache object
            var object = new Cache(cols, id, initialCacheSize);
            yield object.push(preAllocateExampleObject, options);

            // Get end time of the cart
            var endTime = microtime.now();
            services.log('second', 'cache', {
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
    }

    return new Scenario(services, scenario, schema);
  }
})

/*
 * No Pre-allocated cache
 */
scenarios.push({
    name: 'cache_no_prealloc'
  , title: 'successfully use none pre-allocated slice cache'
  , description: 'simulates a successful none pre-allocated slice cache with hits'
  , params: {
    // Number of cache objects
    numberOfCacheObjects: {
        name: 'the number of cache objects used'
      , type: 'number'
      , default: 1000
    }
    // Number of items in the cart
    , initialCacheSize: {
        name: 'the initial cache size'
      , type: 'number'
      , default: 256
    }
    // Example object used for the pre-allocation
    , preAllocateExampleObject: {
        name: 'the preallocation object'
      , type: 'object'
      , default: {}
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient;

    // Default collection names
    var collections = {
      cache: 'cache'
    }

    // Get all the schemas
    var Cache = require('../schemas/array_slice/cache');

    // Db instance
    var db = null;

    // Contains the cart scenario
    class Scenario {
      /*
       * Runs only once when starting up on the monitor
       */
      globalSetup(options) {
        options = options || {};

        // Self reference
        var self = this;

        // Unpack the parameters
        var numberOfCacheObjects = schema.params.numberOfCacheObjects;
        var initialCacheSize = schema.params.initialCacheSize;
        var collections = schema.collections ? schema.collections : collections;
        var errors = [];

        // Return the promise
        return new Promise(function(resolve, reject) {
          co(function*() {
            var db = yield MongoClient.connect(schema.url);
            // Get the specific schema db if specified
            if(schema.db) db = db.db(schema.db);
            // Get collections
            var cols = {
              cache: db.collection(collections.accounts || 'cache')
            }
            // CreateIndex for all items
            yield createIndexes(db, collections);

            // Create accounts
            for(var i = 0; i < numberOfCacheObjects; i++) {
              var account = new Cache(cols, i, initialCacheSize);
              yield account.create.apply(account, []);
            }

            resolve();
          }).catch(function(err) {
            reject(err);
          });
        });
      }

      /*
       * Runs only once when starting up on the monitor
       */
      globalTeardown(options) {
        return new Promise(function(resolve, reject) { resolve(); });
      }

      /*
       * Runs for each executing process
       */
      setup(options) {
        return new Promise(function(resolve, reject) {
          co(function*() {
            var instance = yield MongoClient.connect(schema.url);
            db = schema.db ? instance.db(schema.db) : instance;
            resolve();
          }).catch(function(err) { reject(err); });
        });
      }

      /*
       * Runs for each executing process
       */
      teardown(options) {
        return new Promise(function(resolve, reject) {
          if(db) db.close();
          resolve();
        });
      }

      /*
       * The actual scenario running
       */
      execute(options) {
        options = options || {};

        // Unpack the parameters
        var numberOfCacheObjects = schema.params.numberOfCacheObjects;
        var initialCacheSize = schema.params.initialCacheSize;
        var preAllocateExampleObject = schema.params.preAllocateExampleObject;
        var collections = schema.collections ? schema.collections : collections;

        // Get collections
        var cols = {
          cache: db.collection(collections.accounts || 'cache')
        }

        // Get a random cache and push an object
        var id = Math.round(numberOfCacheObjects * Math.random()) % numberOfCacheObjects;

        // Get write concern
        var writeConcern = schema.writeConcern || {};

        // Metadata read preference
        var options = writeConcern.transactions || {w:1, wtimeout: 10000}

        // Cache insert start time
        var startTime = microtime.now();

        // Return the promise
        return new Promise(function(resolve, reject) {
          co(function*() {
            // Get a cache object
            var object = new Cache(cols, id, initialCacheSize);
            yield object.push(preAllocateExampleObject, options);

            // Get end time of the cart
            var endTime = microtime.now();
            services.log('second', 'cache_no_prealloc', {
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
    }

    return new Scenario(services, scenario, schema);
  }
})
