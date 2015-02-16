var microtime = require('microtime')
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
    name: 'browse_specific_categories'
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
    }

    // // Size of each metadata object in bytes
    // , numberOfCategories: {
    //     name: 'the number of preloaded categories'
    //   , type: 'number'
    //   , default: 256
    // }
    // // Number of metadata objects
    // , depth: {
    //     name: 'depth of the categories tree to generate'
    //   , type: 'number'
    //   , default: 10
    // }
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
    var Product = require('../../schemas/nested_categories/product')
      , Category = require('../../schemas/nested_categories/category');

    // Db instance
    var db = null;

    // Contains the cart scenario
    var NestedBrowseSpecificCategoriesScenario = function() {}

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
      var Category = require('../../schemas/nested_categories/category')
        , ObjectId = require('mongodb').ObjectId;
      // var left = categories.length;

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
      var Product = require('../../schemas/multilanguage/product')
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
    NestedBrowseSpecificCategoriesScenario.prototype.globalSetup = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var numberOfProducts = schema.schema.params.numberOfProducts;
      var treeStructure = schema.schema.params.treeStructure.slice(0);
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];
      // console.log('[SCENARIO-NestedBrowseSpecificCategoriesScenario] globalSetup');
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Collections
        var cols = {
            products: db.collection(collections.products || 'products')
          , categories: db.collection(collections.categories || 'categories')
        }

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

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
    NestedBrowseSpecificCategoriesScenario.prototype.globalTeardown = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    NestedBrowseSpecificCategoriesScenario.prototype.setup = function(options, callback) {      
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
    NestedBrowseSpecificCategoriesScenario.prototype.teardown = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    NestedBrowseSpecificCategoriesScenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();

      // // Unpack the parameters
      // var numberOfProducts = schema.schema.params.numberOfProducts;
      // var numberOfCategories = schema.schema.params.numberOfCategories;
      // var collections = schema.schema.collections ? schema.schema.collections : collections;

      // // Pick a random category and add a new type
      // var id = Math.round(numberOfCategories * Math.random()) % numberOfCategories;

      // // Collections
      // var cols = {
      //     products: db.collection(collections.products || 'products')
      //   , categories: db.collection(collections.categories || 'categories')
      // }

      // // Cache insert start time
      // var startTime = microtime.now();
      // // Add a spanish category
      // var cat = new Category(cols, id);
      // cat.addLocal('es-es', 'coche', function(err) {
      //   // Get end time of the cart
      //   var endTime = microtime.now();
      //   services.log('second', 'multilanguage_add_new_local', {
      //       start: startTime
      //     , end: endTime
      //     , time: endTime - startTime
      //   });

      //   callback();
      // });
    }

    return new NestedBrowseSpecificCategoriesScenario(services, scenario, schema);
  }
});
