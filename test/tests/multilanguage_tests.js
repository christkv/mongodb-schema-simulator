"use strict";

var setup = function(db, callback) {
  var Category = require('../../schemas/multilanguage/category')
    , Product = require('../../schemas/multilanguage/product');

  db.collection('products').drop(function() {
    db.collection('categories').drop(function() {
      Category.createOptimalIndexes(db, function(err) {
        Product.createOptimalIndexes(db, function(err) {
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

  // Iterate over all the categories
  for(var i = 0; i < categories.length; i++) {
    var category = new Category(db, categories[i][0], categories[i][1]);
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

  // Iterate over all the categories
  for(var i = 0; i < products.length; i++) {
    var product = new Product(db, new ObjectId(), products[i][0], products[i][1], products[i][2], products[i][3]);
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

      // Cleanup
      setup(db, function() {

        // Setup a bunch of categories
        var categories = [
          [1, {'en-us': 'car', 'de-de': 'auto'}]
        ];

        // Create all the categories
        setupCategories(db, categories, function() {
          
          // Locate the categories
          db.collection('categories').find().toArray(function(err, categories) {
            test.equal(null, err);

            // Create a product
            var product = new Product(db, 1, 'car', 100, 'usd', categories);
            product.create(function(err, product) {
              test.equal(null, err);              

              // Let's attempt to add a local to the category
              var cat = new Category(db, 1);
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

        // Setup a bunch of categories
        var categories = [
          [1, {'en-us': 'car', 'de-de': 'auto'}]
        ];

        // Create all the categories
        setupCategories(db, categories, function() {
          
          // Locate the categories
          db.collection('categories').find().toArray(function(err, categories) {
            test.equal(null, err);

            // Create a product
            var product = new Product(db, 1, 'car', 100, 'usd', categories);
            product.create(function(err, product) {
              test.equal(null, err);              

              // Let's attempt to add a local to the category
              var cat = new Category(db, 1);
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