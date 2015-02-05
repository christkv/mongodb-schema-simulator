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

var setup = function(db, callback) {
  var Cart = require('../../schemas/cart_reservation/cart')
    , Product = require('../../schemas/cart_reservation/product')
    , Inventory = require('../../schemas/cart_reservation/inventory')
    , Order = require('../../schemas/cart_reservation/order');

  // Collections
  var carts = db.collection('carts');
  var products = db.collection('products');
  var orders = db.collection('orders');
  var inventories = db.collection('inventories');

  products.drop(function() {
    carts.drop(function() {
      inventories.drop(function() {
        orders.drop(function() {
          Cart.createOptimalIndexes(carts, function() {
            Product.createOptimalIndexes(products, function() {
              Inventory.createOptimalIndexes(inventories, function() {
                Order.createOptimalIndexes(orders, function() {
                  createProducts(db, callback);
                });
              });
            });
          });
        });
      });
    });
  });
}

exports['Should correctly add an item to the cart and checkout the cart successfully'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../schemas/cart_reservation/cart')
      , Product = require('../../schemas/cart_reservation/product')
      , Inventory = require('../../schemas/cart_reservation/inventory')
      , Order = require('../../schemas/cart_reservation/order');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        var cart = new Cart(db.collection('carts'), db.collection('inventories'), db.collection('orders'));
        cart.create(function(err, cart) {
          test.equal(null, err);

          // Fetch a product
          var product = new Product(db.collection('products'), 1);
          product.reload(function(err, product) {
            test.equal(null, err);

            // Add a product to the cart
            cart.add(product, 1, function(err, r) {
              test.equal(null, err);
              test.equal(cart.products.length, 1);

              // Checkout the cart
              cart.checkout({
                  shipping: {}, payment: {}
                }, function(err, r) {
                  test.equal(null, err);

                  // Validate the state of the cart and product
                  db.collection('inventories').findOne({_id: 1}, function(err, doc) {
                    test.equal(null, err);
                    test.equal(99, doc.quantity);
                    test.equal(0, doc.reservations);

                    // Validate the state of the cart
                    db.collection('carts').findOne({_id: cart.id}, function(err, doc) {
                      test.equal(null, err);
                      test.equal('completed', doc.state);

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

exports['Should correctly add an item to the cart but fail to reserve the item in the inventory'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../schemas/cart_reservation/cart')
      , Product = require('../../schemas/cart_reservation/product')
      , Inventory = require('../../schemas/cart_reservation/inventory')
      , Order = require('../../schemas/cart_reservation/order');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        var cart = new Cart(db.collection('carts'), db.collection('inventories'), db.collection('orders'));
        cart.create(function(err, cart) {
          test.equal(null, err);

          // Fetch a product
          var product = new Product(db.collection('products'), 1);
          product.reload(function(err, product) {
            test.equal(null, err);

            // Add a product to the cart
            cart.add(product, 1000, function(err, r) {
              test.ok(err != null);

              // Retrieve the cart
              db.collection('carts').findOne({_id: cart.id}, function(err, doc) {
                test.equal(null, err);
                test.equal(0, doc.products.length);
                test.equal('active', doc.state);

                db.close();
                test.done();
              });
            });
          });
        });
      });
    });
  }
}

exports['Should correctly add an item to the cart but fail to reserve the item in the inventory'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../schemas/cart_reservation/cart')
      , Product = require('../../schemas/cart_reservation/product')
      , Inventory = require('../../schemas/cart_reservation/inventory')
      , Order = require('../../schemas/cart_reservation/order');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        var cart = new Cart(db.collection('carts'), db.collection('inventories'), db.collection('orders'));
        cart.create(function(err, cart) {
          test.equal(null, err);

          // Fetch a product
          var product = new Product(db.collection('products'), 1);
          product.reload(function(err, product) {
            test.equal(null, err);

            // Add a product to the cart
            var addProductAndValidate = function(callback) {
              cart.add(product, 2, function(err, r) {
                test.equal(null, err);

                // Validate cart and inventory
                db.collection('carts').findOne({_id: cart.id}, function(err, doc) {
                  test.equal(null, err);
                  test.equal(1, doc.products.length);
                  test.equal(2, doc.products[0].quantity);

                  db.collection('inventories').findOne({_id: product.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal(1, doc.reservations.length);
                    test.equal(98, doc.quantity);
                    test.equal(cart.id.toString(), doc.reservations[0]._id.toString());
                    updateProductAndValidate(callback);
                  });
                });
              });
            }

            // Update the quantity of a product
            var updateProductAndValidate = function(callback) {
              // Update the amount of a product
              cart.update(product, 4, function(err, r) {
                test.equal(null, err);

                // Validate cart and inventory
                db.collection('carts').findOne({_id: cart.id}, function(err, doc) {
                  test.equal(null, err);
                  test.equal(1, doc.products.length);
                  test.equal(4, doc.products[0].quantity);

                  db.collection('inventories').findOne({_id: product.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal(1, doc.reservations.length);
                    test.equal(96, doc.quantity);
                    test.equal(cart.id.toString(), doc.reservations[0]._id.toString());
                    test.equal(4, doc.reservations[0].quantity);
                    illegalQuantityAdjustment(callback);
                  });
                });
              });
            }

            // Illegal product quantity adjustment
            var illegalQuantityAdjustment = function(callback) {
              // Fail to update due to not enough inventory available
              cart.update(product, 1000, function(err, r) {
                test.ok(err != null);

                // Validate cart and inventory
                db.collection('carts').findOne({_id: cart.id}, function(err, doc) {
                  test.equal(null, err);
                  test.equal(1, doc.products.length);
                  test.equal(4, doc.products[0].quantity);

                  db.collection('inventories').findOne({_id: product.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal(1, doc.reservations.length);
                    test.equal(cart.id.toString(), doc.reservations[0]._id.toString());
                    test.equal(96, doc.quantity);
                    test.equal(4, doc.reservations[0].quantity);
                    removeProductAndValidate(callback);
                  });
                });
              });
            }

            var removeProductAndValidate = function(callback) {
              // Remove product from cart
              cart.remove(product, function(err, r) {
                test.equal(null, err);

                // Validate cart and inventory
                db.collection('carts').findOne({_id: cart.id}, function(err, doc) {
                  test.equal(null, err);
                  test.equal(0, doc.products.length);

                  db.collection('inventories').findOne({_id: product.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal(0, doc.reservations.length);
                    test.equal(100, doc.quantity);
                    callback();
                  });
                });
              });
            }

            // Remove product and validate
            addProductAndValidate(function() {
              db.close();
              test.done();
            });
          });
        });
      });
    });
  }
}

exports['Should correctly find expired carts and remove any reservations in them'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Cart = require('../../schemas/cart_reservation/cart')
      , Product = require('../../schemas/cart_reservation/product')
      , Inventory = require('../../schemas/cart_reservation/inventory')
      , Order = require('../../schemas/cart_reservation/order');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {

        var cart = new Cart(db.collection('carts'), db.collection('inventories'), db.collection('orders'));
        cart.create(function(err, cart) {
          test.equal(null, err);

          // Fetch a product
          var product = new Product(db.collection('products'), 1);
          product.reload(function(err, product) {
            test.equal(null, err);

            // Add a product to the cart
            var addProductAndValidate = function(callback) {
              cart.add(product, 2, function(err, r) {
                test.equal(null, err);

                // Validate cart and inventory
                db.collection('carts').findOne({_id: cart.id}, function(err, doc) {
                  test.equal(null, err);
                  test.equal(1, doc.products.length);
                  test.equal(2, doc.products[0].quantity);

                  db.collection('inventories').findOne({_id: product.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal(1, doc.reservations.length);
                    test.equal(98, doc.quantity);
                    test.equal(cart.id.toString(), doc.reservations[0]._id.toString());
                    callback();
                  });
                });
              });
            }

            addProductAndValidate(function() {
              // Set cart to expired
              db.collection('carts').updateOne({_id: cart.id}, {$set: {state: 'expired'}}, function(err, r) {
                test.equal(null, err);
                test.equal(1, r.modifiedCount);

                // Expire the cart
                Cart.releaseExpired(db.collection('carts'), db.collection('inventories'), function(err) {
                  test.equal(null, err);

                  // Validate cart and inventory
                  db.collection('carts').findOne({_id: cart.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal(1, doc.products.length);

                    db.collection('inventories').findOne({_id: product.id}, function(err, doc) {
                      test.equal(null, err);
                      test.equal(0, doc.reservations.length);
                      test.equal(100, doc.quantity);

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
    });
  }
}
