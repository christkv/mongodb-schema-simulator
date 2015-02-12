"use strict";

var setup = function(db, callback) {
  var Account = require('../../schemas/account/account');

  // All the collections used
  var collections = {
      accounts: db.collection('accounts')
    , transactions: db.collection('transactions')
  }

  collections['accounts'].drop(function() {
    collections['transactions'].drop(function() {
      Account.createOptimalIndexes(collections, function() {
        callback();
      });
    });
  });
}

exports['Should correctly perform transfer between account A and account B of 100'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../schemas/account/account');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      setup(db, function() {
        // Create the two accounts used for a transfer
        var accountA = new Account(collections, "Joe", 1000);
        var accountB = new Account(collections, "Paul", 1000);

        // Instantiate First account
        accountA.create(function(err) {
          test.equal(null, err);

          // Instantiate Second account
          accountB.create(function(err) {
            test.equal(null, err);

            // Transfer 100 from A to B successfully
            accountA.transfer(accountB, 100, function(err, transaction) {
              test.equal(null, err);

              // Reload both account documents and verify
              // balance
              accountA.reload(function(err, accountA) {
                test.equal(null, err);
                test.equal(900, accountA.balance);

                accountB.reload(function(err, accountB) {
                  test.equal(null, err);
                  test.equal(1100, accountB.balance);

                  // Get the transaction
                  collections['transactions'].findOne({_id: transaction.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal('done', doc.state);

                    db.close();
                    test.done();
                  });
                });
              });
            });
          });
        });
      });
    });
  }
}

exports['Should correctly roll back transfer that fails before any application of amounts to accounts'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../schemas/account/account');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);
  
        // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      setup(db, function() {
        // Create the two accounts used for a transfer
        var accountA = new Account(collections, "Joe1", 1000);
        var accountB = new Account(collections, "Paul1", 1000);

        // Instantiate First account
        accountA.create(function(err) {
          test.equal(null, err);

          // Instantiate Second account
          accountB.create(function(err) {
            test.equal(null, err);

            // Transfer 100 from A to B successfully
            accountA.transfer(accountB, 100, {fail: 'failBeforeApply'}, function(err, transaction) {
              test.ok(err != null);

              // Reload both account documents and verify
              // balance
              accountA.reload(function(err, accountA) {
                test.equal(null, err);
                test.equal(1000, accountA.balance);

                accountB.reload(function(err, accountB) {
                  test.equal(null, err);
                  test.equal(1000, accountA.balance);

                  // Get the transaction
                  collections['transactions'].findOne({_id: transaction.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal('canceled', doc.state);

                    db.close();
                    test.done();
                  });
                });
              });
            });
          });
        });
      });
    });
  }
}

exports['Should correctly roll back transfer that fails with only a single account being applied'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../schemas/account/account');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      setup(db, function() {
        // Create the two accounts used for a transfer
        var accountA = new Account(collections, "Joe2", 1000);
        var accountB = new Account(collections, "Paul2", 1000);

        // Instantiate First account
        accountA.create(function(err) {
          test.equal(null, err);

          // Instantiate Second account
          accountB.create(function(err) {
            test.equal(null, err);

            // Transfer 100 from A to B successfully
            accountA.transfer(accountB, 100, {fail: 'failAfterFirstApply'}, function(err, transaction) {
              test.ok(err != null);

              // Reload both account documents and verify
              // balance
              accountA.reload(function(err, accountA) {
                test.equal(null, err);
                test.equal(1000, accountA.balance);

                accountB.reload(function(err, accountB) {
                  test.equal(null, err);
                  test.equal(1000, accountB.balance);

                  // Get the transaction
                  collections['transactions'].findOne({_id: transaction.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal('canceled', doc.state);

                    db.close();
                    test.done();
                  });
                });
              });
            });
          });
        });
      });
    });
  }
}

exports['Should correctly roll back transfer that fails after application to accounts'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../schemas/account/account');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      setup(db, function() {
        // Create the two accounts used for a transfer
        var accountA = new Account(collections, "Joe3", 1000);
        var accountB = new Account(collections, "Paul3", 1000);

        // Instantiate First account
        accountA.create(function(err) {
          test.equal(null, err);

          // Instantiate Second account
          accountB.create(function(err) {
            test.equal(null, err);

            // Transfer 100 from A to B successfully
            accountA.transfer(accountB, 100, {fail: 'failAfterApply'}, function(err, transaction) {
              test.ok(err != null);

              // Reload both account documents and verify
              // balance
              accountA.reload(function(err, accountA) {
                test.equal(null, err);
                test.equal(1000, accountA.balance);

                accountB.reload(function(err, accountB) {
                  test.equal(null, err);
                  test.equal(1000, accountB.balance);

                  // Get the transaction
                  collections['transactions'].findOne({_id: transaction.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal('canceled', doc.state);

                    db.close();
                    test.done();
                  });
                });
              });
            });
          });
        });
      });
    });
  }
}

exports['Should correctly roll back transfer that fails after transaction set to commit but before clearing'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var ObjectID = configuration.require.ObjectID()
      , MongoClient = configuration.require.MongoClient
      , Account = require('../../schemas/account/account');

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          accounts: db.collection('accounts')
        , transactions: db.collection('transactions')
      }

      // Cleanup
      setup(db, function() {
        // Create the two accounts used for a transfer
        var accountA = new Account(collections, "Joe3", 1000);
        var accountB = new Account(collections, "Paul3", 1000);

        // Instantiate First account
        accountA.create(function(err) {
          test.equal(null, err);

          // Instantiate Second account
          accountB.create(function(err) {
            test.equal(null, err);

            // Transfer 100 from A to B successfully
            accountA.transfer(accountB, 100, {fail: 'failAfterCommit'}, function(err, transaction) {
              test.ok(err != null);

              // Reload both account documents and verify
              // balance
              accountA.reload(function(err, accountA) {
                test.equal(null, err);
                test.equal(900, accountA.balance);

                accountB.reload(function(err, accountB) {
                  test.equal(null, err);
                  test.equal(1100, accountB.balance);

                  // Get the transaction
                  collections['transactions'].findOne({_id: transaction.id}, function(err, doc) {
                    test.equal(null, err);
                    test.equal('committed', doc.state);

                    db.close();
                    test.done();
                  });
                });
              });
            });
          });
        });
      });
    });
  }
}