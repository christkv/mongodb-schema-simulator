"use strict";

var createProducts = function(db, callback) {
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

  // Insert all the products
  db.collection('products').insertMany(products, function(err, r) {
    // Insert all the associated product inventories
    db.collection('inventories').insertMany(inventories, function(err, r) {
      callback();
    });
  });
}

var drop = function(db, callback) {
  db.collection('products').drop(function() {
    db.collection('carts').drop(function() {
      createProducts(db, callback);
    })
  });
}

exports['Should correctly add an item to the cart and checkout the cart'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../schemas/cart/cart')
      , Product = require('../../schemas/cart/product')
      , Inventory = require('../../schemas/cart/inventory')
      , Order = require('../../schemas/cart/order');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      drop(db, function() {
        var cart = new Cart(db);
        cart.create(function(err, cart) {
          test.equal(null, err);

          // Fetch a product
          var product = new Product(db, 1);
          product.reload(function(err, product) {
            test.equal(null, err);

            // Add a product to the cart
            cart.add(product, function(err, r) {
              test.equal(null, err);
              test.equal(cart.products.length, 1);

              // Checkout the cart
              cart.checkout(function(err, r) {
                test.equal(null, err);

                // Validate the state of the cart and product
                db.collection('inventories').findOne({_id: 1}, function(err, doc) {
                  test.equal(null, err);
                  test.equal(99, doc.quantity);
                  test.equal(0, doc.reserved);

                  // Validate the state of the cart
                  db.collection('carts').findOne({_id: cart._id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal('complete', doc.status);

                    db.close();
                    test.done();
                  });
                });
              });
            });
          });
        });
      });
    });
  }
}