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
    }).catch(function(err) {
      reject(err);
    });
  });
}

var setup = function(db) {
  var Cart = require('../../lib/common/schemas/cart_no_reservation/cart')
    , Product = require('../../lib/common/schemas/cart_no_reservation/product')
    , Inventory = require('../../lib/common/schemas/cart_no_reservation/inventory')
    , Order = require('../../lib/common/schemas/cart_no_reservation/order');


  // All the collections used
  var collections = {
      products: db.collection('products')
    , orders: db.collection('orders')
    , carts: db.collection('carts')
    , inventories: db.collection('inventories')
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      try { yield collections['products'].drop(); } catch(err) {}
      try { yield collections['carts'].drop(); } catch(err) {}
      try { yield collections['inventories'].drop(); } catch(err) {}
      try { yield collections['orders'].drop(); } catch(err) {}

      yield Cart.createOptimalIndexes(collections);
      yield Product.createOptimalIndexes(collections);
      yield Inventory.createOptimalIndexes(collections);
      yield Order.createOptimalIndexes(collections);
      yield createProducts(collections);
      resolve();
    }).catch(function(err) {
      reject(err);
    });
  });
}

exports['Should correctly add an item to the cart and checkout the cart successfully'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../lib/common/schemas/cart_no_reservation/cart')
      , Product = require('../../lib/common/schemas/cart_no_reservation/product')
      , Inventory = require('../../lib/common/schemas/cart_no_reservation/inventory')
      , Order = require('../../lib/common/schemas/cart_no_reservation/order');

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
      // Create a cart
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
          shipping: {}
        , payment: {}});

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
      , Cart = require('../../lib/common/schemas/cart_no_reservation/cart')
      , Product = require('../../lib/common/schemas/cart_no_reservation/product')
      , Inventory = require('../../lib/common/schemas/cart_no_reservation/inventory')
      , Order = require('../../lib/common/schemas/cart_no_reservation/order');

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
      // Create a cart
      var cart = new Cart(collections);
      yield cart.create();

      // Fetch a product
      var product = new Product(collections, 1);
      yield product.reload();

      // Add a product to the cart
      yield cart.add(product, 1000);

      try {
        // Attempt to checkout the cart
        yield cart.checkout({
            shipping: {}
          , payment: {}});
      } catch(err) {}

      // Validate the state of the cart and product
      var doc = yield collections['inventories'].findOne({_id: 1});
      test.equal(100, doc.quantity);

      // Validate the state of the cart
      var doc = yield collections['carts'].findOne({_id: cart.id});
      test.equal('active', doc.state);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Should correctly add multiple items to the cart but fail to reserve the item in the inventory'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../lib/common/schemas/cart_no_reservation/cart')
      , Product = require('../../lib/common/schemas/cart_no_reservation/product')
      , Inventory = require('../../lib/common/schemas/cart_no_reservation/inventory')
      , Order = require('../../lib/common/schemas/cart_no_reservation/order');

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
      // Create a cart
      var cart = new Cart(collections);
      yield cart.create();

      // Fetch a product
      var product = new Product(collections, 1);
      yield product.reload();

      // Fetch a product
      var product1 = new Product(collections, 2);
      yield product1.reload();

      // Add a product to the cart
      yield cart.add(product1, 10);

      // Add a product to the cart
      yield cart.add(product, 1000);

      // Attempt to checkout the cart
      try {
        yield cart.checkout({
            shipping: {}
          , payment: {}});
      } catch(err) {
        test.equal(1, err.products.length);
      }

      // Validate the state of the cart and product
      var doc = yield collections['inventories'].findOne({_id: 1});
      test.equal(100, doc.quantity);

      // Validate the state of the cart
      var doc = yield collections['carts'].findOne({_id: cart.id});
      test.equal('active', doc.state);

      db.close();
      test.done();
    });
  }
}
