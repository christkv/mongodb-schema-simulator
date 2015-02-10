"use strict";

var setup = function(db, callback) {
  var Metadata = require('../../schemas/metadata/metadata');

  var collection = db.collection('metadata');
  collection.drop(function() {
    Metadata.createOptimalIndexes(collection, function(err) {
      callback();
    });
  });
}

exports['Correctly random metadata and query by metadata field'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var Metadata = require('../../schemas/metadata/metadata')
      , ObjectId = require('mongodb').ObjectId
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {
        var collection = db.collection('metadata');
        // Create metadata instance
        var metadata1 = new Metadata(collection, new ObjectId(), [
            { key: 'name', value: 'test image' }
          , { key: 'type', value: 'image' }
          , { key: 'iso', value: 100 }
        ]);

        // Create metadata instance
        var metadata2 = new Metadata(collection, new ObjectId(), [
            { key: 'name', value: 'test image 2' }
          , { key: 'type', value: 'image' }
          , { key: 'iso', value: 200 }
        ]);

        // Create metadata instance
        metadata1.create(function(err, metadata1) {
          test.equal(null, err);

          metadata2.create(function(err, metadata2) {
            test.equal(null, err);

            // Locate by single metadata field
            Metadata.findByFields(collection, {type: 'image'}, function(err, items) {
              test.equal(null, err);
              test.equal(2, items.length);

              // Locate by multiple metadata fields
              Metadata.findByFields(collection, {type: 'image', iso: 100}, function(err, items) {
                test.equal(null, err);
                test.equal(1, items.length);

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