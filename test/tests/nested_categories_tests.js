"use strict";

var setup = function(db, callback) {
  var Category = require('../../lib/common/schemas/nested_categories/category')
    , Product = require('../../lib/common/schemas/nested_categories/product');

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
  var Category = require('../../lib/common/schemas/nested_categories/category')
    , ObjectId = require('mongodb').ObjectId;
  var left = categories.length;

  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  // Iterate over all the categories
  for(var i = 0; i < categories.length; i++) {
    var category = new Category(collections, new ObjectId(), categories[i][0], categories[i][1]);
    category.create(function() {
      left = left - 1;

      if(left == 0) callback();
    });
  }
}

var setupProducts = function(db, products, callback) {
  var Product = require('../../lib/common/schemas/nested_categories/product')
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

exports['Correctly category and fetch all immediate children of root node'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Category = require('../../lib/common/schemas/nested_categories/category')
      , Product = require('../../lib/common/schemas/nested_categories/product')
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
            ['root', '/']
          , ['1', '/1'], ['2', '/2'], ['3', '/3']
          , ['1-1', '/1/1'], ['1-2', '/1/2']
          , ['2-1', '/2/1'], ['2-2', '/2/2']
          , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
        ];

        // Create all the categories
        setupCategories(db, categories, function() {
          // Get all the immediate children of the root
          Category.findAllDirectChildCategories(collections, '/', function(err, categories) {
            test.equal(null, err);
            test.equal(3, categories.length);
            test.equal('/1', categories[0].category);
            test.equal('/2', categories[1].category);
            test.equal('/3', categories[2].category);

            db.close();
            test.done();
          });
        });
      });
    });
  }
}

exports['Correctly fetch Category tree under a specific path'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Category = require('../../lib/common/schemas/nested_categories/category')
      , Product = require('../../lib/common/schemas/nested_categories/product')
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
            ['root', '/']
          , ['1', '/1'], ['2', '/2'], ['3', '/3']
          , ['1-1', '/1/1'], ['1-2', '/1/2']
          , ['2-1', '/2/1'], ['2-2', '/2/2']
          , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
        ];

        // Create all the categories
        setupCategories(db, categories, function() {

          // Get all the immediate children of the root
          Category.findAllChildCategories(collections, '/1', function(err, categories) {
            test.equal(null, err);
            test.equal(2, categories.length);
            test.equal('/1/1', categories[0].category);
            test.equal('/1/2', categories[1].category);

            db.close();
            test.done();
          });
        });
      });
    });
  }
}

exports['Correctly fetch specific category'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Category = require('../../lib/common/schemas/nested_categories/category')
      , Product = require('../../lib/common/schemas/nested_categories/product')
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
            ['root', '/']
          , ['1', '/1'], ['2', '/2'], ['3', '/3']
          , ['1-1', '/1/1'], ['1-2', '/1/2']
          , ['2-1', '/2/1'], ['2-2', '/2/2']
          , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
        ];

        // Create all the categories
        setupCategories(db, categories, function() {

          // Get all the immediate children of the root
          Category.findOne(collections, '/1/1', function(err, category) {
            test.equal(null, err);
            test.equal('/1/1', category.category);

            db.close();
            test.done();
          });
        });
      });
    });
  }
}

exports['Correctly fetch all products of a specific category'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Product = require('../../lib/common/schemas/nested_categories/product')
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

        //name, cost, currency, categories
        // Setup a bunch of categories
        var products = [
            ['prod1', 100, 'usd', ['/']]
          , ['prod2', 200, 'usd', ['/1']], ['prod3', 300, 'usd', ['/2']], ['prod4', 400, 'usd', ['/3']]
          , ['prod2-1', 200, 'usd', ['/1/1']], ['prod2-2', 200, 'usd', ['/1/2']]
          , ['prod3-1', 300, 'usd', ['/2/1']], ['prod3-2', 200, 'usd', ['/2/2']]
          , ['prod4-1', 300, 'usd', ['/3/1']], ['prod4-2', 200, 'usd', ['/3/2']], ['prod4-3', 200, 'usd', ['/3/3']]
        ];

        // Create all the categories
        setupProducts(db, products, function() {

          // Get all the immediate children of the root
          Product.findByCategory(collections, '/', function(err, products) {
            test.equal(null, err);
            test.equal(1, products.length);
            test.equal('/', products[0].categories[0]);

            db.close();
            test.done();
          });
        });
      });
    });
  }
}

exports['Correctly fetch all products of a specific categories direct children'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Product = require('../../lib/common/schemas/nested_categories/product')
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
            ['root', '/']
          , ['1', '/1'], ['2', '/2'], ['3', '/3']
          , ['1-1', '/1/1'], ['1-2', '/1/2']
          , ['2-1', '/2/1'], ['2-2', '/2/2']
          , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
        ];

        // Create all the categories
        setupCategories(db, categories, function() {

          // Setup a bunch of categories
          var products = [
              ['prod1', 100, 'usd', ['/']]
            , ['prod2', 200, 'usd', ['/1']], ['prod3', 300, 'usd', ['/2']], ['prod4', 400, 'usd', ['/3']]
            , ['prod2-1', 200, 'usd', ['/1/1']], ['prod2-2', 200, 'usd', ['/1/2']]
            , ['prod3-1', 300, 'usd', ['/2/1']], ['prod3-2', 200, 'usd', ['/2/2']]
            , ['prod4-1', 300, 'usd', ['/3/1']], ['prod4-2', 200, 'usd', ['/3/2']], ['prod4-3', 200, 'usd', ['/3/3']]
          ];

          // Create all the categories
          setupProducts(db, products, function() {

            // Get all the immediate children of the root
            Product.findByDirectCategoryChildren(collections, '/', function(err, products) {
              test.equal(null, err);
              test.equal(3, products.length);
              test.equal('/1', products[0].categories[0]);
              test.equal('/2', products[1].categories[0]);
              test.equal('/3', products[2].categories[0]);

              db.close();
              test.done();
            });
          });
        });
      });
    });
  }
}

exports['Correctly fetch all products of a specific categories tree'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Product = require('../../lib/common/schemas/nested_categories/product')
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
            ['root', '/']
          , ['1', '/1'], ['2', '/2'], ['3', '/3']
          , ['1-1', '/1/1'], ['1-2', '/1/2']
          , ['2-1', '/2/1'], ['2-2', '/2/2']
          , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
        ];

        // Create all the categories
        setupCategories(db, categories, function() {

          // Setup a bunch of categories
          var products = [
              ['prod1', 100, 'usd', ['/']]
            , ['prod2', 200, 'usd', ['/1']], ['prod3', 300, 'usd', ['/2']], ['prod4', 400, 'usd', ['/3']]
            , ['prod2-1', 200, 'usd', ['/1/1']], ['prod2-2', 200, 'usd', ['/1/2']]
            , ['prod3-1', 300, 'usd', ['/2/1']], ['prod3-2', 200, 'usd', ['/2/2']]
            , ['prod4-1', 300, 'usd', ['/3/1']], ['prod4-2', 200, 'usd', ['/3/2']], ['prod4-3', 200, 'usd', ['/3/3']]
          ];

          // Create all the categories
          setupProducts(db, products, function() {

            // Get all the immediate children of the root
            Product.findByCategoryTree(collections, '/1', function(err, products) {
              test.equal(null, err);
              test.equal(2, products.length);
              test.equal('/1/1', products[0].categories[0]);
              test.equal('/1/2', products[1].categories[0]);

              db.close();
              test.done();
            });
          });
        });
      });
    });
  }
}
