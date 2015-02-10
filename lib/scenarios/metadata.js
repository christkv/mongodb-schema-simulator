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
    // Size of each metadata object in bytes
    , objectSize: {
        name: 'size of each metadata object in bytes'
      , type: 'number'
      , default: 1024
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
    var Metadata = require('../../schemas/metadata/metadata');

    // Db instance
    var db = null;

    // Contains the cart scenario
    var MetadataScenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Get collections
      var metadata = db.collection(collectionNames.metadata || 'metadata');

      // Create any indexes
      Metadata.createOptimalIndexes(metadata, function(err) {
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
      var numberOfObjects = schema.schema.params.numberOfObjects;
      var objectSize = schema.schema.params.objectSize;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // console.log('[SCENARIO-MetadataScenario] globalSetup');
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get the collections
        var collection = db.collection(collections.metadata || 'metadata');

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

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
            var obj = new Metadata(collection, i, metadata);            
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
      MongoClient.connect(scenario.url, function(err, instance) {
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
      var numberOfObjects = schema.schema.params.numberOfObjects;
      var collections = schema.schema.collections ? schema.schema.collections : collections;

      // Get collections
      var collection = db.collection(collections.metadata || 'metadata');

      // Get a random cache and push an object
      var id = Math.round(numberOfObjects * Math.random()) % numberOfObjects;

      // Set up query
      var fields = {};
      fields[f('field_0_%s', id)] = f('%s_value', id);
      fields[f('field_1_%s', id)] = f('%s_value', id);

      // Cache insert start time
      var startTime = microtime.now();

      // Query
      Metadata.findByFields(collection, fields, function(err, items) {
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