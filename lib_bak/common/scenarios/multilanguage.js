"use strict";

var microtime = require('microtime')
  , co = require('co')
  , f = require('util').format
  , fs = require('fs');
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

/*
 * Simple add a local to a category and update all products containing that local
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
    var Product = require('../schemas/multilanguage/product')
      , ReadPreference = require('mongodb').ReadPreference
      , Category = require('../schemas/multilanguage/category');

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames) {
      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Create any indexes
          yield Product.createOptimalIndexes(collections);
          yield Category.createOptimalIndexes(collections);
          resolve();
        }).catch(function(err) {
          reject(err);
        });
      });
    }

    var setupCategories = function(db, collectionNames, categories) {
      var Category = require('../schemas/multilanguage/category')
        , ObjectId = require('mongodb').ObjectId;
      var left = categories.length;

      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Iterate over all the categories
          for(var i = 0; i < categories.length; i++) {
            var category = new Category(collections, categories[i][0], categories[i][1]);
            yield category.create();
          }

          resolve();
        }).catch(function(err) {
          reject(err);
        });
      });
    }

    var setupProducts = function(db, collectionNames, products) {
      var Product = require('../schemas/multilanguage/product')
        , ObjectId = require('mongodb').ObjectId;
      var left = products.length;

      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Iterate over all the categories
          for(var i = 0; i < products.length; i++) {
            var product = new Product(collections, products[i][0], products[i][1], products[i][2], products[i][3], products[i][4]);
            yield product.create();
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
    Scenario.prototype.globalSetup = function(options) {
      options = options || {};

      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfProducts = schema.params.numberOfProducts;
      var numberOfCategories = schema.params.numberOfCategories;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // console.log('[SCENARIO-Scenario] globalSetup');
      // Connect to the database
      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          var db = yield MongoClient.connect(schema.url);

          // Get the specific schema db if specified
          if(schema.db) db = db.db(schema.db);

          // Collections
          var cols = {
              products: db.collection(collections.products || 'products')
            , categories: db.collection(collections.categories || 'categories')
          }

          // CreateIndex for all items
          yield createIndexes(db, collections);
          // Read in the word list
          var wordList = fs.readFileSync(__dirname + "/files/english_word_list.txt", 'utf8')
          var words = wordList.split('\n')

          // All the categories
          var cats = [];
          // Create a bunch of categories
          for(var i = 0; i < numberOfCategories; i++) {
            cats.push([i, {'en-us': words[i], 'de-de': words[i+1]}]);
          }

          // Setup the categories
          yield setupCategories(db, collections, cats);

          // Read all the categories from the database
          var objects = yield cols['categories'].find().toArray();

          // Products to insert
          var products = [];
          // Create a bunch of products
          for(var i = 0; i < numberOfProducts; i++) {
            products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % numberOfCategories]]]);
          }

          // Setup the products
          yield setupProducts(db, collections, products);
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
      options = options || {};
      var self = this;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          var instance = yield MongoClient.connect(schema.url);
          db = schema.db ? instance.db(schema.db) : instance;

          // Read in the word list
          var wordList = fs.readFileSync(__dirname + "/files/english_word_list.txt", 'utf8')
          self.words = wordList.split('\n')

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
        co(function*() {
          if(db) db.close();
          resolve();
        }).catch(function(err) {
          reject(err);
        });
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
      options = options || {};

      // Unpack the parameters
      var numberOfProducts = schema.params.numberOfProducts;
      var numberOfCategories = schema.params.numberOfCategories;
      var collections = schema.collections ? schema.collections : collections;

      // Get write concern
      var writeConcern = schema.writeConcern || {};

      // Metadata read preference
      var options = writeConcern.categories || {w:1, wtimeout: 10000}

      // Pick a random category and add a new type
      var id = Math.round(numberOfCategories * Math.random()) % numberOfCategories;

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Create random
      var localNumber = Math.round(this.words.length * Math.random()) % this.words.length;
      var wordNumber = Math.round(this.words.length * Math.random()) % this.words.length;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Cache insert start time
          var startTime = microtime.now();
          // Add a spanish category
          var cat = new Category(cols, id);
          yield cat.addLocal(this.words[localNumber].trim(), this.words[wordNumber].trim(), options);

          // Get end time of the cart
          var endTime = microtime.now();
          services.log('second', 'multilanguage_add_new_local', {
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
 * Simple remove a local from a category and ensure all products have it removed
 */
scenarios.push({
    name: 'multilanguage_remove_local'
  , title: 'simulate removing a local from an existing product category'
  , description: 'simulate removing a local from an existing product category'
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
      , ReadPreference = require('mongodb').ReadPreference
      , Binary = require('mongodb').Binary;

    // Default collection names
    var collections = {
        products: 'products'
      , categories: 'categories'
    }

    // Get all the schemas
    var Product = require('../schemas/multilanguage/product')
      , Category = require('../schemas/multilanguage/category');

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames) {
      // Collections
      var cols = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Create any indexes
          yield Product.createOptimalIndexes(cols);
          yield Category.createOptimalIndexes(cols);
          resolve();
        }).catch(function(err) {
          reject(err);
        });
      });
    }

    var setupCategories = function(db, collectionNames, categories) {
      var Category = require('../schemas/multilanguage/category')
        , ObjectId = require('mongodb').ObjectId;
      var left = categories.length;

      // Collections
      var cols = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Iterate over all the categories
          for(var i = 0; i < categories.length; i++) {
            var category = new Category(cols, categories[i][0], categories[i][1]);
            yield category.create();
          }

          resolve();
        }).catch(function(err) {
          reject(err);
        });
      });
    }

    var setupProducts = function(db, collectionNames, products) {
      var Product = require('../schemas/multilanguage/product')
        , ObjectId = require('mongodb').ObjectId;
      var left = products.length;

      // Collections
      var cols = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Iterate over all the categories
          for(var i = 0; i < products.length; i++) {
            var product = new Product(cols, products[i][0], products[i][1], products[i][2], products[i][3], products[i][4]);
            yield product.create();
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
    Scenario.prototype.globalSetup = function(options) {
      options = options || {};

      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfProducts = schema.params.numberOfProducts;
      var numberOfCategories = schema.params.numberOfCategories;
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // console.log('[SCENARIO-Scenario] globalSetup');
      // Connect to the database
      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          var db = yield MongoClient.connect(schema.url);

          // Get the specific schema db if specified
          if(schema.db) db = db.db(schema.db);

          // Collections
          var cols = {
              products: db.collection(collections.products || 'products')
            , categories: db.collection(collections.categories || 'categories')
          }

          // CreateIndex for all items
          yield createIndexes(db, collections);
          // Read in the word list
          var wordList = fs.readFileSync(__dirname + "/files/english_word_list.txt", 'utf8')
          var words = wordList.split('\n')

          // All the categories
          var cats = [];
          // Create a bunch of categories
          for(var i = 0; i < numberOfCategories; i++) {
            cats.push([i, {'en-us': words[i], 'de-de': words[i+1]}]);
          }

          // Setup the categories
          yield setupCategories(db, collections, cats);

          // Read all the categories from the database
          var objects = yield cols['categories'].find().toArray();

          // Products to insert
          var products = [];
          // Create a bunch of products
          for(var i = 0; i < numberOfProducts; i++) {
            products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % numberOfCategories]]]);
          }

          // Setup the products
          yield setupProducts(db, collections, products);
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
      options = options || {};
      var self = this;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
          var instance = yield MongoClient.connect(schema.url);
          db = schema.db ? instance.db(schema.db) : instance;

          // Collections
          var cols = {
              products: db.collection(collections.products || 'products')
            , categories: db.collection(collections.categories || 'categories')
          }

          // Read all the categories from the database
          var objects = yield cols['categories'].find().toArray();
          self.objects = objects;
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
      var numberOfProducts = schema.params.numberOfProducts;
      var numberOfCategories = schema.params.numberOfCategories;
      var collections = schema.collections ? schema.collections : collections;

      // Get write concern
      var writeConcern = schema.writeConcern || {};

      // Metadata read preference
      var options = writeConcern.categories || {w:1, wtimeout: 10000}

      // Pick a random category and add a new type
      var id = Math.round(numberOfCategories * Math.random()) % numberOfCategories;

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Cache insert start time
          var startTime = microtime.now();
          // Add a spanish category
          var cat = new Category(cols, id);
          yield cat.removeLocal('de-de', options);

          // Get end time of the cart
          var endTime = microtime.now();
          services.log('second', 'multilanguage_remove_local', {
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
