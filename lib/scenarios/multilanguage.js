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
    name: 'multilanguage_add_new_local'
  , title: 'simulate adding a new local to an existing product category'
  , description: 'simulate adding a new local to an existing product category'
  , params: {
    // Number of metadata objects
    numberOfProducts: {
        name: 'the number of preloaded products'
      , type: 'number'
      , default: 1000
    }
    // Size of each metadata object in bytes
    , numberOfCategories: {
        name: 'the number of preloaded categories'
      , type: 'number'
      , default: 256
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient
      , Binary = require('mongodb').Binary;

    // Default collection names
    var collections = {
        products: 'products'
      , categories: 'categories'
    }    

    // Get all the schemas
    var Product = require('../../schemas/multilanguage/product')
      , Category = require('../../schemas/multilanguage/category');

    // Db instance
    var db = null;

    // Contains the cart scenario
    var MultilanguageAddLocalScenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Get collections
      var products = db.collection(collectionNames.products || 'products');
      var categories = db.collection(collectionNames.categories || 'categories');

      // Create any indexes
      Product.createOptimalIndexes(products, function(err) {
        if(err) return callback(err);  

        Category.createOptimalIndexes(categories, function(err) {
          if(err) return callback(err);  
          callback();
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    MultilanguageAddLocalScenario.prototype.globalSetup = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfProducts = schema.schema.params.numberOfProducts;
      var numberOfCategories = schema.schema.params.numberOfCategories;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // console.log('[SCENARIO-MultilanguageAddLocalScenario] globalSetup');
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get the collections
        var products = db.collection(collections.products || 'products');
        var categories = db.collection(collections.categories || 'categories');

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          // // Create all the accounts
          // var left = numberOfObjects;

          // // Create accounts
          // for(var i = 0; i < numberOfObjects; i++) {
          //   // Create a unique metadata object
          //   var metadata = [];
          //   metadata.push({ key: f('field_0_%s', i), value: f('%s_value', i) });
          //   metadata.push({ key: f('field_1_%s', i), value: f('%s_value', i) });

          //   // Create a metadata document
          //   var obj = new Metadata(collection, i, metadata);            
          //   obj.create(function(err) {
          //     left = left - 1;
          //     if(err) errors.push(err);

          //     if(left == 0) {
          //       // Close the db
          //       db.close();
          //       // Callback
          //       callback(errors.length > 0 ? errors : null);
          //     }
          //   });            
          // }
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    MultilanguageAddLocalScenario.prototype.globalTeardown = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    MultilanguageAddLocalScenario.prototype.setup = function(options, callback) {      
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
    MultilanguageAddLocalScenario.prototype.teardown = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    MultilanguageAddLocalScenario.prototype.execute = function(options, callback) {
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

    return new MultilanguageAddLocalScenario(services, scenario, schema);
  }
});