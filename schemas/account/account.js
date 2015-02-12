"use strict";

var Transaction = require('./transaction')
  , ObjectID = require('mongodb').ObjectID;

var Account = function(collections, name, balance) {  
  this.collections = collections;
  this.accounts = collections['accounts'];
  this.transactions = collections['transactions'];
  this.name = name;
  this.balance = balance;
}

/*
 * Create a new account document
 */
Account.prototype.create = function(callback) {
  var self = this;
  self.accounts.updateOne({name: self.name}
    , {name: self.name, balance:self.balance, pendingTransactions:[]}
    , {upsert:true}, function(err, r) {
      if(err) return callback(err);
      callback(null, self);
    });
}

/*
 * Transfer an amount to this account from the provided account
 */
Account.prototype.transfer = function(toAccount, amount, options, callback) {
  if(typeof options == 'function') callback = options, options = {};

  // Create a new transaction
  var transaction = new Transaction(this.collections, new ObjectID(), this, toAccount, amount);
  transaction.create(function(err) {
    if(err) return callback(err);

    // Update the accounts with the transaction
    transaction.apply(options, function(err, result) {
      if(err) return callback(err, transaction);
      callback(null, transaction);
    });
  });
}

/*
 * Debit the account with the specified amount
 */
Account.prototype.debit = function(transactionId, amount, callback) {
  var self = this;

  this.accounts.updateOne({
    name: this.name, pendingTransactions: {$ne: transactionId}, balance: { $gte: amount}
  }, {
    $inc: {balance: -amount}, $push: {pendingTransactions: transactionId}
  }, function(err, r) {
    if(err) return callback(err);
    if(r.result.nUpdated == 0) return callback(new Error(f('failed to debit account %s the amount %s', self.name, amount)));
    callback();
  });
}

/*
 * Credit the account with the specified amount
 */
Account.prototype.credit = function(transactionId, amount, callback) {
  var self = this;

  this.accounts.updateOne({
    name: this.name, pendingTransactions: {$ne: transactionId}
  }, {
    $inc: {balance: amount}, $push: {pendingTransactions: transactionId}
  }, function(err, r) {
    if(err) return callback(err);
    if(r.result.nUpdated == 0) return callback(new Error(f('failed to credit account %s the amount', self.name, amount)));
    callback();
  });
}

/*
 * Clear transaction
 */
Account.prototype.clear = function(transactionId, callback) {
  // Remove the pending transactions
  this.accounts.update({name: this.name}, {$pull: {pendingTransactions: transactionId}}, function(err, r) {
    if(err) return callback(err);
    if(r.result.nUpdated == 0) return callback(new Error('failed to clear pending account1 transaction'));
    callback();
  }); 
}

/*
 * Reload the account information
 */
Account.prototype.reload = function(callback) {
  var self = this;
  this.accounts.findOne({name: this.name}, function(err, result) {
    if(err) return callback(err);
    self.balance = result.balance;
    callback(null, self);
  });
}

/*
 * Create the optimal indexes for the queries
 */
Account.createOptimalIndexes = function(collections, callback) {
  // Ensure we do not have duplicate accounts
  collections['accounts'].ensureIndex({name:1}, {unique: true}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Account;