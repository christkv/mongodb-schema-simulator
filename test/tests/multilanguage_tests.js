"use strict";

var co = require('co');

var setup = function(db) {
  var Category = require('../../lib/common/schemas/multilanguage/category')
    , Product = require('../../lib/common/schemas/multilanguage/product');

  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      try { yield collections['products'].drop(); } catch(err) {};
      try { yield collections['categories'].drop(); } catch(err) {};
      yield Category.createOptimalIndexes(collections);
      yield Product.createOptimalIndexes(collections);
      resolve();
    }).catch(reject);
  });
}

var setupCategories = function(db, categories, callback) {
  var Category = require('../../lib/common/schemas/multilanguage/category')
    , ObjectId = require('mongodb').ObjectId;

  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      // Iterate over all the categories
      for(var i = 0; i < categories.length; i++) {
        var category = new Category(collections, categories[i][0], categories[i][1]);
        yield category.create();
      }

      resolve();
    }).catch(reject);
  });
}

var setupProducts = function(db, products, callback) {
  var Product = require('../../lib/common/schemas/multilanguage/product')
    , ObjectId = require('mongodb').ObjectId;

  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      // Iterate over all the categories
      for(var i = 0; i < products.length; i++) {
        var product = new Product(collections, new ObjectId(), products[i][0], products[i][1], products[i][2], products[i][3]);
        yield product.create();
      }

      resolve();
    }).catch(reject);
  });
}

exports['Correctly add new local for a category and see it reflected in the products'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Category = require('../../lib/common/schemas/multilanguage/category')
      , Product = require('../../lib/common/schemas/multilanguage/product')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          products: db.collection('products')
        , categories: db.collection('categories')
      }

      // Cleanup
      yield setup(db);

      // Setup a bunch of categories
      var categories = [
        [1, {'en-us': 'car', 'de-de': 'auto'}]
      ];

      // Create all the categories
      yield setupCategories(db, categories);

      // Locate the categories
      var categories = yield collections['categories'].find().toArray();

      // Create a product
      var product = new Product(collections, 1, 'car', 100, 'usd', categories);
      yield product.create();

      // Let's attempt to add a local to the category
      var cat = new Category(collections, 1);
      yield cat.addLocal('es-es', 'coche');

      // Reload the product
      yield product.reload();
      test.equal('coche', product.categories[0].names['es-es']);

      yield cat.reload();
      test.equal('coche', cat.names['es-es']);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Correctly remove a local for a category and see it reflected in the products'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Category = require('../../lib/common/schemas/multilanguage/category')
      , Product = require('../../lib/common/schemas/multilanguage/product')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          products: db.collection('products')
        , categories: db.collection('categories')
      }

      // Setup a bunch of categories
      var categories = [
        [1, {'en-us': 'car', 'de-de': 'auto'}]
      ];


      // Cleanup
      yield setup(db);

      // Create all the categories
      yield setupCategories(db, categories);

      // Locate the categories
      var categories = yield collections['categories'].find().toArray();

      // Create a product
      var product = new Product(collections, 1, 'car', 100, 'usd', categories);
      yield product.create();

      // Let's attempt to add a local to the category
      var cat = new Category(collections, 1);
      yield cat.removeLocal('de-de');

      // Reload the product
      yield product.reload();
      test.equal(null, product.categories[0].names['de-de']);

      yield cat.reload();
      test.equal(null, cat.names['de-de']);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}
