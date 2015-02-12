"use strict";

var setup = function(db, callback) {
  var Category = require('../../schemas/multilanguage/category')
    , Product = require('../../schemas/multilanguage/product');

  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  collections['products'].drop(function() {
    collections['categories'].drop(function() {
      Category.createOptimalIndexes(collections, function(err) {
        Product.createOptimalIndexes(collections, function(err) {
          callback();
        });
      });
    });
  });
}

var setupCategories = function(db, categories, callback) {
  var Category = require('../../schemas/multilanguage/category')
    , ObjectId = require('mongodb').ObjectId;
  var left = categories.length;

  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  // Iterate over all the categories
  for(var i = 0; i < categories.length; i++) {
    var category = new Category(collections, categories[i][0], categories[i][1]);
    category.create(function() {
      left = left - 1;

      if(left == 0) callback();
    });
  }
}

var setupProducts = function(db, products, callback) {
  var Product = require('../../schemas/multilanguage/product')
    , ObjectId = require('mongodb').ObjectId;
  var left = products.length;

  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  // Iterate over all the categories
  for(var i = 0; i < products.length; i++) {
    var product = new Product(collections, new ObjectId(), products[i][0], products[i][1], products[i][2], products[i][3]);
    product.create(function() {
      left = left - 1;

      if(left == 0) callback();
    });
  }
}

exports['Correctly add new local for a category and see it reflected in the products'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var Category = require('../../schemas/multilanguage/category')
      , Product = require('../../schemas/multilanguage/product')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          products: db.collection('products')
        , categories: db.collection('categories')
      }

      // Cleanup
      setup(db, function() {

        // Setup a bunch of categories
        var categories = [
          [1, {'en-us': 'car', 'de-de': 'auto'}]
        ];

        // Create all the categories
        setupCategories(db, categories, function() {
          
          // Locate the categories
          collections['categories'].find().toArray(function(err, categories) {
            test.equal(null, err);

            // Create a product
            var product = new Product(collections, 1, 'car', 100, 'usd', categories);
            product.create(function(err, product) {
              test.equal(null, err);              

              // Let's attempt to add a local to the category
              var cat = new Category(collections, 1);
              cat.addLocal('es-es', 'coche', function(err) {
                test.equal(null, err);

                // Reload the product
                product.reload(function(err, product) {
                  test.equal(null, err);
                  test.equal('coche', product.categories[0].names['es-es']);

                  cat.reload(function(err, cat) {
                    test.equal(null, err);
                    test.equal('coche', cat.names['es-es']);

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

exports['Correctly remove a local for a category and see it reflected in the products'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var Category = require('../../schemas/multilanguage/category')
      , Product = require('../../schemas/multilanguage/product')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {

        // All the collections used
        var collections = {
            products: db.collection('products')
          , categories: db.collection('categories')
        }

        // Setup a bunch of categories
        var categories = [
          [1, {'en-us': 'car', 'de-de': 'auto'}]
        ];

        // Create all the categories
        setupCategories(db, categories, function() {
          
          // Locate the categories
          collections['categories'].find().toArray(function(err, categories) {
            test.equal(null, err);

            // Create a product
            var product = new Product(collections, 1, 'car', 100, 'usd', categories);
            product.create(function(err, product) {
              test.equal(null, err);              

              // Let's attempt to add a local to the category
              var cat = new Category(collections, 1);
              cat.removeLocal('de-de', function(err) {
                test.equal(null, err);

                // Reload the product
                product.reload(function(err, product) {
                  test.equal(null, err);
                  test.equal(null, product.categories[0].names['de-de']);

                  cat.reload(function(err, cat) {
                    test.equal(null, err);
                    test.equal(null, cat.names['de-de']);

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