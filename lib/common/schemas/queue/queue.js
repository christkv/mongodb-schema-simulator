"use strict";

var f = require('util').format
  , ObjectId = require('mongodb').ObjectId;

var clone = function(obj) {
  var o = {};
  for(var name in obj) o[name] = obj[name];
  return o;
}

/*
 * Represents a work item from the queue
 */
var Work = function(collection, jobId) {
  this.queue = collection;
  // this.doc = doc;
  this.jobId = jobId;
}

/*
 * Sets an end time on the work item signaling it's done
 */
Work.prototype.done = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Set end time for the work item
  this.queue.updateOne({
    jobId: this.jobId
  }, {
    $set: { endTime: new Date() }
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('failed to set work item with jobId %s to done', self.jobId)));
    callback(null, self);
  })
}

/*
 * Represents a Queue
 */
var Queue = function(collections) {
  this.queue = collections['queues'];
  // Used for non findAndModifyQueueLookup
  this.reserved = {};
}

/*
 * Publish a new item on the queue with a specific priority
 */
Queue.prototype.publish = function(priority, object, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Create 0 date
  var zeroDate = new Date();
  zeroDate.setTime(0);

  // Insert the new item into the queue
  this.queue.insertOne({
      startTime: zeroDate
    , endTime: zeroDate
    , jobId: new ObjectId("000000000000")
    , createdOn: new Date()
    , priority: priority
    , payload: object
  }, options, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Fetch the next highest available priority item
 */
Queue.prototype.fetchByPriority = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Set the options
  options = clone(options);
  options['sort'] = {priority: -1, createdOn: 1};

  // Find one and update, returning a work item
  this.queue.findOneAndUpdate({
    startTime: null
  }, {
    $set: { startTime: new Date() }
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.value == null) return callback(new Error('found no message in queue'));
    callback(null, new Work(self.queue, r.value));
  });
}

/*
 * Fetch the next item in FIFO fashion (by createdOn timestamp)
 */
Queue.prototype.fetchFIFO = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Zero date (done so we can test capped collections where documents cannot grow)
  var zeroDate = new Date();
  zeroDate.setTime(0);

  // Set the options
  options = clone(options);
  options.sort = { createdOn: 1 };
  
  // Find one and update, returning a work item
  this.queue.findOneAndUpdate({
    startTime: zeroDate
  }, {
    $set: { startTime: new Date() }
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.value == null) return callback(new Error('found no message in queue'));
    callback(null, new Work(self.queue, r.value));
  });
}

/*
 * Create the optimal indexes for the queries
 */
Queue.createOptimalIndexes = function(collections, callback) {
  collections['queues'].ensureIndex({startTime:1}, function(err, result) {
    if(err) return callback(err);
    
    collections['queues'].ensureIndex({createdOn: 1}, function(err, result) {
      if(err) return callback(err);

      collections['queues'].ensureIndex({priority:-1, createdOn: 1}, function(err, result) {
        if(err) return callback(err);

        collections['queues'].ensureIndex({jobId: 1}, function(err, result) {
          if(err) return callback(err);
          callback();
        });
      });
    });
  });
}

module.exports = Queue;