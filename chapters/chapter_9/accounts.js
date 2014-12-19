var Case = require('../../lib/child/case')
  , f = require('util').format
  , ObjectId = require('mongodb').ObjectID
  , Transaction = require('./model')
  , crypto = require('crypto')
  , inherits = require('util').inherits;

var Accounts = function(module, args) {
  if(!(this instanceof Accounts)) return new Accounts();
  Case.call(this, Array.prototype.slice.call(arguments, 0));
  this.args = args;
  this.module = module;
  this.collection = null;
  // Used to fill in documents in time series fashion
  this.counter = 0;
  // Accounts
  this.accounts = [];
  // Number of accounts to create
  this.accountsToCreate = 1000;
  // Current index in accounts
  this.index = 0;
}

// Inherit from Case
inherits(Accounts, Case);

/*
 * Setup and tear down methods for the Accounts class
 */
Accounts.prototype.setup = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Connect to the server
  this.connect(function(err, db) {
    if(err) return callback(err);
    
    // Set our collection
    var accounts = db.collection('accounts');
    var transactions = db.collection('transactions');

    // Drop the accounts
    accounts.drop(function() {
      
      // Drop the transactions
      transactions.drop(function() {
      
        // Setup indexes
        if(self.args.m == 'transfer') {
          accounts.ensureIndex({name:1}, function() {});
        }

        // The number of accounts left to create
        var left = self.accountsToCreate;

        // Create them
        for(var i = 0; i < self.accountsToCreate; i++) {
          var transaction = new Transaction(db);
          // Push to available accounts for the process
          self.accounts.push(transaction);

          // Create an account
          transaction.create(function() {
            left = left - 1;
            if(left == 0) callback();
          });
        }
      });
    });
  });
}

Accounts.prototype.teardown = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Perform transfer of money from one account to the other
 */
Accounts.prototype.performTransfer = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  // Get an index
  this.index = (this.index + 1) % this.accounts.length;
  // Get an account
  this.accounts[this.index].transfer(callback);
}

/*
 * Perform transfer of money from one account to the other no indexes
 */
Accounts.prototype.performTransferNoIndexes = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  // Get an index
  this.index = (this.index + 1) % this.accounts.length;
  // Get an account
  this.accounts[this.index].transfer(callback);
}

/*
 * Perform transfer of money that causes rollback of transaction
 */
Accounts.prototype.performRollbacks = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  // Get an index
  this.index = (this.index + 1) % this.accounts.length;
  // Get an account
  this.accounts[this.index].rollback(callback);
}

/*
 * Mix of successful and rollback transfers
 */
Accounts.prototype.performMixed = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

// Export schema
module.exports = {
    abr: 'accounts'
  , description: 'Show Accounting/Transaction pattern'
  , chapter: 9
  , module: f('%s', __filename)
  , entry: 'start'
  , class: Accounts
  , methods: [{
      name: 'transfer'
    , method: 'performTransfer'
    , description: 'Perform transfer of money from one account to the other'    
  }, {
      name: 'transfer_no_indexes'
    , method: 'performTransferNoIndexes'
    , description: 'Perform transfer of money from one account to the other no indexes'
  }, {
      name: 'rollback'
    , method: 'performRollbacks'
    , description: 'Perform transfer of money that causes rollback of transaction'
  }, {
      name: 'mixed'
    , method: 'performMixed'
    , description: 'Mix of successful and rollback transfers'
  }]  
}