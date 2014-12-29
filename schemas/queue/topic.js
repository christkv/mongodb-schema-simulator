var f = require('util').format;

/*
 * Represents a topic
 */
var Topic = function(db, name, sizeInBytes, maxMessages) {
  this.db = db;
  this.name = name;
  this.sizeInBytes = sizeInBytes;
  this.maxMessages = maxMessages;
  this.topic = db.collection(name);
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

  var self = this;
  // Create the capped collection
  this.db.createCollection(this.name, options, function(err, collection) {
    if(err) return callback(err);
    self.topic = collection;
    callback(null, self);
  });
}

/*
 * Push an object to the topic
 */
Topic.prototype.publish = function(object, callback) {
  var self = this;
  // Insert a document into topic
  this.topic.insertOne({
      createdOn: new Date()
    , payload: object
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Simple cursor builder, does not try to deal with reconnect etc
 */
Topic.prototype.listen = function(from, callback) {
  if(typeof from == 'function') callback = from, from = null;
  var query = {}
  // We provided a filter allowing us to skip ahead
  if(from) query.createdOn = { $gte: from };
  // Create cursor
  var cursor = this.topic.find(query);
  // Set the tailable cursor options
  cursor = cursor.addCursorFlag('tailable', true)
    .addCursorFlag('awaidata', true);
  // Return the cursor
  return cursor;
}

module.exports = Topic;