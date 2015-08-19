"use strict";

var co = require('co');

var createProducts = function(collections) {
  var products = [
      { _id: 1, name: 'product 1', price: 100}
    , { _id: 2, name: 'product 2', price: 200}
    , { _id: 3, name: 'product 3', price: 300}
    , { _id: 4, name: 'product 4', price: 400}
    , { _id: 5, name: 'product 5', price: 500}
    , { _id: 6, name: 'product 6', price: 600}
    , { _id: 7, name: 'product 7', price: 700}
  ];

  var inventories = [
      { _id: 1, quantity: 100}
    , { _id: 2, quantity: 100}
    , { _id: 3, quantity: 100}
    , { _id: 4, quantity: 100}
    , { _id: 5, quantity: 100}
    , { _id: 6, quantity: 1}
    , { _id: 7, quantity: 0}
  ]

  // All the collections used
  var collections = {
      products: collections['products']
    , inventories: collections['inventories']
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      // Insert all the products
      yield collections['products'].insertMany(products);
      // Insert all the associated product inventories
      yield collections['inventories'].insertMany(inventories);
      resolve();
    }).catch(reject);
  });
}

var setup = function(db, callback) {
  var Cart = require('../../lib/common/schemas/cart_reservation/cart')
    , Product = require('../../lib/common/schemas/cart_reservation/product')
    , Inventory = require('../../lib/common/schemas/cart_reservation/inventory')
    , Order = require('../../lib/common/schemas/cart_reservation/order');

  // All the collections used
  var collections = {
      products: db.collection('products')
    , orders: db.collection('orders')
    , carts: db.collection('carts')
    , inventories: db.collection('inventories')
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      // Drop all the collections
      try { collections['products'].drop(); } catch(err) {}
      try { collections['carts'].drop(); } catch(err) {}
      try { collections['inventories'].drop(); } catch(err) {}
      try { collections['orders'].drop(); } catch(err) {}

      // Create all indexes
      yield Cart.createOptimalIndexes(collections);
      yield Product.createOptimalIndexes(collections);
      yield Inventory.createOptimalIndexes(collections);
      yield Order.createOptimalIndexes(collections);
      yield createProducts(collections);

      resolve();
    }).catch(reject);
  });

}

exports['Should correctly add an item to the cart and checkout the cart successfully'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../lib/common/schemas/cart_reservation/cart')
      , Product = require('../../lib/common/schemas/cart_reservation/product')
      , Inventory = require('../../lib/common/schemas/cart_reservation/inventory')
      , Order = require('../../lib/common/schemas/cart_reservation/order');

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          products: db.collection('products')
        , orders: db.collection('orders')
        , carts: db.collection('carts')
        , inventories: db.collection('inventories')
      }

      // Cleanup
      yield setup(db);

      // Create cart
      var cart = new Cart(collections);
      yield cart.create();

      // Fetch a product
      var product = new Product(collections, 1);
      yield product.reload();

      // Add a product to the cart
      yield cart.add(product, 1);
      test.equal(cart.products.length, 1);

      // Checkout the cart
      yield cart.checkout({
          shipping: {}, payment: {}
        });

      // Validate the state of the cart and product
      var doc = yield collections['inventories'].findOne({_id: 1});
      test.equal(99, doc.quantity);
      test.equal(0, doc.reservations);

      // Validate the state of the cart
      var doc = yield collections['carts'].findOne({_id: cart.id});
      test.equal('completed', doc.state);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Should correctly add an item to the cart but fail to reserve the item in the inventory'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../lib/common/schemas/cart_reservation/cart')
      , Product = require('../../lib/common/schemas/cart_reservation/product')
      , Inventory = require('../../lib/common/schemas/cart_reservation/inventory')
      , Order = require('../../lib/common/schemas/cart_reservation/order');

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          products: db.collection('products')
        , orders: db.collection('orders')
        , carts: db.collection('carts')
        , inventories: db.collection('inventories')
      }

      // Cleanup
      yield setup(db);

      // Create cart
      var cart = new Cart(collections);
      yield cart.create();

      // Fetch a product
      var product = new Product(collections, 1);
      yield product.reload();

      try {
        // Add a product to the cart
        yield cart.add(product, 1000);
        reject(new Error('should not reach this'));
      } catch(err) {}

      // Retrieve the cart
      var doc = yield collections['carts'].findOne({_id: cart.id});
      test.equal(0, doc.products.length);
      test.equal('active', doc.state);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Should correctly add an item to the cart but fail to reserve the item in the inventory'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../lib/common/schemas/cart_reservation/cart')
      , Product = require('../../lib/common/schemas/cart_reservation/product')
      , Inventory = require('../../lib/common/schemas/cart_reservation/inventory')
      , Order = require('../../lib/common/schemas/cart_reservation/order');

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          products: db.collection('products')
        , orders: db.collection('orders')
        , carts: db.collection('carts')
        , inventories: db.collection('inventories')
      }

      // Cleanup
      yield setup(db);

      // Create cart
      var cart = new Cart(collections);
      yield cart.create();

      // Fetch a product
      var product = new Product(collections, 1);
      yield product.reload();

      // Add a product to the cart
      var addProductAndValidate = function() {
        return new Promise(function(resolve, reject) {
          co(function* () {
            yield cart.add(product, 2);

            // Validate cart and inventory
            var doc = yield collections['carts'].findOne({_id: cart.id});
            test.equal(1, doc.products.length);
            test.equal(2, doc.products[0].quantity);

            var doc = yield collections['inventories'].findOne({_id: product.id});
            test.equal(1, doc.reservations.length);
            test.equal(98, doc.quantity);
            test.equal(cart.id.toString(), doc.reservations[0]._id.toString());
            yield updateProductAndValidate();
            resolve();
          }).catch(function(err) {
            process.nextTick(function() {throw err});
          });
        });
      }

      // Update the quantity of a product
      var updateProductAndValidate = function(callback) {
        return new Promise(function(resolve, reject) {
          co(function* () {
            // Update the amount of a product
            yield cart.update(product, 4);

            // Validate cart and inventory
            var doc = yield collections['carts'].findOne({_id: cart.id});
            test.equal(1, doc.products.length);
            test.equal(4, doc.products[0].quantity);

            var doc = yield collections['inventories'].findOne({_id: product.id});
            test.equal(1, doc.reservations.length);
            test.equal(96, doc.quantity);
            test.equal(cart.id.toString(), doc.reservations[0]._id.toString());
            test.equal(4, doc.reservations[0].quantity);
            yield illegalQuantityAdjustment();
            resolve();
          }).catch(function(err) {
            process.nextTick(function() {throw err});
          });
        });
      }

      // Illegal product quantity adjustment
      var illegalQuantityAdjustment = function(callback) {
        return new Promise(function(resolve, reject) {
          co(function* () {
            try {
              // Fail to update due to not enough inventory available
              yield cart.update(product, 1000);
              reject(new Error('should not reach this'));
            } catch(err) {}

            // Validate cart and inventory
            var doc = yield collections['carts'].findOne({_id: cart.id});
            test.equal(1, doc.products.length);
            test.equal(4, doc.products[0].quantity);

            var doc = yield collections['inventories'].findOne({_id: product.id});
            test.equal(1, doc.reservations.length);
            test.equal(cart.id.toString(), doc.reservations[0]._id.toString());
            test.equal(96, doc.quantity);
            test.equal(4, doc.reservations[0].quantity);
            yield removeProductAndValidate();
            resolve();
          }).catch(function(err) {
            process.nextTick(function() {throw err});
          });
        });
      }

      var removeProductAndValidate = function(callback) {
        return new Promise(function(resolve, reject) {
          co(function* () {
            // Remove product from cart
            yield cart.remove(product);

            // Validate cart and inventory
            var doc = yield collections['carts'].findOne({_id: cart.id});
            test.equal(0, doc.products.length);

            var doc = yield collections['inventories'].findOne({_id: product.id});
            test.equal(0, doc.reservations.length);
            test.equal(100, doc.quantity);
            resolve();
          }).catch(function(err) {
            process.nextTick(function() {throw err});
          });
        });
      }

      // Remove product and validate
      yield addProductAndValidate();
      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Should correctly find expired carts and remove any reservations in them'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../lib/common/schemas/cart_reservation/cart')
      , Product = require('../../lib/common/schemas/cart_reservation/product')
      , Inventory = require('../../lib/common/schemas/cart_reservation/inventory')
      , Order = require('../../lib/common/schemas/cart_reservation/order');

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          products: db.collection('products')
        , orders: db.collection('orders')
        , carts: db.collection('carts')
        , inventories: db.collection('inventories')
      }

      // Cleanup
      yield setup(db);

      // Create cart
      var cart = new Cart(collections);
      yield cart.create();

      // Fetch a product
      var product = new Product(collections, 1);
      yield product.reload();

      // Add a product to the cart
      var addProductAndValidate = function(callback) {
        return new Promise(function(resolve, reject) {
          co(function* () {
            yield cart.add(product, 2);

            // Validate cart and inventory
            var doc = yield collections['carts'].findOne({_id: cart.id});
            test.equal(1, doc.products.length);
            test.equal(2, doc.products[0].quantity);

            var doc = yield collections['inventories'].findOne({_id: product.id});
            test.equal(1, doc.reservations.length);
            test.equal(98, doc.quantity);
            test.equal(cart.id.toString(), doc.reservations[0]._id.toString());
            resolve();
          }).catch(function(err) {
            process.nextTick(function() {throw err});
          });
        });
      }

      yield addProductAndValidate();
      // Set cart to expired
      var r = yield collections['carts'].updateOne({_id: cart.id}, {$set: {state: 'expired'}});
      test.equal(1, r.modifiedCount);

      // Expire the cart
      yield Cart.releaseExpired(collections);

      // Validate cart and inventory
      var doc = yield db.collection('carts').findOne({_id: cart.id});
      test.equal(1, doc.products.length);

      var doc = yield db.collection('inventories').findOne({_id: product.id});
      test.equal(0, doc.reservations.length);
      test.equal(100, doc.quantity);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}
