"use strict";

var f = require('util').format,
  co = require('co');

/*
 * Create a new metadata instance
 */
class MetaData {
  constructor(collections, id, metadata) {
    this.id = id;
    this.metadatas = collections['metadatas'];
    this.metadata = metadata;
  }

  /*
   * Create a new metadata document on mongodb
   */
  create() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Insert the metadata
        yield self.metadatas.insertOne({
            _id: self.id
          , metadata: self.metadata
        });

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Search using metadata fields
   */
  static findByFields(collections, fields, options) {
    var self = this;
    var queryParts = [];
    options = options || {};

    for(var name in fields) {
      queryParts.push({$elemMatch: {key: name, value: fields[name] }});
    }

    // Generate correct query
    var finalQuery = queryParts.length == 1
      ? { metadata: queryParts[0] }
      : { metadata: { $all: queryParts } };

    // Create cursor
    var cursor = collections['metadatas'].find(finalQuery);
    if(options.readPreference) {
      cursor.setReadPreference(options.readPreference);
    }

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Execute the query
        var docs = yield cursor.toArray();
        docs.map(function(x) {
          return new MetaData(collections, x._id, x.metadata);
        });

        resolve(docs);
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['metadatas'].ensureIndex({"metadata.key": 1, "metadata.value": 1});
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = MetaData;
