var microtime = require('microtime')
  , f = require('util').format
  , fs = require('fs');
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

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
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Create any indexes
      Product.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);

        Category.createOptimalIndexes(collections, function(err) {
          if(err) return callback(err);
          callback();
        });
      });
    }

    var setupCategories = function(db, collectionNames, treeStructure, words, callback) {
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

      var createCategory = function(_cat, _parents, callback) {
        var cat = _parents.slice(0);
        cat.push(_cat)
        new Category(collections, currentIndex++, _cat, cat.join('/')).create(function() {
          callback(cat);
        });
      }

      var createCategories = function(structures, level, parents, words, callback) {
        if(structures[level] == undefined) return callback();
        var width = structures[level].width;

        // Left to finish
        var left = width;

        // Run over the paths
        for(var i = 0; i < width; i++) {
          // Get the word
          var word = words[wordCounter++];

          // Create a category
          createCategory(word, parents.slice(0), function(parents) {

            // Execute the branch
            createCategories(treeStructure, level + 1, parents, words, function() {
              left = left - 1;

              if(left == 0) return callback();
            });
          });
        }
      }

      // Create a category tree
      createCategories(treeStructure, 0, [''], words, function() {
        callback();
      });
    }

    var setupProducts = function(db, collectionNames, products, callback) {
      var Product = require('../schemas/multilanguage/product')
        , ObjectId = require('mongodb').ObjectId;
      var left = products.length;

      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }


      // Iterate over all the categories
      for(var i = 0; i < products.length; i++) {
        var categories = products[i][4].map(function(x) {
          return x.category
        });

        // Create the product
        var product = new Product(collections, products[i][0], products[i][1], products[i][2], products[i][3], categories);
        product.create(function() {
          left = left - 1;

          if(left == 0) {
            callback();
          }
        });
      }
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfProducts = schema.schema.params.numberOfProducts;
      var treeStructure = schema.schema.params.treeStructure.slice(0);
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Collections
        var cols = {
            products: db.collection(collections.products || 'products')
          , categories: db.collection(collections.categories || 'categories')
        }

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);
          // Read in the word list
          var wordList = fs.readFileSync(__dirname + "/data/english_word_list.txt", 'utf8')
          var words = wordList.split('\n')

          // Setup the categories
          setupCategories(db, collections, treeStructure, words, function(err) {
            if(err) return callback(err);

            // Read all the categories from the database
            cols['categories'].find().toArray(function(err, objects) {
              if(err) return callback(err);
              // Get total categories
              var totalCategories = objects.length;

              // Products to insert
              var products = [];
              // Create a bunch of products
              for(var i = 0; i < numberOfProducts; i++) {
                products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
              }

              // Setup the products
              setupProducts(db, collections, products, callback);
            });
          });
        });
      });
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
      var self = this;
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;

        // Get the collection names
        var collections = schema.schema.collections ? schema.schema.collections : {'categories': 'categories'};

        // Get all the categories
        db.collection(collections.categories).find().toArray(function(err, c) {
          if(err) return callback(err);
          self.categories = c;
          callback();
        })
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

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var coveredIndex = schema.schema.params.coveredIndex;

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Operation start time
      var startTime = microtime.now();
      // Get a specific set of children
      Category.findAllDirectChildCategories(cols, cat.category, {coveredIndex: coveredIndex}, function(err, cats) {
        if(err) return callback(err);

        // Operation end time
        var endTime = microtime.now();

        // Log the time taken for the operation
        services.log('second', 'retrieve_direct_child_categories', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        callback();
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
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Create any indexes
      Product.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);

        Category.createOptimalIndexes(collections, function(err) {
          if(err) return callback(err);
          callback();
        });
      });
    }

    var setupCategories = function(db, collectionNames, treeStructure, words, callback) {
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

      var createCategory = function(_cat, _parents, callback) {
        var cat = _parents.slice(0);
        cat.push(_cat)
        new Category(collections, currentIndex++, _cat, cat.join('/')).create(function() {
          callback(cat);
        });
      }

      var createCategories = function(structures, level, parents, words, callback) {
        if(structures[level] == undefined) return callback();
        var width = structures[level].width;

        // Left to finish
        var left = width;

        // Run over the paths
        for(var i = 0; i < width; i++) {
          // Get the word
          var word = words[wordCounter++];

          // Create a category
          createCategory(word, parents.slice(0), function(parents) {

            // Execute the branch
            createCategories(treeStructure, level + 1, parents, words, function() {
              left = left - 1;

              if(left == 0) return callback();
            });
          });
        }
      }

      // Create a category tree
      createCategories(treeStructure, 0, [''], words, function() {
        callback();
      });
    }

    var setupProducts = function(db, collectionNames, products, callback) {
      var Product = require('../schemas/multilanguage/product')
        , ObjectId = require('mongodb').ObjectId;
      var left = products.length;

      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }


      // Iterate over all the categories
      for(var i = 0; i < products.length; i++) {
        var categories = products[i][4].map(function(x) {
          return x.category
        })
        // Create the product
        var product = new Product(collections, products[i][0], products[i][1], products[i][2], products[i][3], categories);
        product.create(function() {
          left = left - 1;

          if(left == 0) {
            callback();
          }
        });
      }
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfProducts = schema.schema.params.numberOfProducts;
      var treeStructure = schema.schema.params.treeStructure.slice(0);
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Collections
        var cols = {
            products: db.collection(collections.products || 'products')
          , categories: db.collection(collections.categories || 'categories')
        }

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);
          // Read in the word list
          var wordList = fs.readFileSync(__dirname + "/data/english_word_list.txt", 'utf8')
          var words = wordList.split('\n')

          // Setup the categories
          setupCategories(db, collections, treeStructure, words, function(err) {
            if(err) return callback(err);

            // Read all the categories from the database
            cols['categories'].find().toArray(function(err, objects) {
              if(err) return callback(err);
              // Get total categories
              var totalCategories = objects.length;

              // Products to insert
              var products = [];
              // Create a bunch of products
              for(var i = 0; i < numberOfProducts; i++) {
                products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
              }

              // Setup the products
              setupProducts(db, collections, products, callback);
            });
          });
        });
      });
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
      var self = this;
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;

        // Get the collection names
        var collections = schema.schema.collections ? schema.schema.collections : {'categories': 'categories'};

        // Get all the categories
        db.collection(collections.categories).find().toArray(function(err, c) {
          if(err) return callback(err);
          self.categories = c;
          callback();
        })
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

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var coveredIndex = schema.schema.params.coveredIndex;

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Operation start time
      var startTime = microtime.now();
      // Get a specific set of children
      Category.findAllChildCategories(cols, cat.category, {coveredIndex: coveredIndex}, function(err, cats) {
        if(err) return callback(err);
        // Operation end time
        var endTime = microtime.now();

        // Log the time taken for the operation
        services.log('second', 'retrieve_entire_sub_tree_by_category', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        callback();
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
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Create any indexes
      Product.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);

        Category.createOptimalIndexes(collections, function(err) {
          if(err) return callback(err);
          callback();
        });
      });
    }

    var setupCategories = function(db, collectionNames, treeStructure, words, callback) {
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

      var createCategory = function(_cat, _parents, callback) {
        var cat = _parents.slice(0);
        cat.push(_cat)
        new Category(collections, currentIndex++, _cat, cat.join('/')).create(function() {
          callback(cat);
        });
      }

      var createCategories = function(structures, level, parents, words, callback) {
        if(structures[level] == undefined) return callback();
        var width = structures[level].width;

        // Left to finish
        var left = width;

        // Run over the paths
        for(var i = 0; i < width; i++) {
          // Get the word
          var word = words[wordCounter++];

          // Create a category
          createCategory(word, parents.slice(0), function(parents) {

            // Execute the branch
            createCategories(treeStructure, level + 1, parents, words, function() {
              left = left - 1;

              if(left == 0) return callback();
            });
          });
        }
      }

      // Create a category tree
      createCategories(treeStructure, 0, [''], words, function() {
        callback();
      });
    }

    var setupProducts = function(db, collectionNames, products, callback) {
      var Product = require('../schemas/multilanguage/product')
        , ObjectId = require('mongodb').ObjectId;
      var left = products.length;

      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }


      // Iterate over all the categories
      for(var i = 0; i < products.length; i++) {
        var categories = products[i][4].map(function(x) {
          return x.category
        })
        // Create the product
        var product = new Product(collections, products[i][0], products[i][1], products[i][2], products[i][3], categories);
        product.create(function() {
          left = left - 1;

          if(left == 0) {
            callback();
          }
        });
      }
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfProducts = schema.schema.params.numberOfProducts;
      var treeStructure = schema.schema.params.treeStructure.slice(0);
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Collections
        var cols = {
            products: db.collection(collections.products || 'products')
          , categories: db.collection(collections.categories || 'categories')
        }

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);
          // Read in the word list
          var wordList = fs.readFileSync(__dirname + "/data/english_word_list.txt", 'utf8')
          var words = wordList.split('\n')

          // Setup the categories
          setupCategories(db, collections, treeStructure, words, function(err) {
            if(err) return callback(err);

            // Read all the categories from the database
            cols['categories'].find().toArray(function(err, objects) {
              if(err) return callback(err);
              // Get total categories
              var totalCategories = objects.length;

              // Products to insert
              var products = [];
              // Create a bunch of products
              for(var i = 0; i < numberOfProducts; i++) {
                products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
              }

              // Setup the products
              setupProducts(db, collections, products, callback);
            });
          });
        });
      });
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
      var self = this;
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;

        // Get the collection names
        var collections = schema.schema.collections ? schema.schema.collections : {'categories': 'categories'};

        // Get all the categories
        db.collection(collections.categories).find().toArray(function(err, c) {
          if(err) return callback(err);
          self.categories = c;
          callback();
        })
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

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var coveredIndex = schema.schema.params.coveredIndex;

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Operation start time
      var startTime = microtime.now();
      // Get a specific set of children
      Product.findByCategory(cols, cat.category, {coveredIndex: coveredIndex}, function(err, products) {
        if(err) return callback(err);
        // Operation end time
        var endTime = microtime.now();

        // Log the time taken for the operation
        services.log('second', 'retrieve_products_by_category', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        callback();
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
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Create any indexes
      Product.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);

        Category.createOptimalIndexes(collections, function(err) {
          if(err) return callback(err);
          callback();
        });
      });
    }

    var setupCategories = function(db, collectionNames, treeStructure, words, callback) {
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

      var createCategory = function(_cat, _parents, callback) {
        var cat = _parents.slice(0);
        cat.push(_cat)
        new Category(collections, currentIndex++, _cat, cat.join('/')).create(function() {
          callback(cat);
        });
      }

      var createCategories = function(structures, level, parents, words, callback) {
        if(structures[level] == undefined) return callback();
        var width = structures[level].width;

        // Left to finish
        var left = width;

        // Run over the paths
        for(var i = 0; i < width; i++) {
          // Get the word
          var word = words[wordCounter++];

          // Create a category
          createCategory(word, parents.slice(0), function(parents) {

            // Execute the branch
            createCategories(treeStructure, level + 1, parents, words, function() {
              left = left - 1;

              if(left == 0) return callback();
            });
          });
        }
      }

      // Create a category tree
      createCategories(treeStructure, 0, [''], words, function() {
        callback();
      });
    }

    var setupProducts = function(db, collectionNames, products, callback) {
      var Product = require('../schemas/multilanguage/product')
        , ObjectId = require('mongodb').ObjectId;
      var left = products.length;

      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }


      // Iterate over all the categories
      for(var i = 0; i < products.length; i++) {
        var categories = products[i][4].map(function(x) {
          return x.category
        })
        // Create the product
        var product = new Product(collections, products[i][0], products[i][1], products[i][2], products[i][3], categories);
        product.create(function() {
          left = left - 1;

          if(left == 0) {
            callback();
          }
        });
      }
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfProducts = schema.schema.params.numberOfProducts;
      var treeStructure = schema.schema.params.treeStructure.slice(0);
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Collections
        var cols = {
            products: db.collection(collections.products || 'products')
          , categories: db.collection(collections.categories || 'categories')
        }

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);
          // Read in the word list
          var wordList = fs.readFileSync(__dirname + "/data/english_word_list.txt", 'utf8')
          var words = wordList.split('\n')

          // Setup the categories
          setupCategories(db, collections, treeStructure, words, function(err) {
            if(err) return callback(err);

            // Read all the categories from the database
            cols['categories'].find().toArray(function(err, objects) {
              if(err) return callback(err);
              // Get total categories
              var totalCategories = objects.length;

              // Products to insert
              var products = [];
              // Create a bunch of products
              for(var i = 0; i < numberOfProducts; i++) {
                products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
              }

              // Setup the products
              setupProducts(db, collections, products, callback);
            });
          });
        });
      });
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
      var self = this;
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;

        // Get the collection names
        var collections = schema.schema.collections ? schema.schema.collections : {'categories': 'categories'};

        // Get all the categories
        db.collection(collections.categories).find().toArray(function(err, c) {
          if(err) return callback(err);
          self.categories = c;
          callback();
        })
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

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var coveredIndex = schema.schema.params.coveredIndex;

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Operation start time
      var startTime = microtime.now();
      // Get a specific set of children
      Product.findByCategoryTree(cols, cat.category, {coveredIndex: coveredIndex}, function(err, products) {
        if(err) return callback(err);
        // Operation end time
        var endTime = microtime.now();

        // Log the time taken for the operation
        services.log('second', 'retrieve_products_by_category_subtree', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        callback();
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
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }

      // Create any indexes
      Product.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);

        Category.createOptimalIndexes(collections, function(err) {
          if(err) return callback(err);
          callback();
        });
      });
    }

    var setupCategories = function(db, collectionNames, treeStructure, words, callback) {
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

      var createCategory = function(_cat, _parents, callback) {
        var cat = _parents.slice(0);
        cat.push(_cat)
        new Category(collections, currentIndex++, _cat, cat.join('/')).create(function() {
          callback(cat);
        });
      }

      var createCategories = function(structures, level, parents, words, callback) {
        if(structures[level] == undefined) return callback();
        var width = structures[level].width;

        // Left to finish
        var left = width;

        // Run over the paths
        for(var i = 0; i < width; i++) {
          // Get the word
          var word = words[wordCounter++];

          // Create a category
          createCategory(word, parents.slice(0), function(parents) {

            // Execute the branch
            createCategories(treeStructure, level + 1, parents, words, function() {
              left = left - 1;

              if(left == 0) return callback();
            });
          });
        }
      }

      // Create a category tree
      createCategories(treeStructure, 0, [''], words, function() {
        callback();
      });
    }

    var setupProducts = function(db, collectionNames, products, callback) {
      var Product = require('../schemas/multilanguage/product')
        , ObjectId = require('mongodb').ObjectId;
      var left = products.length;

      // Collections
      var collections = {
          products: db.collection(collectionNames.products || 'products')
        , categories: db.collection(collectionNames.categories || 'categories')
      }


      // Iterate over all the categories
      for(var i = 0; i < products.length; i++) {
        var categories = products[i][4].map(function(x) {
          return x.category
        })
        // Create the product
        var product = new Product(collections, products[i][0], products[i][1], products[i][2], products[i][3], categories);
        product.create(function() {
          left = left - 1;

          if(left == 0) {
            callback();
          }
        });
      }
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfProducts = schema.schema.params.numberOfProducts;
      var treeStructure = schema.schema.params.treeStructure.slice(0);
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // Collections
        var cols = {
            products: db.collection(collections.products || 'products')
          , categories: db.collection(collections.categories || 'categories')
        }

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);
          // Read in the word list
          var wordList = fs.readFileSync(__dirname + "/data/english_word_list.txt", 'utf8')
          var words = wordList.split('\n')

          // Setup the categories
          setupCategories(db, collections, treeStructure, words, function(err) {
            if(err) return callback(err);

            // Read all the categories from the database
            cols['categories'].find().toArray(function(err, objects) {
              if(err) return callback(err);
              // Get total categories
              var totalCategories = objects.length;

              // Products to insert
              var products = [];
              // Create a bunch of products
              for(var i = 0; i < numberOfProducts; i++) {
                products.push([i, words[i], Math.round(100000 * Math.random()), 'usd', [objects[i % totalCategories]]]);
              }

              // Setup the products
              setupProducts(db, collections, products, callback);
            });
          });
        });
      });
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
      var self = this;
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;

        // Get the collection names
        var collections = schema.schema.collections ? schema.schema.collections : {'categories': 'categories'};

        // Get all the categories
        db.collection(collections.categories).find().toArray(function(err, c) {
          if(err) return callback(err);
          self.categories = c;
          callback();
        })
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

      // Get a category
      var cat = this.categories[Math.round(this.categories.length * Math.random() + 1) % this.categories.length];
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var coveredIndex = schema.schema.params.coveredIndex;

      // Collections
      var cols = {
          products: db.collection(collections.products || 'products')
        , categories: db.collection(collections.categories || 'categories')
      }

      // Operation start time
      var startTime = microtime.now();
      // Get a specific set of children
      Product.findByDirectCategoryChildren(cols, cat.category, {coveredIndex: coveredIndex}, function(err, products) {
        if(err) return callback(err);
        // Operation end time
        var endTime = microtime.now();

        // Log the time taken for the operation
        services.log('second', 'retrieve_products_by_categories_direct_children', {
            start: startTime
          , end: endTime
          , time: endTime - startTime
        });

        callback();
      });
    }

    return new Scenario(services, scenario, schema);
  }
});
