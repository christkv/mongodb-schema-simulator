"use strict";

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
    name: 'insert'
  , title: 'insert documents into collection'
  , description: 'insert documents into collection'
  , params: {
    // Default work object template
    workObject: {
        name: 'default work object template'
      , type: 'object'
      , default: {}
    }
    // Batch size of each insert
    , batchSize: {
        name: 'batch size of each insert'
      , type: 'number'
      , default: 1
    }
    // Ordered
    , ordered: {
        name: 'ordered bulk write operations'
      , type: 'boolean'
      , default: true
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient;

    // Default collection names
    var collections = {
      insert: 'insert'
    }

    // Db instance
    var db = null;
    var collection = null;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
        timeseries: db.collection(collectionNames.timeseries || 'timeseries')
      }

      TimeSeries.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);
        callback();
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
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

      // Unpack the parameters
      var self = this;
      var collectionNames = schema.collections ? schema.collections : collections;

      // Connect to the database
      MongoClient.connect(schema.url, function(err, instance) {
        if(err) return callback(err);
        db = schema.db ? instance.db(schema.db) : instance;
        collection = db.collection(collectionNames.insert);
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
      var ordered = schema.params.ordered;
      var batchSize = schema.params.batchSize;
      var collectionNames = schema.collections ? schema.collections : collections;

      // Get write concern
      var writeConcern = schema.writeConcern || {};

      // Metadata read preference
      var options = writeConcern.insert || {w:1, wtimeout: 10000}

      // Operation start time
      var startTime = microtime.now();

      // Generate a new object from provided template
      services.generateObjectsFromTemplate(JSON.stringify(workObject), batchSize, function(err, docs) {
        if(err) return callback(err);

        // Create bulk object
        var bulk = !ordered ? collection.initializeUnorderedBulkOp() : collection.initializeOrderedBulkOp();

        // Add all inserts to bulk
        for(var i = 0; i < docs.length; i++) {
          bulk.insert(docs[i]);
        }

        bulk.execute(options, function(err, d) {
          if(err) return callback(err);

          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          services.log('second', 'insert', {
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
})
