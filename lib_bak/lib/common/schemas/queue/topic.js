"use strict";

var f = require('util').format,
  co = require('co');

/*
 * Represents a topic
 */
class Topic {
  constructor(collections, sizeInBytes, maxMessages) {
    this.sizeInBytes = sizeInBytes;
    this.maxMessages = maxMessages;
    this.topic = collections['topics'];
  }

  /*
   * Push an object to the topic
   */
  publish(object, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Insert a document into topic
        yield self.topic.insertOne({
            createdOn: new Date()
          , payload: object
        }, options);

        resolve();
      }).catch(reject);
    });
  }

  /*
   * Simple cursor builder, does not try to deal with reconnect etc
   */
  listen(from, options) {
    var query = {}
    options = options || {awaitData: true};
    // We provided a filter allowing us to skip ahead
    if(from) query.createdOn = { $gte: from };
    // Create cursor
    var cursor = this.topic.find(query);
    // Set the tailable cursor options
    cursor = cursor.addCursorFlag('tailable', true)
      .addCursorFlag('awaitData', options.awaitData);
    // Return the cursor
    return cursor;
  }

  /*
   * Create a topic
   */
  create() {
    // Get reference to self
    var self = this;
    // Collection options
    var options = {
        capped:true
      , size: self.sizeInBytes
    }
    // Get the collection name
    var collectionName = self.topic.collectionName;
    // Get the db object associated with the collection
    var db = self.topic.s.db;

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Create the capped collection
        var collection = yield db.createCollection(collectionName, options);
        self.topic = collection;
        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Topic;
