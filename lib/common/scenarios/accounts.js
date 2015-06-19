"use strict"

var microtime = require('microtime')
  , co = require('co')
  , f = require('util').format;
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
    var Account = require('../schemas/account/account')
      , Transaction = require('../schemas/account/transaction')
      , ObjectId = require('mongodb').ObjectId;

    // Db instance
    var db = null;

    // Set up all indexes
    var createIndexes = function(db, collectionNames) {
      return new Promise(function(resolve, reject) {
        // Get collections
        var collections = {
            accounts: db.collection(collectionNames.accounts || 'accounts')
          , transactions: db.collection(collectionNames.transactions || 'transactions')
        }

        // Create account indexes
        yield Account.createOptimalIndexes(collections);
        // Create transaction indexes
        yield Transaction.createOptimalIndexes(collections);
        // Resolve
        resolve();
      }).catch(function(err) {
        reject(err);
      });
    }

    class AccountScenario {
      constructor() {}

      /*
       * Runs only once when starting up on the monitor
       */
      globalSetup(options) {
        options = options || {};
        // Self reference
        var self = this;

        // Unpack the parameters
        var initialAccountSum = schema.params.initialAccountSum;
        var transactionSize = schema.params.transactionSize;
        var numberOfAccounts = schema.params.numberOfAccounts;
        var collections = schema.collections ? schema.collections : collections;
        var errors = [];

        // Return a resolvable promise
        return new Promise(function(resolve, reject) {
          co(function*() {
            // Connect to MongoDB
            var db = yield MongoClient.connect(schema.url);

            // Get the specific schema db if specified
            if(schema.db) db = db.db(schema.db);

            // Get collections
            var cols = {
                accounts: db.collection(collections.accounts || 'accounts')
              , transactions: db.collection(collections.transactions || 'transactions')
            }

            // Create the indexes for the model
            yield createIndexes(db, collection);

            // Create all the accounts
            var left = numberOfAccounts;

            // Create accounts
            for(var i = 0; i < numberOfAccounts; i++) {
              // Create a new account
              var account = new Account(cols, i, initialAccountSum);
              // Create the mongodb documents for the model
              yield account.create()
            }

            // Finished
            resolve();
          }).catch(function(err) {
            reject(err);
          });
        });
      }

      /*
       * Runs only once when starting up on the monitor
       */
      globalTeardown(options) {
        return new Promise(function(resolve, reject) { resolve(); });
      }

      /*
       * Runs for each executing process
       */
      setup(options) {
        return new Promise(function(resolve, reject) {
          co(function*() {
            var instance = yield MongoClient.connect(schema.url);
            db = schema.db ? instance.db(schema.db) : instance;
            resolve();
          }).catch(function(err) {
            reject(err);
          });
        });
      }

      /*
       * Runs for each executing process
       */
      teardown(options) {
        return new Promise(function(resolve, reject) {
          if(db) db.close();
          resolve();
        });
      }

      /*
       * The actual scenario running
       */
      execute(options) {
        options = options || {};

        // Get the collection names
        var collectionNames = schema.collections;
        var initialAccountSum = schema.params.initialAccountSum;
        var transactionSize = schema.params.transactionSize;
        var numberOfAccounts = schema.params.numberOfAccounts;

        // Get collections
        var cols = {
            accounts: db.collection(collectionNames.accounts || 'accounts')
          , transactions: db.collection(collectionNames.transactions || 'transactions')
        }

        var writeConcern = schema.writeConcern || {};

        // Metadata read preference
        var options = writeConcern.transactions || {w:1, wtimeout: 10000}

        // Pick two random accounts
        var accountId1 = Math.round(numberOfAccounts * Math.random()) % numberOfAccounts;
        var accountId2 = Math.round(numberOfAccounts * Math.random()) % numberOfAccounts;
        if(accountId2 == accountId1) accountId2 = (accountId2 + 1) % numberOfAccounts;

        // Cart start time
        var startTime = microtime.now();

        // Create the two accounts used for a transfer
        var accountA = new Account(cols, accountId1, 1000);
        var accountB = new Account(cols, accountId2, 1000);

        // Return the promise
        return new Promise(function(resolve, reject) {
          co(function*() {
            // Reload the values of the accounts
            yield accountA.reload();
            yield accountB.reload();

            // Transfer 100 from A to B successfully
            var transaction = yield accountA.transfer(accountB, 100, options);

            // Get end time of the cart
            var endTime = microtime.now();
            services.log('second', 'account_transaction_successful', {
                start: startTime
              , end: endTime
              , time: endTime - startTime
            });
            resolve();
          }).catch(function(err) {
            reject(err);
          });
        });
      }
    }

    return new AccountScenario(services, scenario, schema);
  }
})
