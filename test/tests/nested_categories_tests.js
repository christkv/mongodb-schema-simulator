"use strict";

var co = require('co');

var setup = function(db, callback) {
  var Category = require('../../lib/common/schemas/nested_categories/category')
    , Product = require('../../lib/common/schemas/nested_categories/product');

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
  var Category = require('../../lib/common/schemas/nested_categories/category')
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
        var category = new Category(collections, new ObjectId(), categories[i][0], categories[i][1]);
        yield category.create();
      }

      resolve();
    }).catch(reject);
  });
}

var setupProducts = function(db, products, callback) {
  var Product = require('../../lib/common/schemas/nested_categories/product')
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

exports['Correctly category and fetch all immediate children of root node'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Category = require('../../lib/common/schemas/nested_categories/category')
      , Product = require('../../lib/common/schemas/nested_categories/product')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
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
          ['root', '/']
        , ['1', '/1'], ['2', '/2'], ['3', '/3']
        , ['1-1', '/1/1'], ['1-2', '/1/2']
        , ['2-1', '/2/1'], ['2-2', '/2/2']
        , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
      ];

      // Create all the categories
      yield setupCategories(db, categories);
      // Get all the immediate children of the root
      var categories = yield Category.findAllDirectChildCategories(collections, '/');
      test.equal(3, categories.length);
      var paths = {'/1':true, '/2':true, '/3':true};

      for(var i = 0; i < categories.length; i++) {
        if(paths[categories[i].category]) {
          delete paths[categories[i].category];
        }
      }

      test.equal(0, Object.keys(paths).length);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
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

    co(function* () {
      // Connect to mongodb
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
          ['root', '/']
        , ['1', '/1'], ['2', '/2'], ['3', '/3']
        , ['1-1', '/1/1'], ['1-2', '/1/2']
        , ['2-1', '/2/1'], ['2-2', '/2/2']
        , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
      ];

      // Create all the categories
      yield setupCategories(db, categories);

      // Get all the immediate children of the root
      var categories = yield Category.findAllChildCategories(collections, '/1');
      test.equal(2, categories.length);
      var paths = {'/1/1':true, '/1/2':true};

      for(var i = 0; i < categories.length; i++) {
        if(paths[categories[i].category]) {
          delete paths[categories[i].category];
        }
      }

      test.equal(0, Object.keys(paths).length);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
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

    co(function* () {
      // Connect to mongodb
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
          ['root', '/']
        , ['1', '/1'], ['2', '/2'], ['3', '/3']
        , ['1-1', '/1/1'], ['1-2', '/1/2']
        , ['2-1', '/2/1'], ['2-2', '/2/2']
        , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
      ];

      // Create all the categories
      yield setupCategories(db, categories);

      // Get all the immediate children of the root
      var category = yield Category.findOne(collections, '/1/1');
      test.equal('/1/1', category.category);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
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

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          products: db.collection('products')
        , categories: db.collection('categories')
      }

      // Cleanup
      yield setup(db);

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
      yield setupProducts(db, products);

      // Get all the immediate children of the root
      var products = yield Product.findByCategory(collections, '/');
      test.equal(1, products.length);
      test.equal('/', products[0].categories[0]);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
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

    co(function* () {
      // Connect to mongodb
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
          ['root', '/']
        , ['1', '/1'], ['2', '/2'], ['3', '/3']
        , ['1-1', '/1/1'], ['1-2', '/1/2']
        , ['2-1', '/2/1'], ['2-2', '/2/2']
        , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
      ];

      // Create all the categories
      yield setupCategories(db, categories);

      // Setup a bunch of categories
      var products = [
          ['prod1', 100, 'usd', ['/']]
        , ['prod2', 200, 'usd', ['/1']], ['prod3', 300, 'usd', ['/2']], ['prod4', 400, 'usd', ['/3']]
        , ['prod2-1', 200, 'usd', ['/1/1']], ['prod2-2', 200, 'usd', ['/1/2']]
        , ['prod3-1', 300, 'usd', ['/2/1']], ['prod3-2', 200, 'usd', ['/2/2']]
        , ['prod4-1', 300, 'usd', ['/3/1']], ['prod4-2', 200, 'usd', ['/3/2']], ['prod4-3', 200, 'usd', ['/3/3']]
      ];

      // Create all the categories
      yield setupProducts(db, products);

      // Get all the immediate children of the root
      var products = yield Product.findByDirectCategoryChildren(collections, '/');
      test.equal(3, products.length);
      var paths = {'/1':true, '/2':true, '/3':true};

      for(var i = 0; i < products.length; i++) {
        if(paths[products[i].categories[0]]) {
          delete paths[products[i].categories[0]];
        }
      }

      test.equal(0, Object.keys(paths).length);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
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

    co(function* () {
      // Connect to mongodb
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
          ['root', '/']
        , ['1', '/1'], ['2', '/2'], ['3', '/3']
        , ['1-1', '/1/1'], ['1-2', '/1/2']
        , ['2-1', '/2/1'], ['2-2', '/2/2']
        , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
      ];

      // Create all the categories
      yield setupCategories(db, categories);

      // Setup a bunch of categories
      var products = [
          ['prod1', 100, 'usd', ['/']]
        , ['prod2', 200, 'usd', ['/1']], ['prod3', 300, 'usd', ['/2']], ['prod4', 400, 'usd', ['/3']]
        , ['prod2-1', 200, 'usd', ['/1/1']], ['prod2-2', 200, 'usd', ['/1/2']]
        , ['prod3-1', 300, 'usd', ['/2/1']], ['prod3-2', 200, 'usd', ['/2/2']]
        , ['prod4-1', 300, 'usd', ['/3/1']], ['prod4-2', 200, 'usd', ['/3/2']], ['prod4-3', 200, 'usd', ['/3/3']]
      ];

      // Create all the categories
      yield setupProducts(db, products);

      // Get all the immediate children of the root
      var products = yield Product.findByCategoryTree(collections, '/1');
      test.equal(2, products.length);

      var paths = {'/1/1':true, '/1/2':true};

      for(var i = 0; i < products.length; i++) {
        if(paths[products[i].categories[0]]) {
          delete paths[products[i].categories[0]];
        }
      }

      test.equal(0, Object.keys(paths).length);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}
