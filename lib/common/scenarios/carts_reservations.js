"use strict";

var microtime = require('microtime')
  , co = require('co')
  , f = require('util').format;
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

/*
 * Build random products
 */
var buildRandomProducts = function(db, collections, numberOfProducts, quantityPrItem, sizeOfProductsInBytes, callback) {
  var Product = require('../schemas/cart_reservation/product')
    , Inventory = require('../schemas/cart_reservation/inventory')
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
  var createProduct = function(i) {
    // Return the promise
    return new Promise(function(resolve, reject) {
      co(function*() {
        yield new Product(cols, i, f('product_%s', i)
          , {bin: new Binary(new Buffer(sizeOfProductsInBytes))}).create()
        yield new Inventory(cols, i, quantityPrItem).create();
        resolve();
      }).catch(function(err) {
        console.log(err.stack)
        reject(err);
      });
    });
  }

  // Return the promise
  return new Promise(function(resolve, reject) {
    co(function*() {
      // console.log(f("[INFO] buildRandomProducts creating %s documents of size >= %s", numberOfProducts, sizeOfProductsInBytes));
      // Let's create the number of products required
      for(var i = 0; i < numberOfProducts; i++) {
        try {
          yield createProduct(i);
        } catch(err) {
          console.log(err.stack)
          errors.push(err);
        }
      }

      if(errors.length > 0) return reject(errors);
      resolve();
    }).catch(function(err) {
      console.log(err.stack)
      reject(err);
    });
  });
}

/*
 * Simple fixed items in cart simulation
 */
scenarios.push({
    name: 'cart_reservation_successful'
  , title: 'fixed number of cart items with reservation'
  , description: 'simulates successful carts with a fixed number of items in the cart with reservation'
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
    var Cart = require('../schemas/cart_reservation/cart')
      , Inventory = require('../schemas/cart_reservation/inventory')
      , Order = require('../schemas/cart_reservation/order')
      , Product = require('../schemas/cart_reservation/product')
      , ObjectId = require('mongodb').ObjectId;

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames) {
      // Collections
      var collections = {
          carts: db.collection(collectionNames.carts || 'carts')
        , inventories: db.collection(collectionNames.inventories || 'inventories')
        , orders: db.collection(collectionNames.orders || 'orders')
        , products: db.collection(collectionNames.products || 'products')
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          yield Cart.createOptimalIndexes(collections);
          yield Inventory.createOptimalIndexes(collections);
          yield Order.createOptimalIndexes(collections);
          yield Product.createOptimalIndexes(collections);
          resolve();
        }).catch(function(err) {
          console.log(err.stack)
          reject(err);
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options) {
      options = options || {};

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // console.log('[SCENARIO-Scenario] globalSetup');
          // Connect to the database
          var db = yield MongoClient.connect(schema.url);

          // Get the specific schema db if specified
          if(schema.db) db = db.db(schema.db);

          // Unpack the parameters
          var numberOfProducts = schema.params.numberOfProducts;
          var sizeOfProductsInBytes = schema.params.sizeOfProductsInBytes;
          var collections = schema.collections ? schema.collections : collections;

          // CreateIndex for all items
          yield createIndexes(db, collections);

          // Build products and then finish global setup
          var results = yield buildRandomProducts(db, collections, numberOfProducts, 1000000, sizeOfProductsInBytes);
          // Close the db
          db.close();
          resolve(results);
        }).catch(function(err) {
          console.log(err.stack)
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
          console.log(err.stack)
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
    Scenario.prototype.execute = function(options, callback) {
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
      var addProductToCart = function(cart, options, callback) {
        // Return the promise
        return new Promise(function(resolve, reject) {
          co(function*() {
            var id = ((Math.round(Math.random() * numberOfProducts)) % numberOfProducts);
            // Add a product
            var p = yield new Product(collections, id).reload();
            var r = yield cart.add(p, 1, options);
            resolve(r);
          }).catch(function(err) {
            console.log(err.stack)
            reject(err);
          });
        });
      }

      // Return the promise
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Cart start time
          var startTime = microtime.now();
          // Create a new cart
          var cart = new Cart(collections, new ObjectId());
          yield cart.create(options);

          // Add the products to the cart
          for(var i = 0; i < numberOfItems; i++) {
            yield addProductToCart(cart, options);
          }

          // Checkout the cart
          var r = yield cart.checkout({
            shipping: {}, payment: {}
          }, options);

          // Get end time of the cart
          var endTime = microtime.now();
          yield services.log('second', 'cart_reservation_successful', {
              start: startTime
            , end: endTime
            , time: endTime - startTime
          });

          // Finish the execution
          resolve(r);
        }).catch(function(err) {
          console.log(err.stack)
          reject(err);
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
})
