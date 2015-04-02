"use strict";

var f = require('util').format;

/*
 * Represents a topic
 */
var Topic = function(collections, sizeInBytes, maxMessages) {
  this.sizeInBytes = sizeInBytes;
  this.maxMessages = maxMessages;
  this.topic = collections['topics'];
}

/*
 * Push an object to the topic
 */
Topic.prototype.publish = function(object, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Insert a document into topic
  this.topic.insertOne({
      createdOn: new Date()
    , payload: object
  }, options, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Simple cursor builder, does not try to deal with reconnect etc
 */
Topic.prototype.listen = function(from) {
  if(typeof from == 'function') callback = from, from = null;
  var query = {}
  // We provided a filter allowing us to skip ahead
  if(from) query.createdOn = { $gte: from };
  // Create cursor
  var cursor = this.topic.find(query);
  // Set the tailable cursor options
  cursor = cursor.addCursorFlag('tailable', true)
    .addCursorFlag('awaitData', true);
  // Return the cursor
  return cursor;
}

/*
 * Create a topic
 */
Topic.prototype.create = function(callback) {
  // Collection options
  var options = {
      capped:true
    , size: this.sizeInBytes
  }
  // Get reference to self
  var self = this;
  // Get the collection name
  var collectionName = this.topic.collectionName;
  // Get the db object associated with the collection
  var db = this.topic.s.db;
  
  // Create the capped collection
  db.createCollection(collectionName, options, function(err, collection) {
    if(err) return callback(err);
    self.topic = collection;
    callback(null, self);
  });
}

/*
 * Create the optimal indexes for the queries
 */
Topic.createOptimalIndexes = function(collections, callback) {
  callback();
}

module.exports = Topic;