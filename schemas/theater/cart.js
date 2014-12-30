"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID
  , Receipt = require('./receipt')
  , Session = require('./session');

var Cart = function(db) {
  this.db = db;
  this.id = new ObjectID();
  this.carts = db.collection('carts');
  this.sessions = db.collection('sessions');
  this.theaters = db.collection('theaters');
}

Cart.ACTIVE = 'active';
Cart.DONE = 'done';
Cart.CANCELED = 'canceled';
Cart.EXPIRED = 'expired';

/*
 * Create a new cart
 */
Cart.prototype.create = function(callback) {
  var self = this;

  // Create a new cart
  this.carts.insertOne({
      _id: self.id
    , state: Cart.ACTIVE
    , total: 0
    , reservations: []
    , modifiedOn: new Date()
    , createdOn: new Date()
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  })
}

/*
 * Attempt to reserve seats
 */
Cart.prototype.reserve = function(theater, session, seats, callback) {
  var self = this;

  // Reserve seats in the session
  session.reserve(this.id, seats, function(err, session) {
    if(err) return callback(err);

    // Put reservation in the cart
    self.carts.updateOne({
      _id: self.id
    }, {
        $push: { 
          reservations: {
              sessionId: session.id
            , seats: seats
            , price: session.price
            , total: session.price * seats.length
          }
        }
      , $inc: { total: session.price * seats.length }
      , $set: { modifiedOn: new Date() }
    }, function(err, r) {
      // If we have an error or no modified documents
      if(err || r.result.nModified == 0) {
        // Release the seats in the session
        session.release(self.id, seats, function(err, r) {
          if(err) return callback(err);
          if(r.result.nModified == 0) {
            return callback(new Error('could not add seats to cart'));
          }
        });
      }
      
      // Success in reserving the seats and putting them in the cart
      callback(null, self);
    });
  });
}

/*
 * Attempt to checkout the cart
 */
Cart.prototype.checkout = function(callback) {
  var self = this;
  // Fetch the newest cart
  self.carts.findOne({_id: self.id}, function(err, doc) {
    if(err) return callback(err);
    if(!doc) {
      // Cart is gone force clean all sessions for this cart
      return Session.releaseAll(self.db, self.id, function(err, result) {
        callback(new Error(f('could not locate cart with id %s', self.id)));
      })
    }

    var receipt = new Receipt(self.db, doc.reservations);
    receipt.create(function(err, receipt) {
      if(err) return callback(err);

      // Apply all reservations in the cart
      Session.apply(self.db, doc._id, function(err) {
        if(err) return callback(err);
        
        // Update state of Cart to DONE
        self.carts.updateOne({
          _id: self.id
        }, {
          $set: {state: Cart.DONE }
        }, function(err, r) {
          if(err) return callback(err);
          if(r.result.nModified == 0) return callback(new Error(f('could not find cart with id %s', self.id)))
          callback();
        })
      })
    }) 
  });
}

/*
 * Release a reservation
 */
Cart.prototype.release = function(reservation, callback) {
  // Release all reservations in a specific reservation
  new Session(self.db, reservation.sessionId).release(self.id, reservation.seats, function(err, session) {
    if(err) return callback(err);
    callback();
  });
}


/*
 * Destroy the cart and cleanup
 */
Cart.prototype.destroy = function(callback) {
  var self = this;
  // Fetch the cart
  self.carts.findOne({_id: self.id}, function(err, doc) {
    if(err) return callback(err);
    if(!doc) return callback(new Error(f("could not locate cart with id %s", self.id)));
  
    // Reservations left
    var left = doc.reservations.length;
    // Any errors collected
    var errors = [];
    // For all the reservations, reverse them
    for(var i = 0; i < doc.reservations.length; i++) {
      self.release(doc.reservations[i], function(err, r) {
        left = left - 1;

        if(left == 0) {
          if(errors.length > 0) return callback(errors);
          callback();
        }
      })
    }
  });
}

/*
 * Locate all expired carts and release all reservations
 */
Cart.releaseExpired = function(db, callback) {
  db.collection('carts').find({state: Cart.EXPIRED}).toArray(function(err, carts) {
    if(err) return callback(err);
    if(carts.length == 0) return callback();
    var left = carts.length;

    // Release all the carts
    for(var i = 0; i < carts.length; i++) {
      Session.releaseAll(db, carts[i]._id, function(err) {
        left = left - 1;

        if(left == 0) callback();
      });
    }
  });
}

/*
 * Create the optimal indexes for the queries
 */
Cart.createOptimalIndexes = function(db, callback) {
  callback();
}

module.exports = Cart;











