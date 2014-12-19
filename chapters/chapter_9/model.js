var ObjectID = require('mongodb').ObjectID;

var Transaction = function(db) {  
  var account1 = new ObjectID();
  var account2 = new ObjectID();
  var amount1 = 10000000;
  var amount2 = 10000000;
  var accounts = db.collection('accounts');
  var transactions = db.collection('transactions');
  var transferAmount = 100;

  this.create = function(callback) {
    accounts.insert([{
      name: account1, balance: amount1, pendingTransactions: []
    }, {
      name: account2, balance: amount2, pendingTransactions: []
    }], function(err, r) {
      if(err) return err;
      callback();
    });
  }

  //
  // Apply the transaction
  var applyTransaction = function(transactionId, options, callback) {
    // Set he transaction to pending
    transactions.updateOne({ _id: transactionId }, { $set: { state: 'pending' } }, function(err, r) {
      if(err) return callback(err);
      if(r.result.nUpdated == 0) return callback(new Error('failed to set transaction to pending'));

      // Apply the transaction to source (debiting)
      accounts.updateOne({
        name: account1, pendingTransactions: {$ne: transactionId}
      }, {
        $inc: {balance: -transferAmount}, $push: {pendingTransactions: transactionId}
      }, function(err, r) {
        if(err) return callback(err);
        if(r.result.nUpdated == 0) return callback(new Error('failed to apply transaction to account 1'));

        // Bail after step 1 to simulate failed transaction
        if(options.bailout == 1) return callback(new Error('bailout'), transactionId);

        // Apply the transaction to destination (crediting)
        accounts.updateOne({
          name: account2, pendingTransactions: {$ne: transactionId}
        }, {
          $inc: {balance: transferAmount}, $push: {pendingTransactions: transactionId}
        }, function(err, r) {
          if(err) return callback(err);
          if(r.result.nUpdated == 0) return callback(new Error('failed to apply transaction to account 2'));

          // Bail after step 2 to simulate failed transaction
          if(options.bailout == 2) return callback(new Error('bailout'), transactionId);
          callback();
        });
      });
    });
  }

  //
  // Clear pending transactions
  var clearPendingTransactions = function(transactionId, options, callback) {
    // Remove the pending transactions
    accounts.update({name: account1}, {$pull: {pendingTransactions: transactionId}}, function(err, r) {
      if(err) return callback(err);
      if(r.result.nUpdated == 0) return callback(new Error('failed to clear pending account1 transaction'));

      // Bail after step 4 to simulate failed transaction
      if(options.bailout == 4) return callback(new Error('bailout'), transactionId);

      // Remove the pending transactions
      accounts.update({name: account2}, {$pull: {pendingTransactions: transactionId}}, function(err, r) {
        if(err) return callback(err);
        if(r.result.nUpdated == 0) return callback(new Error('failed to clear pending account2 transaction'));

        // Bail after step 5 to simulate failed transaction
        if(options.bailout == 5) return callback(new Error('bailout'), transactionId);
        callback();
      });
    });
  }

  this.transfer = function(options, callback) {
    if(typeof options == 'function') callback = options, options = {};
    // Create transaction id
    var transactionId = new ObjectID();
    
    // Set up initial transaction
    transactions.insert({_id: transactionId, source: account1, destination: account2, amount: transferAmount, state: 'initial'}, function(err, r) {
      if(err) return callback(err);
      if(r.result.nInserted == 0) return callback(new Error('failed to initialize transaction'));
      
      applyTransaction(transactionId, options, function(err) {
        if(err) return callback(err);

        // Set the transaction to committed state
        transactions.update({_id: transactionId}, {$set: {state: 'committed'}}, function(err, r) {
          if(err) return callback(err);
          if(r.result.nUpdated == 0) return callback(new Error('failed to set transaction to committed'));

          // Bail after step 3 to simulate failed transaction
          if(options.bailout == 3) return callback(new Error('bailout'), transactionId);

          // Clear pending transaction
          clearPendingTransactions(transactionId, options, function() {
            
            // Set the transaction to committed state
            transactions.update({_id: transactionId}, {$set: {state: 'done'}}, function(err, r) {
              if(err) return callback(err);
              if(r.result.nUpdated == 0) return callback(new Error('failed to set transaction to done'));
              callback();
            });
          });
        });
      });
    });
  }

  //
  // Roll back a transaction that was not applied to accounts
  var rollBackBeforeAccountApply = function(transactionId, callback) {
    // Simple to rollback, just cancel the transaction
    transactions.updateOne({_id: transactionId}, {$set: {state: 'cancelled'}}, callback);
  }

  //
  // Roll back a transaction that was either partially applied or fully applied
  var rollBackPartialApply = function(transactionId, callback) {
    // Locate transaction and reverse it if it's applied
    transactions.findOne({_id: transactionId}, function(err, transaction) {        
      if(err) return callback(err);

      // Reverse source transaction application
      accounts.updateOne({name: transaction.source, pendingTransactions: {$in: [transactionId]}}
        , {$inc: {balance: transaction.amount}, $pull: { pendingTransactions: transactionId}}, function(err, r) {
          if(err) return callback(err);

          // Reverse destination transaction application
          accounts.updateOne({name: transaction.destination, pendingTransactions: {$in: [transactionId]}}
            , {$inc: {balance: -transaction.amount}, $pull: { pendingTransactions: transactionId}}, function(err, r) {
            if(err) return callback(err);

            // Set canceled transaction
            transactions.updateOne({_id: transactionId}, {$set: {state: 'canceled'}}, callback);
          });
        });
    });
  }

  var rollBackFullApply = function(transactionId, callback) {
  }

  this.rollback = function(callback) {
    // Decide a random bailout point
    var bailout = (Math.round(Math.random() * 5) % 5) + 1;
    // Perform a transaction and bail out at a random point
    this.transfer({bailout: bailout}, function(err, transactionId) {
      // Validate if the transaction was applied to the accounts
      if(accounts.count({pendingTransactions: { $in: [transactionId] }}, function(err, count) {
        // Not applied to any account
        if(count == 0) return rollBackBeforeAccountApply(transactionId, callback);

        // Applied to one account
        if(count == 1) return rollBackPartialApply(transactionId, callback);        
        
        // Applied to both accounts
        rollBackFullApply(transactionId, count, callback);
      });
    });
  }
}

module.exports = Transaction;