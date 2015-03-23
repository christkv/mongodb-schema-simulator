var microtime = require('microtime');
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

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
    var CacheScenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {

      // Get collections
      var collections = {
        cache: db.collection(collectionNames.cache || 'cache')
      }

      // Create any indexes
      Cache.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);
        callback();
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    CacheScenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};

      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfCacheObjects = schema.schema.params.numberOfCacheObjects;
      var initialCacheSize = schema.schema.params.initialCacheSize;
      var preAllocateObject = schema.schema.params.preAllocateObject;
      var preAllocateExampleObject = schema.schema.params.preAllocateExampleObject;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // console.log('[SCENARIO-CacheScenario] globalSetup');
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get collections
        var cols = {
          cache: db.collection(collections.accounts || 'cache')
        }

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          // Create all the accounts
          var left = numberOfCacheObjects;

          // Do we have a preallocated object
          var params = [];
          if(preAllocateObject) params.push(preAllocateExampleObject);
          params.push(function(err) {
              left = left - 1;
              if(err) errors.push(err);

              if(left == 0) {
                // Close the db
                db.close();
                // Callback
                callback(errors.length > 0 ? errors : null);
              }
          });

          // Create accounts
          for(var i = 0; i < numberOfCacheObjects; i++) {
            var account = new Cache(cols, i, initialCacheSize);
            account.create.apply(account, params);
          }
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    CacheScenario.prototype.globalTeardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    CacheScenario.prototype.setup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;
        callback(err);
      });
    }

    /*
     * Runs for each executing process
     */
    CacheScenario.prototype.teardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    CacheScenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};

      // Unpack the parameters
      var numberOfCacheObjects = schema.schema.params.numberOfCacheObjects;
      var initialCacheSize = schema.schema.params.initialCacheSize;
      var preAllocateObject = schema.schema.params.preAllocateObject;
      var preAllocateExampleObject = schema.schema.params.preAllocateExampleObject;
      var collections = schema.schema.collections ? schema.schema.collections : collections;

      // Get collections
      var cols = {
        cache: db.collection(collections.accounts || 'cache')
      }

      // Get a random cache and push an object
      var id = Math.round(numberOfCacheObjects * Math.random()) % numberOfCacheObjects;

      // Cache insert start time
      var startTime = microtime.now();

      // Get a cache object
      var object = new Cache(cols, id, initialCacheSize);
      object.push(preAllocateExampleObject, function(err) {
        if(err) return callback(err);

        // Get end time of the cart
        var endTime = microtime.now();
        services.log('second', 'cache', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        callback();
      });
    }

    return new CacheScenario(services, scenario, schema);
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
    var CacheScenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {

      // Get collections
      var collections = {
        cache: db.collection(collectionNames.cache || 'cache')
      }

      // Create any indexes
      Cache.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);
        callback();
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    CacheScenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};

      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfCacheObjects = schema.schema.params.numberOfCacheObjects;
      var initialCacheSize = schema.schema.params.initialCacheSize;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // console.log('[SCENARIO-CacheScenario] globalSetup');
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get collections
        var cols = {
          cache: db.collection(collections.accounts || 'cache')
        }

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          // Create all the accounts
          var left = numberOfCacheObjects;

          // Do we have a preallocated object
          var params = [];
          params.push(function(err) {
              left = left - 1;
              if(err) errors.push(err);

              if(left == 0) {
                // Close the db
                db.close();
                // Callback
                callback(errors.length > 0 ? errors : null);
              }
          });

          // Create accounts
          for(var i = 0; i < numberOfCacheObjects; i++) {
            var account = new Cache(cols, i, initialCacheSize);
            account.create.apply(account, params);
          }
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    CacheScenario.prototype.globalTeardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    CacheScenario.prototype.setup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;
        callback(err);
      });
    }

    /*
     * Runs for each executing process
     */
    CacheScenario.prototype.teardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    CacheScenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};

      // Unpack the parameters
      var numberOfCacheObjects = schema.schema.params.numberOfCacheObjects;
      var initialCacheSize = schema.schema.params.initialCacheSize;
      var preAllocateExampleObject = schema.schema.params.preAllocateExampleObject;
      var collections = schema.schema.collections ? schema.schema.collections : collections;

      // Get collections
      var cols = {
        cache: db.collection(collections.accounts || 'cache')
      }

      // Get a random cache and push an object
      var id = Math.round(numberOfCacheObjects * Math.random()) % numberOfCacheObjects;

      // Cache insert start time
      var startTime = microtime.now();

      // Get a cache object
      var object = new Cache(cols, id, initialCacheSize);
      object.push(preAllocateExampleObject, function(err) {
        if(err) return callback(err);

        // Get end time of the cart
        var endTime = microtime.now();
        services.log('second', 'cache_no_prealloc', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        callback();
      });
    }

    return new CacheScenario(services, scenario, schema);
  }
})
