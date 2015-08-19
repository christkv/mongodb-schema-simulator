"use strict";

var Transaction = require('./transaction')
  , co = require('co')
  , ObjectID = require('mongodb').ObjectID;

var clone = function(obj) {
  var o = {};
  for(var name in obj) o[name] = obj[name];
  return o;
}

class Account {
  constructor(collections, name, balance) {
    this.collections = collections;
    this.accounts = collections['accounts'];
    this.transactions = collections['transactions'];
    this.name = name;
    this.balance = balance;
  }

  /*
   * Create a new account document
   */
  create(options) {
    options = options || {};
    var self = this;
    options = clone(options);
    options.upsert = true

    return new Promise(function(resolve, reject) {
      co(function*() {
        var r = yield self.accounts.updateOne({name: self.name}
          , {name: self.name, balance:self.balance, pendingTransactions:[]}, options);
        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Transfer an amount to this account from the provided account
   */
  transfer(toAccount, amount, options) {
    options = options || {};

    // Create a new transaction
    var transaction = new Transaction(this.collections, new ObjectID(), this, toAccount, amount);
    return new Promise(function(resolve, reject) {
      co(function*() {
        // Create transaction object
        yield transaction.create(options);
        // Update the accounts with the transaction
        var result = yield transaction.apply(options);
        // Return the transaction
        resolve(transaction);
      }).catch(function(err) {
        err.transaction = transaction;
        reject(err);
      });
    });
  }

  /*
   * Debit the account with the specified amount
   */
  debit(transactionId, amount, options) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var r = yield self.accounts.updateOne({
          name: self.name, pendingTransactions: {$ne: transactionId}, balance: { $gte: amount}
        }, {
          $inc: {balance: -amount}, $push: {pendingTransactions: transactionId}
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        if(r.result.nUpdated == 0)
          return reject(new Error(f('failed to debit account %s the amount %s', self.name, amount)));

        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Credit the account with the specified amount
   */
  credit(transactionId, amount, options, callback) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var r = yield self.accounts.updateOne({
          name: self.name, pendingTransactions: {$ne: transactionId}
        }, {
          $inc: {balance: amount}, $push: {pendingTransactions: transactionId}
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        if(r.result.nUpdated == 0)
          return reject(new Error(f('failed to credit account %s the amount', self.name, amount)));

        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Clear transaction
   */
  clear(transactionId, options) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Remove the pending transactions
        var r = yield self.accounts.update({name: self.name}, {$pull: {pendingTransactions: transactionId}}, options);
        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        if(r.result.nUpdated == 0)
          return reject(new Error('failed to clear pending account1 transaction'));

        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Reload the account information
   */
  reload(options, callback) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var result = yield self.accounts.findOne({name: self.name}, options);
        self.balance = result.balance;
        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections, options) {
    options = options || {};
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Ensure we do not have duplicate accounts
        yield collections['accounts'].ensureIndex({name:1}, {unique: true});
        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }
}

module.exports = Account;
