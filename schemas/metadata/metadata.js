"use strict";

var f = require('util').format;

var MetaData = function(db, id, metadata) {
  this.db = db;
  this.id = id;
  this.metadatas = db.collection('metadata');
  this.metadata = metadata;
}

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
MetaData.findByFields = function(db, fields, callback) {
  var queryParts = [];

  for(var name in fields) {
    queryParts.push({$elemMatch: {key: name, value: fields[name] }});
  }
  
  // Generate correct query  
  var finalQuery = queryParts.length == 1 
    ? { metadata: queryParts[0] } 
    : { metadata: { $all: queryParts } };
  // Execute the query
  db.collection('metadata').find(finalQuery).toArray(function(err, docs) {
    if(err) return callback(err);
    callback(null, docs.map(function(x) {
      return new MetaData(db, x._id, x.metadata);
    }));
  });
}

/*
 * Create the optimal indexes for the queries
 */
MetaData.createOptimalIndexes = function(db, callback) {
  db.collection('metadata').ensureIndex({"metadata.key": 1, "metadata.value": 1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = MetaData;