"use strict";

var f = require('util').format
  , ObjectId = require('mongodb').ObjectId;

/*
 * Represents a work item from the queue
 */
var Work = function(collection, doc) {
  this.queue = collection;
  this.doc = doc;
}

/*
 * Sets an end time on the work item signaling it's done
 */
Work.prototype.done = function(callback) {
  var self = this;
  // Set end time for the work item
  this.queue.updateOne({
    _id: this.doc._id
  }, {
    $set: { endTime: new Date() }
  }, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('failed to set work item with id %s to done', self.doc._id)));
    callback(null, self);
  })
}

/*
 * Represents a Queue
 */
var Queue = function(collections) {
  this.queue = collections['queues'];
}

/*
 * Publish a new item on the queue with a specific priority
 */
Queue.prototype.publish = function(priority, object, callback) {
  var self = this;
  // Insert the new item into the queue
  this.queue.insertOne({
      startTime: null
    , endTime: null
    , createdOn: new Date()
    , priority: priority
    , payload: object
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 * Fetch the next highest available priority item
 */
Queue.prototype.fetchByPriority = function(callback) {
  var self = this;
  // Find one and update, returning a work item
  this.queue.findOneAndUpdate({
    startTime: null
  }, {
    $set: { startTime: new Date() }
  }, {
    sort: {priority: -1, createdOn: 1}
  }, function(err, r) {
    if(err) return callback(err);
    if(r.value == null) return callback(new Error('found no message in queue'));
    callback(null, new Work(self.queue, r.value));
  });
}

/*
 * Fetch the next highest available priority item but avoiding findAndModify
 */
Queue.prototype.fetchByPriorityNoFindAndModify = function(options, _callback) {
  if(typeof options == 'function') _callback = options, options = {};
  // Number of retries
  var retries = typeof options.retries == 'number' ? options.retries : 10;
  var interval = typeof options.interval == 'number' ? options.interval : 100;
  var retriesLeft = retries;
  var self = this;
  var jobId = new ObjectId();

  // Retry the operation
  var retry = function(callback) {
    setTimeout(function() {
      retriesLeft = retriesLeft - 1;
      // Back off
      interval = interval + interval;
      
      // No more retries abort
      if(retriesLeft == 0) {
        return callback(new Error('found no message in queue'));
      }

      // Try again
      attemptToGrabJob(callback);
    }, interval);    
  }

  // Attempt to grab a job
  var attemptToGrabJob = function(callback) {
    self.queue.findOne({
      startTime: null
    }, {
      sort: { priority: -1, createdOn: 1 }
    }, function(err, doc) {
      if(err) return callback(err);
      if(doc == null) return retry(callback);
      // Create start time
      var startTime = new Date();
      // Attempt to grab the job
      self.queue.updateOne({_id: doc._id, startTime: null, jobId: null}, {
        $set: {
            jobId: jobId
          , startTime: startTime
        }
      }, function(err, r) {
        if(err) return callback(err);

        // No modification happened we will retry
        if(r.modifiedCount == 0) {
          return retry(callback);
        }
        
        // Set the job id
        doc.jobId = jobId;
        doc.startTime = startTime;
        // Return the document
        callback(null, new Work(self.queue, doc));
      });
    });
  }  

  // Attempt to grab a job
  attemptToGrabJob(function(err, r) {
    if(err) return _callback(err);
    _callback(err, r);
  });
}

/*
 * Fetch the next item in FIFO fashion (by createdOn timestamp)
 */
Queue.prototype.fetchFIFO = function(callback) {  
  var self = this;
  
  // Find one and update, returning a work item
  this.queue.findOneAndUpdate({
    startTime: null
  }, {
    $set: { startTime: new Date() }
  }, {
    sort: { createdOn: 1 }
  }, function(err, r) {
    if(err) return callback(err);
    if(r.value == null) return callback(new Error('found no message in queue'));
    callback(null, new Work(self.queue, r.value));
  });
}

/*
 * Fetch the next item in FIFO fashion (by createdOn timestamp) but avoiding findAndModify
 */
Queue.prototype.fetchFIFONoFindAndModify = function(options, _callback) {
  if(typeof options == 'function') _callback = options, options = {};
  // Number of retries
  var retries = typeof options.retries == 'number' ? options.retries : 10;
  var interval = typeof options.interval == 'number' ? options.interval : 100;
  var retriesLeft = retries;
  var self = this;
  var jobId = new ObjectId();

  // Retry the operation
  var retry = function(callback) {
    setTimeout(function() {
      retriesLeft = retriesLeft - 1;
      // Back off
      interval = interval + interval;
      
      // No more retries abort
      if(retriesLeft == 0) {
        return callback(new Error('found no message in queue'));
      }

      // Try again
      attemptToGrabJob(callback);
    }, interval);    
  }

  // Attempt to grab a job
  var attemptToGrabJob = function(callback) {
    self.queue.findOne({
      startTime: null
    }, {
      sort: { createdOn: 1 }
    }, function(err, doc) {
      if(err) return callback(err);
      if(doc == null) return retry(callback);
      // Create start time
      var startTime = new Date();
      // Attempt to grab the job
      self.queue.updateOne({_id: doc._id, startTime: null, jobId: null}, {
        $set: {
            jobId: jobId
          , startTime: startTime
        }
      }, function(err, r) {
        if(err) return callback(err);

        // No modification happened we will retry
        if(r.modifiedCount == 0) {
          return retry(callback);
        }
        
        // Set the job id
        doc.jobId = jobId;
        doc.startTime = startTime;
        // Return the document
        callback(null, new Work(self.queue, doc));
      });
    });
  }  

  // Attempt to grab a job
  attemptToGrabJob(function(err, r) {
    if(err) return _callback(err);
    _callback(err, r);
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