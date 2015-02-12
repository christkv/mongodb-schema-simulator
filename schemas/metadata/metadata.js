"use strict";

var f = require('util').format;

/*
 * Create a new metadata instance
 */
var MetaData = function(collections, id, metadata) {
  this.id = id;
  this.metadatas = collections['metadatas'];
  this.metadata = metadata;
}

/*
 * Create a new metadata document on mongodb
 */
MetaData.prototype.create = function(callback) {
  var self = this;
  // Insert the metadata
  this.metadatas.insertOne({
      _id: this.id
    , metadata: this.metadata
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Search using metadata fields
 */
MetaData.findByFields = function(collections, fields, callback) {
  var queryParts = [];

  for(var name in fields) {
    queryParts.push({$elemMatch: {key: name, value: fields[name] }});
  }
  
  // Generate correct query  
  var finalQuery = queryParts.length == 1 
    ? { metadata: queryParts[0] } 
    : { metadata: { $all: queryParts } };
  // Execute the query
  collections['metadatas'].find(finalQuery).toArray(function(err, docs) {
    if(err) return callback(err);
    callback(null, docs.map(function(x) {
      return new MetaData(collections, x._id, x.metadata);
    }));
  });
}

/*
 * Create the optimal indexes for the queries
 */
MetaData.createOptimalIndexes = function(collections, callback) {
  collections['metadatas'].ensureIndex({"metadata.key": 1, "metadata.value": 1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = MetaData;