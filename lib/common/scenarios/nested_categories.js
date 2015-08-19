"use strict";

var microtime = require('microtime')
  , co = require('co')
  , f = require('util').format
  , fs = require('fs');
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

var setupCategories = function(db, collectionNames, treeStructure, words) {
  var Category = require('../schemas/nested_categories/category')
    , ObjectId = require('mongodb').ObjectId;

  // Collections
  var collections = {
      products: db.collection(collectionNames.products || 'products')
    , categories: db.collection(collectionNames.categories || 'categories')
  }

  // Current Index
  var currentIndex = 0;
  var wordCounter = 0;

  var createCategory = function(_cat, _parents) {
    var cat = _parents.slice(0);
    cat.push(_cat)

    // Return the promise
    return new Promise(function(resolve, reject) {
      co(function*() {
        yield new Category(collections, currentIndex++, _cat, cat.join('/')).create();
        resolve(cat);
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    });
  }

  var createCategories = function(structures, level, parents, words) {
    var p = parents
    // Return the promise
    return new Promise(function(resolve, reject) {
      co(function*() {
        if(structures[level] == undefined) return resolve();
        var width = structures[level].width;

        // Run over the paths
        for(var i = 0; i < width; i++) {
          var word = words[Math.round(words.length * Math.random())];
          // Create a category
          var parents = yield createCategory(word, p.slice(0));
          // Execute the branch
          yield createCategories(treeStructure, level + 1, parents, words);
        }            

        resolve();
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    });
  }

  // Return the promise
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Create a category tree
      yield createCategories(treeStructure, 0, [''], words);
      resolve();
    }).catch(function(err) {
      console.log(err.stack);
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
        var categories = products[i][4].map(function(x) {
          return x.category
        });

        // Create the product
        var product = new Product(collections, products[i][0], products[i][1], products[i][2], products[i][3], categories);
        yield product.create();
      }

      resolve();
    }).catch(function(err) {
      console.log(err.stack);
      reject(err);
    });
  });
}

/*
 * Directly retrive child categories for a given category
 */
scenarios.push({
    name: 'retrieve_direct_child_categories'
  , title: 'retrieve the direct child categories of a specific root category'
  , description: 'retrieve the direct child categories of a specific root category'
  , params: {
    // Number of metadata objects
    numberOfProducts: {
        name: 'the number of preloaded products'
      , type: 'number'
      , default: 1000
    }
    , treeStructure: {
        name: 'the tree structure layout'
      , type: 'object'
      , default: [{
        level: 0, width: 5
      }, {
        level: 1, width: 5
      }, {
        level: 2, width: 5
      }, {
        level: 3, width: 5
      }, {
        level: 4, width: 5
      }]
    }, coveredIndex: {
        name: 'used covered index query'
      , type: 'boolean'
      , default: false
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient
      , Binary = require('mongodb').Binary
      , ReadPreference = require('mongodb').ReadPreference;

    // Default collection names
    var collections = {
        products: 'products'
      , categories: 'categories'
    }

    // Get all the schemas
    var Product = require('../schemas/nested_categories/product')
      , Category = require('../schemas/nested_categories/category');

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
          console.log(err.stack);
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
      var treeStructure = schema.params.treeStructure.slice(0);
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
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
          var words = wordList.split('\n').map(function(x) { return x.trim(); })

          // Setup the categories
          yield setupCategories(db, collections, treeStructure, words);

          // Read all the categories from the database
          var objects = yield cols['categories'].find().toArray();
          // Get total categories
          var totalCategories = objects.length;

          // Products to insert
          var products = [];
          // Create a bunch of products
          for(var i = 0; i < numberOfProducts; i++) {
            products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
          }

          // Setup the products
          yield setupProducts(db, collections, products);
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
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

          // Get the collection names
          var collections = schema.collections ? schema.collections : {'categories': 'categories'};

          // Get all the categories
          var c = yield db.collection(collections.categories).find().toArray();
          self.categories = c;
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      return new Promise(function(resolve, reject) {
        return resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
      options = options || {};

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.collections ? schema.collections : collections;
      var coveredIndex = schema.params.coveredIndex;
      var readPreferences = schema.readPreferences || {};

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Metadata read preference
      var readPreferenceObject = readPreferences.categories || {mode: 'primary', tags: {}}
      // Create options object
      var options = {readPreference: new ReadPreference(readPreferenceObject.mode, readPreferenceObject.tags)};
      options.coveredIndex = coveredIndex;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Operation start time
          var startTime = microtime.now();
          // Get a specific set of children
          var cats = yield Category.findAllDirectChildCategories(cols, cat.category, options);
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          yield services.log('second', 'retrieve_direct_child_categories', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
});

/*
 * Retrieve entire sub tree of a category
 */
scenarios.push({
    name: 'retrieve_entire_sub_tree_by_category'
  , title: 'retrieve the subtree categories of a specific root category'
  , description: 'retrieve the subtree categories of a specific root category'
  , params: {
    // Number of metadata objects
    numberOfProducts: {
        name: 'the number of preloaded products'
      , type: 'number'
      , default: 1000
    }
    , treeStructure: {
        name: 'the tree structure layout'
      , type: 'object'
      , default: [{
        level: 0, width: 5
      }, {
        level: 1, width: 5
      }, {
        level: 2, width: 5
      }, {
        level: 3, width: 5
      }, {
        level: 4, width: 5
      }]
    }, coveredIndex: {
        name: 'used covered index query'
      , type: 'boolean'
      , default: false
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
    var Product = require('../schemas/nested_categories/product')
      , Category = require('../schemas/nested_categories/category');

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
          console.log(err.stack);
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
      var treeStructure = schema.params.treeStructure.slice(0);
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
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

          // Setup the categories
          yield setupCategories(db, collections, treeStructure, words);

          // Read all the categories from the database
          var objects = yield cols['categories'].find().toArray();
          // Get total categories
          var totalCategories = objects.length;

          // Products to insert
          var products = [];
          // Create a bunch of products
          for(var i = 0; i < numberOfProducts; i++) {
            products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
          }

          // Setup the products
          yield setupProducts(db, collections, products);
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
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

          // Get the collection names
          var collections = schema.collections ? schema.collections : {'categories': 'categories'};

          // Get all the categories
          var c = yield db.collection(collections.categories).find().toArray();
          self.categories = c;
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      return new Promise(function(resolve, reject) {
        return resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
      options = options || {};

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.collections ? schema.collections : collections;
      var coveredIndex = schema.params.coveredIndex;
      var readPreferences = schema.readPreferences || {};

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Metadata read preference
      var readPreferenceObject = readPreferences.categories || {mode: 'primary', tags: {}}
      // Create options object
      var options = {readPreference: new ReadPreference(readPreferenceObject.mode, readPreferenceObject.tags)};
      options.coveredIndex = coveredIndex;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Operation start time
          var startTime = microtime.now();
          // Get a specific set of children
          yield Category.findAllChildCategories(cols, cat.category, options);
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          yield services.log('second', 'retrieve_entire_sub_tree_by_category', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
});

/*
 * Retrieve all products for specific category
 */
scenarios.push({
    name: 'retrieve_products_by_category'
  , title: 'retrieve all the products for a specific category'
  , description: 'retrieve all the products for a specific category'
  , params: {
    // Number of metadata objects
    numberOfProducts: {
        name: 'the number of preloaded products'
      , type: 'number'
      , default: 1000
    }
    , treeStructure: {
        name: 'the tree structure layout'
      , type: 'object'
      , default: [{
        level: 0, width: 5
      }, {
        level: 1, width: 5
      }, {
        level: 2, width: 5
      }, {
        level: 3, width: 5
      }, {
        level: 4, width: 5
      }]
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
    var Product = require('../schemas/nested_categories/product')
      , Category = require('../schemas/nested_categories/category');

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
          console.log(err.stack);
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
      var treeStructure = schema.params.treeStructure.slice(0);
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
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

          // Setup the categories
          yield setupCategories(db, collections, treeStructure, words);

          // Read all the categories from the database
          var objects = yield cols['categories'].find().toArray();
          // Get total categories
          var totalCategories = objects.length;

          // Products to insert
          var products = [];
          // Create a bunch of products
          for(var i = 0; i < numberOfProducts; i++) {
            products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
          }

          // Setup the products
          yield setupProducts(db, collections, products);
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
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

          // Get the collection names
          var collections = schema.collections ? schema.collections : {'categories': 'categories'};

          // Get all the categories
          var c = yield db.collection(collections.categories).find().toArray();
          self.categories = c;
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      return new Promise(function(resolve, reject) {
        return resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
      options = options || {};

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.collections ? schema.collections : collections;
      var coveredIndex = schema.params.coveredIndex;
      var readPreferences = schema.readPreferences || {};

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Metadata read preference
      var readPreferenceObject = readPreferences.categories || {mode: 'primary', tags: {}}
      // Create options object
      var options = {readPreference: new ReadPreference(readPreferenceObject.mode, readPreferenceObject.tags)};
      options.coveredIndex = coveredIndex;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Operation start time
          var startTime = microtime.now();
          // Get a specific set of children
          yield Product.findByCategory(cols, cat.category, options);
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          yield services.log('second', 'retrieve_products_by_category', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
});

/*
 * Retrieve all products in category subtree
 */
scenarios.push({
    name: 'retrieve_products_by_category_subtree'
  , title: 'retrieve all the products for a specific category subtree'
  , description: 'retrieve all the products for a specific category subtree'
  , params: {
    // Number of metadata objects
    numberOfProducts: {
        name: 'the number of preloaded products'
      , type: 'number'
      , default: 1000
    }
    , treeStructure: {
        name: 'the tree structure layout'
      , type: 'object'
      , default: [{
        level: 0, width: 5
      }, {
        level: 1, width: 5
      }, {
        level: 2, width: 5
      }, {
        level: 3, width: 5
      }, {
        level: 4, width: 5
      }]
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
    var Product = require('../schemas/nested_categories/product')
      , Category = require('../schemas/nested_categories/category');

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
          console.log(err.stack);
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
      var treeStructure = schema.params.treeStructure.slice(0);
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
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

          // Setup the categories
          yield setupCategories(db, collections, treeStructure, words);

          // Read all the categories from the database
          var objects = yield cols['categories'].find().toArray();
          // Get total categories
          var totalCategories = objects.length;

          // Products to insert
          var products = [];
          // Create a bunch of products
          for(var i = 0; i < numberOfProducts; i++) {
            products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
          }

          // Setup the products
          yield setupProducts(db, collections, products);
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
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

          // Get the collection names
          var collections = schema.collections ? schema.collections : {'categories': 'categories'};

          // Get all the categories
          var c = yield db.collection(collections.categories).find().toArray();
          self.categories = c;
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      return new Promise(function(resolve, reject) {
        return resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
      options = options || {};

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.collections ? schema.collections : collections;
      var coveredIndex = schema.params.coveredIndex;
      var readPreferences = schema.readPreferences || {};

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Metadata read preference
      var readPreferenceObject = readPreferences.categories || {mode: 'primary', tags: {}}
      // Create options object
      var options = {readPreference: new ReadPreference(readPreferenceObject.mode, readPreferenceObject.tags)};
      options.coveredIndex = coveredIndex;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Operation start time
          var startTime = microtime.now();
          // Get a specific set of children
          yield Product.findByCategoryTree(cols, cat.category, options);
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          yield services.log('second', 'retrieve_products_by_category_subtree', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
});

/*
 * Retrieve all products in category subtree
 */
scenarios.push({
    name: 'retrieve_products_by_categories_direct_children'
  , title: 'retrieve all the products for a specific category direct children'
  , description: 'retrieve all the products for a specific category direct children'
  , params: {
    // Number of metadata objects
    numberOfProducts: {
        name: 'the number of preloaded products'
      , type: 'number'
      , default: 1000
    }
    , treeStructure: {
        name: 'the tree structure layout'
      , type: 'object'
      , default: [{
        level: 0, width: 5
      }, {
        level: 1, width: 5
      }, {
        level: 2, width: 5
      }, {
        level: 3, width: 5
      }, {
        level: 4, width: 5
      }]
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
    var Product = require('../schemas/nested_categories/product')
      , Category = require('../schemas/nested_categories/category');

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
          console.log(err.stack);
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
      var treeStructure = schema.params.treeStructure.slice(0);
      var collections = schema.collections ? schema.collections : collections;
      var errors = [];

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to the database
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

          // Setup the categories
          yield setupCategories(db, collections, treeStructure, words);

          // Read all the categories from the database
          var objects = yield cols['categories'].find().toArray();
          // Get total categories
          var totalCategories = objects.length;

          // Products to insert
          var products = [];
          // Create a bunch of products
          for(var i = 0; i < numberOfProducts; i++) {
            products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
          }

          // Setup the products
          yield setupProducts(db, collections, products);
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
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

          // Get the collection names
          var collections = schema.collections ? schema.collections : {'categories': 'categories'};

          // Get all the categories
          var c = yield db.collection(collections.categories).find().toArray();
          self.categories = c;
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options) {
      return new Promise(function(resolve, reject) {
        return resolve();
      });
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options) {
      options = options || {};

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.collections ? schema.collections : collections;
      var coveredIndex = schema.params.coveredIndex;
      var readPreferences = schema.readPreferences || {};

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Metadata read preference
      var readPreferenceObject = readPreferences.categories || {mode: 'primary', tags: {}}
      // Create options object
      var options = {readPreference: new ReadPreference(readPreferenceObject.mode, readPreferenceObject.tags)};
      options.coveredIndex = coveredIndex;

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Operation start time
          var startTime = microtime.now();
          // Get a specific set of children
          yield Product.findByDirectCategoryChildren(cols, cat.category, options);
          // Operation end time
          var endTime = microtime.now();

          // Log the time taken for the operation
          yield services.log('second', 'retrieve_products_by_categories_direct_children', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
});
