"use strict";

var ObjectID = require('mongodb').ObjectID
  , co = require('co')
  , f = require('util').format;

class Transaction {
  constructor(collections, id, fromAccount, toAccount, amount) {
    this.id = id == null ? new ObjectID() : id;
    this.collections = collections;
    this.transactions = collections['transactions'];
    this.accounts = collections['accounts'];
    this.fromAccount = fromAccount;
    this.toAccount = toAccount;
    this.amount = amount;
  }

  /*
   * Create a new transaction mongodb document
   */
  create(options) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Insert the initial transaction
        var r = yield self.transactions.insertOne({
            _id : self.id
          , source: self.fromAccount.name
          , destination: self.toAccount.name
          , amount: self.amount
          , state: Transaction.INITIAL
        }, options);

        if(r.result.writeConcernError) return reject(r.result.writeConcernError);
        self.state = Transaction.INITIAL;
        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Apply transaction to the accounts
   */
  apply(options) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Advance the state of the transaction to pending
        yield self.advance(options)

        if(options.fail == 'failBeforeApply') {
          yield self.cancel();
          return reject(new Error('failed to apply transaction'));
        }

        try {
          // Attempt to debit amount from the first account
          yield self.fromAccount.debit(self.id, self.amount, options);

          if(options.fail == 'failAfterFirstApply') {
            yield reverse(self);
            return reject(new Error('failed to apply transaction to both accounts'));
          }

          // Attempt to credit the second account
          yield self.toAccount.credit(self.id, self.amount, options);

          if(options.fail == 'failAfterApply') {
            yield reverse(self);
            return reject(new Error('failed after applying transaction to both accounts'));
          }

          // Correctly set transaction to committed
          yield self.advance(options);
        } catch(err) {
          yield reverse(self);
          return reject(err);
        }

        // Clear out the applied transaction on the first account
        yield self.fromAccount.clear(self.id, options);

        // Fail after the transaction was commited
        if(options.fail == 'failAfterCommit') {
          return reject(new Error(f('failed to clear transaction with %s from account %s', self.id, self.fromAccount.name)));
        }

        // Clear out the applied transaction on the second account
        yield self.toAccount.clear(self.id, options);
        // Advance the transaction to done
        yield self.advance(options);
        // Finished
        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Advance the transaction to the next step
   */
  advance(options) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        if(self.state == Transaction.INITIAL) {
          var r = yield self.transactions.updateOne({_id: self.id, state: Transaction.INITIAL}, {$set : {state: Transaction.PENDING}}, options);
          if(r.result.writeConcernError)
            return reject(r.result.writeConcernError);

          if(r.result.nUpdated == 0)
            return reject(new Error(f('no initial state transaction found for %s', self.id)));

          self.state = Transaction.PENDING;
        } else if(self.state == Transaction.PENDING) {
          var r = yield self.transactions.updateOne({_id: self.id, state: Transaction.PENDING}, {$set : {state: Transaction.COMMITTED}}, options);
          if(r.result.writeConcernError)
            return reject(r.result.writeConcernError);

          if(r.result.nUpdated == 0)
            return reject(new Error(f('no pending state transaction found for %s', self.id)));

          self.state = Transaction.COMMITTED;
        } else if(self.state == Transaction.COMMITTED) {
          var r = yield self.transactions.updateOne({_id: self.id, state: Transaction.COMMITTED}, {$set : {state: Transaction.DONE}}, options);
          if(r.result.writeConcernError)
            return reject(r.result.writeConcernError);

          if(r.result.nUpdated == 0)
            return reject(new Error(f('no pending state transaction found for %s', self.id)));

          self.state = Transaction.DONE;
        }

        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Cancel the transaction
   */
  cancel(options) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var r = yield self.transactions.updateOne({_id: self.id}, {$set : {state: 'canceled'}}, options);
        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        if(r.result.nUpdated == 0)
          return reject(new Error(f('no transaction found for %s', self.id)));

        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(transactionCollection) {
    return new Promise(function(resolve, reject) {
      resolve();
    });
  }
}

Transaction.INITIAL = 'initial';
Transaction.PENDING = 'pending';
Transaction.COMMITTED = 'committed';
Transaction.DONE = 'done';
Transaction.CANCELED = 'canceled';

/*
 * Reverse the transactions on the current account if it exists
 */
var reverse = function(self, options) {
  options = options || {};

  return new Promise(function(resolve, reject) {
    co(function*() {
      // Reverse the debit
      var r = yield self.accounts.updateOne(
        {name: self.fromAccount.name, pendingTransactions: {$in: [self.id]}
      }, {$inc: {balance: self.amount}, $pull: {pendingTransactions: self.id}}, options);

      if(r.result.writeConcernError)
        return reject(r.result.writeConcernError);

      // Reverse the credit (if any)
      var r = yield self.accounts.updateOne(
        {name: self.toAccount.name, pendingTransactions: {$in: [self.id]}
      }, {$inc: {balance: -self.amount}, $pull: {pendingTransactions: self.id}}, options);
      if(r.result.writeConcernError)
        return reject(r.result.writeConcernError);

      // Finally cancel the transaction
      yield self.cancel(options);
      resolve();
    }).catch(function(err) {
      reject(err);
    });
  });
}

module.exports = Transaction;
