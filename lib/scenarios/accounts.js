var microtime = require('microtime');
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

/*
 * Simple fixed items in cart simulation
 */
scenarios.push({
    name: 'account_transaction_successful'
  , title: 'successful transaction of money from one account to another'
  , description: 'simulates a successful transaction of money from one account to the other'
  , params: {
    // Number of items in the cart
    initialAccountSum: {
        name: 'the initial account sum'
      , type: 'number'
      , default: 1000000
    }
    // Transaction size
    , transactionSize: {
        name: 'the size of the transaction'
      , type: 'number'
      , default: 100
    }
    // Number of accounts to pre-create
    , numberOfAccounts: {
        name: 'number of accounts to pre-create'
      , type: 'number'
      , default: 1000
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient;

    // Default collection names
    var collections = {
        carts: 'carts'
      , products: 'products'
      , inventories: 'inventories'
      , order: 'orders'
    }    

    // Get all the schemas
    var Account = require('../../schemas/account/account')
      , Transaction = require('../../schemas/account/transaction')
      , ObjectId = require('mongodb').ObjectId;

    // Db instance
    var db = null;

    // Contains the cart scenario
    var AccountScenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Get collections
      var accounts = db.collection(collectionNames.accounts || 'accounts');
      var transactions = db.collection(collectionNames.transactions || 'transactions');

      Account.createOptimalIndexes(accounts, function(err) {
        if(err) return callback(err);

        Transaction.createOptimalIndexes(transactions, function(err) {
          if(err) return callback(err);  
          callback();
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    AccountScenario.prototype.globalSetup = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      // Self reference
      var self = this;

      // Unpack the parameters
      var initialAccountSum = schema.schema.params.initialAccountSum;
      var transactionSize = schema.schema.params.transactionSize;
      var numberOfAccounts = schema.schema.params.numberOfAccounts;
      var collections = schema.schema.collections ? schema.schema.collections : collections;
      var errors = [];

      // console.log('[SCENARIO-AccountScenario] globalSetup');
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, db) {
        if(err) return callback(err);

        // Get the collections
        var accounts = db.collection(collections.accounts || 'accounts');
        var transactions = db.collection(collections.transactions || 'transactions');

        // Get the specific schema db if specified
        if(schema.db) db = db.db(schema.db);

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          // Create all the accounts
          var left = numberOfAccounts;

          // Create accounts
          for(var i = 0; i < numberOfAccounts; i++) {
            var account = new Account(accounts, transactions, i, initialAccountSum);
            account.create(function(err) {
              left = left - 1;
              if(err) errors.push(err);

              if(left == 0) {
                // Close the db
                db.close();
                // Callback
                callback(errors.length > 0 ? errors : null);
              }
            })
          }
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    AccountScenario.prototype.globalTeardown = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    AccountScenario.prototype.setup = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      // Connect to the database
      MongoClient.connect(scenario.url, function(err, instance) {
        db = schema.db ? instance.db(schema.db) : instance;
        callback(err);
      });
    }

    /*
     * Runs for each executing process
     */
    AccountScenario.prototype.teardown = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    AccountScenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      // Get the collection names
      var collectionNames = schema.schema.collections;
      var initialAccountSum = schema.schema.params.initialAccountSum;
      var transactionSize = schema.schema.params.transactionSize;
      var numberOfAccounts = schema.schema.params.numberOfAccounts;

      // Get collections
      var accounts = db.collection(collectionNames.accounts || 'accounts');
      var transactions = db.collection(collectionNames.transactions || 'transactions');

      // Pick two random accounts
      var accountId1 = Math.round(numberOfAccounts * Math.random()) % numberOfAccounts;
      var accountId2 = Math.round(numberOfAccounts * Math.random()) % numberOfAccounts;
      if(accountId2 == accountId1) accountId2 = (accountId2 + 1) % numberOfAccounts;

      // Cart start time
      var startTime = microtime.now();

      // Create the two accounts used for a transfer
      var accountA = new Account(accounts, transactions, accountId1, 1000);
      var accountB = new Account(accounts, transactions, accountId2, 1000);

      // Reload the values of the accounts
      accountA.reload(function(err) {
        if(err) return callback(err);

        accountB.reload(function(err) {
          if(err) return callback(err);

          // Transfer 100 from A to B successfully
          accountA.transfer(accountB, 100, function(err, transaction) {
            if(err) return callback(err);

            // Get end time of the cart
            var endTime = microtime.now();
            services.log('second', 'account_transaction_successful', {
                start: startTime
              , end: endTime
              , time: endTime - startTime
            });
        
            // Finish the execution
            callback();
          });

        });
      });
    }

    return new AccountScenario(services, scenario, schema);
  }
})