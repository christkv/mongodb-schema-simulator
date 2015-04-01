"use strict";

var Transaction = require('./transaction')
  , ObjectID = require('mongodb').ObjectID;

var clone = function(obj) {
  var o = {};
  for(var name in obj) o[name] = obj[name];
  return o;
}

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
Account.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  options = clone(options);
  options.upsert = true

  self.accounts.updateOne({name: self.name}
    , {name: self.name, balance:self.balance, pendingTransactions:[]}
    , options, function(err, r) {
      if(err) return callback(err);
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);
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
  transaction.create(options, function(err) {
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
Account.prototype.debit = function(transactionId, amount, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  this.accounts.updateOne({
    name: this.name, pendingTransactions: {$ne: transactionId}, balance: { $gte: amount}
  }, {
    $inc: {balance: -amount}, $push: {pendingTransactions: transactionId}
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    if(r.result.nUpdated == 0) return callback(new Error(f('failed to debit account %s the amount %s', self.name, amount)));
    callback();
  });
}

/*
 * Credit the account with the specified amount
 */
Account.prototype.credit = function(transactionId, amount, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  this.accounts.updateOne({
    name: this.name, pendingTransactions: {$ne: transactionId}
  }, {
    $inc: {balance: amount}, $push: {pendingTransactions: transactionId}
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    if(r.result.nUpdated == 0) return callback(new Error(f('failed to credit account %s the amount', self.name, amount)));
    callback();
  });
}

/*
 * Clear transaction
 */
Account.prototype.clear = function(transactionId, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  // Remove the pending transactions
  this.accounts.update({name: this.name}, {$pull: {pendingTransactions: transactionId}}, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    if(r.result.nUpdated == 0) return callback(new Error('failed to clear pending account1 transaction'));
    callback();
  }); 
}

/*
 * Reload the account information
 */
Account.prototype.reload = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  this.accounts.findOne({name: this.name}, options, function(err, result) {
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