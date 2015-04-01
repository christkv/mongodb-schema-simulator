var microtime = require('microtime')
  , f = require('util').format;
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

/*
 * Simple fixed items in cart simulation
 */
scenarios.push({
    name: 'metadata'
  , title: 'simulate fetch documents by random metadata fields'
  , description: 'simulates successful retrival of a document by metadata fields'
  , params: {
    // Number of metadata objects
    numberOfObjects: {
        name: 'the number of pre-loaded metadata object'
      , type: 'number'
      , default: 1000
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient
      , Binary = require('mongodb').Binary;

    // Default collection names
    var collections = {
      metadata: 'metadata'
    }

    // Get all the schemas
    var Metadata = require('../schemas/metadata/metadata');

    // Db instance
    var db = null;

    // Contains the cart scenario
    var MetadataScenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Get collections
      var collections = {
        metadatas: db.collection(collectionNames.metadatas || 'metadatas')
      }

      // Create any indexes
      Metadata.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);
        callback();
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    MetadataScenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfObjects = schema.params.numberOfObjects;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Connect to the database
      MongoClient.connect(schema.url, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Get collections
        var cols = {
          metadatas: db.collection(collections.metadatas || 'metadatas')
        }

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          // Create all the accounts
          var left = numberOfObjects;

          // Create accounts
          for(var i = 0; i < numberOfObjects; i++) {
            // Create a unique metadata object
            var metadata = [];
            metadata.push({ key: f('field_0_%s', i), value: f('%s_value', i) });
            metadata.push({ key: f('field_1_%s', i), value: f('%s_value', i) });

            // Create a metadata document
            var obj = new Metadata(cols, i, metadata);
            obj.create(function(err) {
              left = left - 1;
              if(err) errors.push(err);

              if(left == 0) {
                // Close the db
                db.close();
                // Callback
                callback(errors.length > 0 ? errors : null);
              }
            });
          }
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    MetadataScenario.prototype.globalTeardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    MetadataScenario.prototype.setup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Connect to the database
      MongoClient.connect(schema.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;
        callback(err);
      });
    }

    /*
     * Runs for each executing process
     */
    MetadataScenario.prototype.teardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    MetadataScenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Unpack the parameters
      var numberOfObjects = schema.params.numberOfObjects;
      var collections = schema.collections ? schema.collections : collections;

      // Get collections
      var cols = {
        metadatas: db.collection(collections.metadatas || 'metadatas')
      }

      // Get a random cache and push an object
      var id = Math.round(numberOfObjects * Math.random()) % numberOfObjects;

      // Set up query
      var fields = {};
      fields[f('field_0_%s', id)] = f('%s_value', id);
      fields[f('field_1_%s', id)] = f('%s_value', id);

      // Cache insert start time
      var startTime = microtime.now();

      // Query
      Metadata.findByFields(cols, fields, function(err, items) {
        if(err) return callback(err);
        // Get end time of the cart
        var endTime = microtime.now();
        services.log('second', 'metadata', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        callback();
      });
    }

    return new MetadataScenario(services, scenario, schema);
  }
})
