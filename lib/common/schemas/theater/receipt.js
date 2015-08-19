"use strict";

var co = require('co');

/*
 * Create a new receipt instance
 */
class Receipt {
  constructor(collections, reservations, total) {
    this.reservations = reservations;
    this.total = total
    this.receipts = collections['receipts'];
  }

  /*
   * Create a new receipt mongod document
   */
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var r = yield self.receipts.insertOne({
            createdOn: new Date()
          , reservations: self.reservations
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

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

module.exports = Receipt;
