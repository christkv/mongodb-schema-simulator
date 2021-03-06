"use strict";

var ObjectID = require('mongodb').ObjectID
  , f = require('util').format;

var Transaction = function(collections, id, fromAccount, toAccount, amount) {  
  this.id = id == null ? new ObjectID() : id;
  this.collections = collections;
  this.transactions = collections['transactions'];
  this.accounts = collections['accounts'];
  this.fromAccount = fromAccount;
  this.toAccount = toAccount;
  this.amount = amount;
}

Transaction.INITIAL = 'initial';
Transaction.PENDING = 'pending';
Transaction.COMMITTED = 'committed';
Transaction.DONE = 'done';
Transaction.CANCELED = 'canceled';

/*
 * Create a new transaction mongodb document
 */
Transaction.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Insert the initial transaction
  this.transactions.insertOne({
      _id : self.id
    , source: self.fromAccount.name
    , destination: self.toAccount.name
    , amount: self.amount
    , state: Transaction.INITIAL
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    self.state = Transaction.INITIAL;
    callback();
  });
}

/*
 * Reverse the transactions on the current account if it exists
 */
var reverse = function(self, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  // Reverse the debit
  self.accounts.updateOne(
    {name: self.fromAccount.name, pendingTransactions: {$in: [self.id]}
  }, {$inc: {balance: self.amount}, $pull: {pendingTransactions: self.id}}, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);

    // Reverse the credit (if any)
    self.accounts.updateOne(
      {name: self.toAccount.name, pendingTransactions: {$in: [self.id]}
    }, {$inc: {balance: -self.amount}, $pull: {pendingTransactions: self.id}}, options, function(err, r) {
      if(err) return callback(err);
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);

      // Finally cancel the transaction
      self.cancel(options, function() {
        callback(new Error('transfer failed, transaction reversed'));        
      });
    });
  });
}

/*
 * Apply transaction to the accounts
 */
Transaction.prototype.apply = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Advance the state of the transaction to pending
  self.advance(options, function(err) {
    // Fail before application of transaction to accounts
    if(options.fail == 'failBeforeApply') err = new Error('failed to apply transaction');
    if(err) return self.cancel(callback);    

    // Attempt to debit amount from the first account
    self.fromAccount.debit(self.id, self.amount, options, function(err) {
      // Fail after first application of transaction to accounts
      if(options.fail == 'failAfterFirstApply') err = new Error('failed to apply transaction to both accounts');

      // An error occurred, cancel the transaction
      if(err) return reverse(self, callback);

      // Attempt to credit the second account
      self.toAccount.credit(self.id, self.amount, options, function(err) {
        if(options.fail == 'failAfterApply') err = new Error('failed after applying transaction to both accounts');
        // We have an error, reverse the transaction
        if(err) return reverse(self, callback);

        // Correctly set transaction to committed
        self.advance(options, function(err) {
          if(err) return reverse(self, callback);

          // Clear out the applied transaction on the first account
          self.fromAccount.clear(self.id, options, function(err) {
            if(options.fail == 'failAfterCommit') err = new Error('failed after when attempting to set transaction to committed');
            if(err) return callback(new Error(f('failed to clear transaction with %s from account %s', self.id, self.fromAccount.name)));

            // Clear out the applied transaction on the second account
            self.toAccount.clear(self.id, options, function(err) {
              if(err) return callback(new Error(f('failed to clear transaction with %s from account %s', self.id, self.toAccount.name)));

              // Advance the transaction to done
              self.advance(options, function(err, r) {
                if(err) return callback(new Error(f('failed to set transaction with %s to done state', self.id)));
                callback();
              });
            })
          })
        })
      });
    })
  });
}

/*
 * Advance the transaction to the next step
 */
Transaction.prototype.advance = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  if(this.state == Transaction.INITIAL) {
    this.transactions.updateOne({_id: this.id, state: Transaction.INITIAL}, {$set : {state: Transaction.PENDING}}, options, function(err, r) {
      if(err) return callback(err);
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);
      if(r.result.nUpdated == 0) return callback(new Error(f('no initial state transaction found for %s', self.id)));
      self.state = Transaction.PENDING;
      callback();
    });  
  } else if(this.state == Transaction.PENDING) {
    this.transactions.updateOne({_id: this.id, state: Transaction.PENDING}, {$set : {state: Transaction.COMMITTED}}, options, function(err, r) {
      if(err) return callback(err);
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);
      if(r.result.nUpdated == 0) return callback(new Error(f('no pending state transaction found for %s', self.id)));
      self.state = Transaction.COMMITTED;
      callback();
    });  
  } else if(this.state == Transaction.COMMITTED) {
    this.transactions.updateOne({_id: this.id, state: Transaction.COMMITTED}, {$set : {state: Transaction.DONE}}, options, function(err, r) {
      if(err) return callback(err);
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);
      if(r.result.nUpdated == 0) return callback(new Error(f('no pending state transaction found for %s', self.id)));
      self.state = Transaction.DONE;
      callback();
    });  
  }
}

/*
 * Cancel the transaction
 */
Transaction.prototype.cancel = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  this.transactions.updateOne({_id: this.id}, {$set : {state: 'canceled'}}, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    if(r.result.nUpdated == 0) return callback(new Error(f('no transaction found for %s', self.id)));
    callback(new Error(f('transaction %d was canceled', self.id)));
  });      
}

/*
 * Create the optimal indexes for the queries
 */
Transaction.createOptimalIndexes = function(transactionCollection, callback) {
  callback();
}

module.exports = Transaction;