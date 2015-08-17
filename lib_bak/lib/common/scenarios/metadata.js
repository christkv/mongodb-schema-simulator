"use strict";

var microtime = require('microtime')
  , co = require('co')
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
      , Binary = require('mongodb').Binary
      , ReadPreference = require('mongodb').ReadPreference;

    // Default collection names
    var collections = {
      metadata: 'metadata'
    }

    // Get all the schemas
    var Metadata = require('../schemas/metadata/metadata');

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames) {
      // Get collections
      var collections = {
        metadatas: db.collection(collectionNames.metadatas || 'metadatas')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Create any indexes
          yield Metadata.createOptimalIndexes(collections);
          resolve();
        }).catch(function(err) {
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
      var numberOfObjects = schema.params.numberOfObjects;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          yield db = MongoClient.connect(schema.url);

          // Get the specific schema db if specified
          if(schema.db) db = db.db(schema.db);

          // Get collections
          var cols = {
            metadatas: db.collection(collections.metadatas || 'metadatas')
          }

          // CreateIndex for all items
          yield createIndexes(db, collections);
          // Create accounts
          for(var i = 0; i < numberOfObjects; i++) {
            // Create a unique metadata object
            var metadata = [];
            metadata.push({ key: f('field_0_%s', i), value: f('%s_value', i) });
            metadata.push({ key: f('field_1_%s', i), value: f('%s_value', i) });

            // Create a metadata document
            var obj = new Metadata(cols, i, metadata);
            try {
              yield obj.create();
            } catch(err) {
              errors.push(err);
            }
          }

          if(errors.length > 0) return reject(err);
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
      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          var instance = yield MongoClient.connect(schema.url);
          db = schema.db ? instance.db(schema.db) : instance;
          resolve();
        }).catch(function(err) {
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options, callback) {
      // Return the promise
      return new Promise(function(resolve, reject) {
        if(db) db.close();
        resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options, callback) {
      options = options || {};
      // Unpack the parameters
      var numberOfObjects = schema.params.numberOfObjects;
      var collections = schema.collections ? schema.collections : collections;
      var readPreferences = schema.readPreferences || {};
      // Metadata read preference
      var readPreferenceObject = readPreferences.metadata || {mode: 'primary', tags: {}}
      // Create options object
      var options = {readPreference: new ReadPreference(readPreferenceObject.mode, readPreferenceObject.tags)};

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

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          yield Metadata.findByFields(cols, fields, options);
          // Get end time of the cart
          var endTime = microtime.now();
          services.log('second', 'metadata', {
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
})
