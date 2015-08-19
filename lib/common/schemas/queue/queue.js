"use strict";

var f = require('util').format,
  co = require('co'),
  ObjectId = require('mongodb').ObjectId;

var clone = function(obj) {
  var o = {};
  for(var name in obj) o[name] = obj[name];
  return o;
}

/*
 * Represents a work item from the queue
 */
class Work {
  constructor(collection, jobId, doc) {
    this.queue = collection;
    // this.doc = doc;
    this.jobId = jobId;
    this.doc = doc;
  }

  /*
   * Sets an end time on the work item signaling it's done
   */
  done(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Set end time for the work item
        var r = yield self.queue.updateOne({
          jobId: self.jobId
        }, {
          $set: { endTime: new Date() }
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('failed to set work item with jobId %s to done', self.jobId)));

        resolve(self);
      }).catch(reject);
    });
  }
}

/*
 * Represents a Queue
 */
class Queue {
  constructor(collections) {
    this.queue = collections['queues'];
    // Used for non findAndModifyQueueLookup
    this.reserved = {};
  }

  /*
   * Publish a new item on the queue with a specific priority
   */
  publish(priority, object, options) {
    var self = this;
    options = options || {};

    // Create 0 date
    var zeroDate = new Date();
    zeroDate.setTime(0);

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Insert the new item into the queue
        yield self.queue.insertOne({
            startTime: zeroDate
          , endTime: zeroDate
          , jobId: new ObjectId()
          , createdOn: new Date()
          , priority: priority
          , payload: object
        }, options);

        resolve();
      }).catch(reject);
    });
  }

  /*
   * Fetch the next highest available priority item
   */
  fetchByPriority(options) {
    var self = this;
    options = options || {};

    // Set the options
    options = clone(options);
    options['sort'] = {priority: -1, createdOn: 1};

    // Zero date (done so we can test capped collections where documents cannot grow)
    var zeroDate = new Date();
    zeroDate.setTime(0);

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Find one and update, returning a work item
        var r = yield self.queue.findOneAndUpdate({
          startTime: zeroDate
        }, {
          $set: { startTime: new Date() }
        }, options);

        if(r.value == null)
          return reject(new Error('found no message in queue'));

        resolve(new Work(self.queue, r.value.jobId, r.value));
      }).catch(reject);
    });
  }

  /*
   * Fetch the next item in FIFO fashion (by createdOn timestamp)
   */
  fetchFIFO(options) {
    var self = this;
    options = options || {};

    // Zero date (done so we can test capped collections where documents cannot grow)
    var zeroDate = new Date();
    zeroDate.setTime(0);

    // Set the options
    options = clone(options);
    options.sort = { createdOn: 1 };

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Find one and update, returning a work item
        var r = yield self.queue.findOneAndUpdate({
          startTime: zeroDate
        }, {
          $set: { startTime: new Date() }
        }, options);

        if(r.value == null)
          return reject(new Error('found no message in queue'));

        resolve(new Work(self.queue, r.value.jobId, r.value));
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['queues'].ensureIndex({startTime:1});
        yield collections['queues'].ensureIndex({createdOn: 1});
        yield collections['queues'].ensureIndex({priority:-1, createdOn: 1});
        yield collections['queues'].ensureIndex({jobId: 1});
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Queue;
