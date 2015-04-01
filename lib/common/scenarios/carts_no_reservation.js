var microtime = require('microtime')
  , f = require('util').format;
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

/*
 * Build random products
 */
var buildRandomProducts = function(db, collections, numberOfProducts, quantityPrItem, sizeOfProductsInBytes, callback) {
  var Product = require('../schemas/cart_no_reservation/product')
    , Inventory = require('../schemas/cart_no_reservation/inventory')
    , Buffer = require('buffer').Buffer
    , Binary = require('mongodb').Binary;

  // Get collection names
  var products = collections.products || 'products';
  var inventories = collections.inventories || 'inventories';
  var left = numberOfProducts;
  // State
  var errors = [];

  // Collections
  var cols = {
      products: db.collection(products)
    , inventories: db.collection(inventories)
  }

  // Create Product
  var createProduct = function(i, callback) {
    new Product(cols
      , i
      , f('product_%s', i)
      , {bin: new Binary(new Buffer(sizeOfProductsInBytes))}).create(function(err, p) {
        if(err) return callback(err);
        new Inventory(cols, i, quantityPrItem).create(function(err, i) {
          if(err) return callback(err);
          callback();
        });
    });
  }

  // console.log(f("[INFO] buildRandomProducts creating %s documents of size >= %s", numberOfProducts, sizeOfProductsInBytes));
  // Let's create the number of products required
  for(var i = 0; i < numberOfProducts; i++) {
    createProduct(i, function(err) {
      left = left - 1;
      if(err) errors.push(err);

      if(left == 0) {
      // console.log(f("[INFO] buildRandomProducts creating %s documents of size >= %s finished", numberOfProducts, sizeOfProductsInBytes));
        callback(errors.length > 0 ? errors : null);
      }
    });
  }
}

/*
 * Simple fixed items in cart simulation
 */
scenarios.push({
    name: 'cart_no_reservation_successful'
  , title: 'fixed number of cart items with no reservation'
  , description: 'simulates successful carts with a fixed number of items in the cart with no reservation'
  , params: {
    // Number of items in the cart
    numberOfItems: {
        name: 'number of items in the cart'
      , type: 'number'
      , default: 5
    }
    // Size of catalog
    , numberOfProducts: {
        name: 'number of products available'
      , type: 'number'
      , default: 100
    }
    // Size of products in bytes
    , sizeOfProductsInBytes: {
        name: 'size of products in bytes'
      , type: 'number'
      , default: 1024
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient;

    // Default collection names
    var collections = {
        carts: 'carts'
      , products: 'products'
      , inventories: 'inventories'
      , order: 'orders'
    }

    // Get all the schemas
    var Cart = require('../schemas/cart_no_reservation/cart')
      , Inventory = require('../schemas/cart_no_reservation/inventory')
      , Order = require('../schemas/cart_no_reservation/order')
      , Product = require('../schemas/cart_no_reservation/product')
      , ObjectId = require('mongodb').ObjectId;

    // Db instance
    var db = null;

    // Contains the cart scenario
    var CartScenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
          carts: db.collection(collectionNames.carts || 'carts')
        , inventories: db.collection(collectionNames.inventories || 'inventories')
        , orders: db.collection(collectionNames.orders || 'orders')
        , products: db.collection(collectionNames.products || 'products')
      }

      Cart.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);

        Inventory.createOptimalIndexes(collections, function(err) {
          if(err) return callback(err);

          Order.createOptimalIndexes(collections, function(err) {
            if(err) return callback(err);

            Product.createOptimalIndexes(collections, function(err) {
              if(err) return callback(err);
              callback();
            });
          });
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    CartScenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // console.log('[SCENARIO-CartScenario] globalSetup');
      // Connect to the database
      MongoClient.connect(schema.url, function(err, db) {
        if(err) return callback(err);
        
        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);
        
        // Unpack the parameters
        var numberOfProducts = schema.params.numberOfProducts;
        var sizeOfProductsInBytes = schema.params.sizeOfProductsInBytes;
        var collections = schema.collections ? schema.collections : collections;

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          // Build products and then finish global setup
          buildRandomProducts(db, collections, numberOfProducts, 1000000, sizeOfProductsInBytes, function(err, results) {
            // Close the db
            db.close();
            // Setup indexes
            callback(err, results);
          });
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    CartScenario.prototype.globalTeardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // console.log('[SCENARIO-CartScenario] globalTeardown');
      callback();
    }

    /*
     * Runs for each executing process
     */
    CartScenario.prototype.setup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // console.log('[SCENARIO-CartScenario] setup');
      // Connect to the database
      MongoClient.connect(schema.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;
        callback(err);
      });
    }

    /*
     * Runs for each executing process
     */
    CartScenario.prototype.teardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // console.log('[SCENARIO-CartScenario] teardown');
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    CartScenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Get the collection names
      var collectionNames = schema.collections;
      var numberOfProducts = schema.params.numberOfProducts;
      var numberOfItems = schema.params.numberOfItems;

      // Collections
      var collections = {
          carts: db.collection(collectionNames.carts || 'carts')
        , inventories: db.collection(collectionNames.inventories || 'inventories')
        , orders: db.collection(collectionNames.orders || 'orders')
        , products: db.collection(collectionNames.products || 'products')
      }

      // Get write concern
      var writeConcern = schema.writeConcern || {};
      
      // Metadata read preference
      var options = writeConcern.carts || {w:1, wtimeout: 10000}

      // Add product to cart
      var addProductToCart = function(options, callback) {
        var id = ((Math.round(Math.random() * numberOfProducts)) % numberOfProducts);
        // Add a product
        new Product(collections, id).reload(function(err, p) {
          if(err) return callback(err);
          cart.add(p, 1, options, function(err, r) {
            callback(err, r);
          });
        });
      }

      // Cart start time
      var startTime = microtime.now();
      // Create a new cart
      var cart = new Cart(collections, new ObjectId());
      cart.create(options, function(err, cart) {
        if(err) return callback(err);
        var left = numberOfItems;

        // Add the products
        for(var i = 0; i < numberOfItems; i++) {
          addProductToCart(options, function(err) {
            left = left - 1;

            if(left == 0) {
              cart.checkout({
                shipping: {}, payment: {}
              }, options, function(err, r) {
                // Get end time of the cart
                var endTime = microtime.now();
                services.log('second', 'cart_no_reservation_successful', {
                    start: startTime
                  , end: endTime
                  , time: endTime - startTime
                });

                // Finish the execution
                callback(err, r);
              });
            }
          });
        }
      });
    }

    return new CartScenario(services, scenario, schema);
  }
})
