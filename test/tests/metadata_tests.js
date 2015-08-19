"use strict";

var co = require('co');

var setup = function(db) {
  var Metadata = require('../../lib/common/schemas/metadata/metadata');

  // All the collections used
  var collections = {
    metadatas: db.collection('metadatas')
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      try { yield collections['metadatas'].drop(); } catch(err) {};
      yield Metadata.createOptimalIndexes(collections);
      resolve();
    }).catch(reject);
  });
}

exports['Correctly random metadata and query by metadata field'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Metadata = require('../../lib/common/schemas/metadata/metadata')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
        metadatas: db.collection('metadatas')
      }

      // Cleanup
      yield setup(db);

      // Create metadata instance
      var metadata1 = new Metadata(collections, new ObjectId(), [
          { key: 'name', value: 'test image' }
        , { key: 'type', value: 'image' }
        , { key: 'iso', value: 100 }
      ]);

      // Create metadata instance
      var metadata2 = new Metadata(collections, new ObjectId(), [
          { key: 'name', value: 'test image 2' }
        , { key: 'type', value: 'image' }
        , { key: 'iso', value: 200 }
      ]);

      // Create metadata instance
      yield metadata1.create();
      yield metadata2.create();

      // Locate by single metadata field
      var items = yield Metadata.findByFields(collections, {type: 'image'});
      test.equal(2, items.length);

      // Locate by multiple metadata fields
      var items = yield Metadata.findByFields(collections, {type: 'image', iso: 100});
      test.equal(1, items.length);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}
