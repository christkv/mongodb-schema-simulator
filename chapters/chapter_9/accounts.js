var Case = require('../../lib/child/case')
  , f = require('util').format
  , ObjectId = require('mongodb').ObjectID
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
    self.collection = db.collection('nested_categories');

    // Drop the collection
    self.collection.drop(function() {
      callback();
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
  callback();
}

/*
 * Perform transfer of money that causes rollback of transaction
 */
Accounts.prototype.performRollbacks = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
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
  , chapter: 2
  , module: f('%s', __filename)
  , entry: 'start'
  , class: Accounts
  , methods: [{
      name: 'transfer'
    , method: 'performTransfer'
    , description: 'Perform transfer of money from one account to the other'
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