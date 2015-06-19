"use strict";

var co = require('co');

var setup = function(db) {
  var Account = require('../../lib/common/schemas/account/account');
  console.dir(Account.createOptimalIndexes)
  return new Promise(function(resolve, reject) {
    co(function*() {
      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      try { yield collections['accounts'].drop(); } catch(err) {}
      try { yield collections['transactions'].drop(); } catch(err) {}
      yield Account.createOptimalIndexes(collections);
      resolve();
    }).catch(function(err) {
      reject(err);
    });
  });
}

exports['Should correctly perform transfer between account A and account B of 100'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../lib/common/schemas/account/account');

    co(function*() {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      yield setup(db);

      // Create the two accounts used for a transfer
      var accountA = new Account(collections, "Joe", 1000);
      var accountB = new Account(collections, "Paul", 1000);

      // Instantiate First account
      yield accountA.create();
      // Instantiate Second account
      yield accountB.create();

      // Transfer 100 from A to B successfully
      var transaction = yield accountA.transfer(accountB, 100);

      // Reload both account documents and verify
      // balance
      var accountA = yield accountA.reload();
      test.equal(900, accountA.balance);

      var accountB = yield accountB.reload();
      test.equal(1100, accountB.balance);

      // Get the transaction
      var doc = yield collections['transactions'].findOne({_id: transaction.id});
      test.equal('done', doc.state);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err})
    });
  }
}

exports['Should correctly roll back transfer that fails before any application of amounts to accounts'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../lib/common/schemas/account/account');

    co(function*() {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());
      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      yield setup(db);
      // Create the two accounts used for a transfer
      var accountA = new Account(collections, "Joe2", 1000);
      var accountB = new Account(collections, "Paul2", 1000);

      // Instantiate First account
      yield accountA.create();
      // Instantiate Second account
      yield accountB.create();

      // Contains the transaction
      var transaction = null;

      try {
        // Transfer 100 from A to B successfully
        transaction = yield accountA.transfer(accountB, 100, {fail: 'failBeforeApply'});
      } catch(err) {
        transaction = err.transaction;
      }

      // Reload both account documents and verify
      // balance
      var accountA = yield accountA.reload();
      test.equal(1000, accountA.balance);

      var accountB = yield accountB.reload();
      test.equal(1000, accountA.balance);

      // Get the transaction
      var doc = yield collections['transactions'].findOne({_id: transaction.id});
      test.equal('canceled', doc.state);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err})
    });
  }
}

exports['Should correctly roll back transfer that fails with only a single account being applied'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../lib/common/schemas/account/account');

    co(function*() {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());
      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      yield setup(db);
      // Create the two accounts used for a transfer
      var accountA = new Account(collections, "Joe3", 1000);
      var accountB = new Account(collections, "Paul3", 1000);

      // Instantiate First account
      yield accountA.create();
      // Instantiate Second account
      yield accountB.create();

      // Contains the transaction
      var transaction = null;

      try {
        // Transfer 100 from A to B successfully
        transaction = yield accountA.transfer(accountB, 100, {fail: 'failAfterFirstApply'});
      } catch(err) {
        transaction = err.transaction;
      }

      // Reload both account documents and verify
      // balance
      yield accountA.reload();
      test.equal(1000, accountA.balance);

      yield accountB.reload();
      test.equal(1000, accountB.balance);

      // Get the transaction
      var doc = yield collections['transactions'].findOne({_id: transaction.id});
      test.equal('canceled', doc.state);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err})
    });
  }
}

exports['Should correctly roll back transfer that fails after application to accounts'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../lib/common/schemas/account/account');

    co(function*() {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());
      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      yield setup(db);

      // Create the two accounts used for a transfer
      var accountA = new Account(collections, "Joe4", 1000);
      var accountB = new Account(collections, "Paul4", 1000);

      // Instantiate First account
      yield accountA.create();
      // Instantiate Second account
      yield accountB.create();

      // Contains the transaction
      var transaction = null;

      try {
        // Transfer 100 from A to B successfully
        transaction = yield accountA.transfer(accountB, 100, {fail: 'failAfterApply'});
      } catch(err) {
        transaction = err.transaction;
      }

      // Reload both account documents and verify
      // balance
      yield accountA.reload();
      test.equal(1000, accountA.balance);

      yield accountB.reload();
      test.equal(1000, accountB.balance);

      // Get the transaction
      var doc = yield collections['transactions'].findOne({_id: transaction.id});
      test.equal('canceled', doc.state);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err})
    });
  }
}

exports['Should correctly roll back transfer that fails after transaction set to commit but before clearing'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../lib/common/schemas/account/account');

    co(function*() {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());
      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      yield setup(db);

      // Create the two accounts used for a transfer
      var accountA = new Account(collections, "Joe5", 1000);
      var accountB = new Account(collections, "Paul5", 1000);

      // Instantiate First account
      yield accountA.create();
      // Instantiate Second account
      yield accountB.create();

      // Contains the transaction
      var transaction = null;

      try {
        // Transfer 100 from A to B successfully
        transaction = yield accountA.transfer(accountB, 100, {fail: 'failAfterCommit'});
      } catch(err) {
        transaction = err.transaction;
      }

      // Reload both account documents and verify
      // balance
      yield accountA.reload();
      test.equal(900, accountA.balance);

      yield accountB.reload();
      test.equal(1100, accountB.balance);

      // Get the transaction
      var doc = yield collections['transactions'].findOne({_id: transaction.id});
      test.equal('committed', doc.state);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err})
    });
  }
}
