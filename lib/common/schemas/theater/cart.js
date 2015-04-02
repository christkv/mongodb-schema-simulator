"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID
  , Receipt = require('./receipt')
  , Session = require('./session');

/*
 * Create a new cart instance
 */
var Cart = function(collections, id) {
  this.id = id == null ? new ObjectID() : id;
  this.collections = collections;
  this.carts = collections['carts'];
  this.sessions = collections['sessions'];
  this.theaters = collections['theaters'];
  this.receipts = collections['receipts'];
}

Cart.ACTIVE = 'active';
Cart.DONE = 'done';
Cart.CANCELED = 'canceled';
Cart.EXPIRED = 'expired';

/*
 * Create a new cart
 */
Cart.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
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
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    callback(null, self);
  })
}

/*
 * Attempt to reserve seats
 */
Cart.prototype.reserve = function(theater, session, seats, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Reserve seats in the session
  session.reserve(this.id, seats, options, function(err, session) {
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
    }, options, function(err, r) {
      // If we have an error or no modified documents
      if(err || r.modifiedCount == 0) {
        // Release the seats in the session
        session.release(self.id, seats, options, function(err, r) {
          if(err) return callback(err);
          if(r.modifiedCount == 0) {
            return callback(new Error('could not add seats to cart'));
          }
          if(r.result.writeConcernError) return callback(r.result.writeConcernError);
        });
      }

      if(r.result.writeConcernError) return callback(r.result.writeConcernError);      
      // Success in reserving the seats and putting them in the cart
      callback(null, self);
    });
  });
}

/*
 * Attempt to checkout the cart
 */
Cart.prototype.checkout = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  // Fetch the newest cart
  self.carts.findOne({_id: self.id}, function(err, doc) {
    if(err) return callback(err);
    if(!doc) {
      // Cart is gone force clean all sessions for this cart
      return Session.releaseAll(self.collections, self.id, options, function(err, result) {
        callback(new Error(f('could not locate cart with id %s', self.id)));
      })
    }

    var receipt = new Receipt(self.collections, doc.reservations);
    receipt.create(options, function(err, receipt) {
      if(err) return callback(err);

      // Apply all reservations in the cart
      Session.apply(self.collections, doc._id, function(err) {
        if(err) return callback(err);
        
        // Update state of Cart to DONE
        self.carts.updateOne({
          _id: self.id
        }, {
          $set: {state: Cart.DONE }
        }, options, function(err, r) {
          if(err) return callback(err);
          if(r.modifiedCount == 0) return callback(new Error(f('could not find cart with id %s', self.id)))
          if(r.result.writeConcernError) return callback(r.result.writeConcernError);
          callback();
        })
      })
    }) 
  });
}

/*
 * Release a reservation
 */
Cart.prototype.release = function(reservation, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  // Release all reservations in a specific reservation
  new Session(collections, reservation.sessionId).release(self.id, reservation.seats, options, function(err, session) {
    if(err) return callback(err);
    callback();
  });
}


/*
 * Destroy the cart and cleanup
 */
Cart.prototype.destroy = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
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
      self.release(doc.reservations[i], options, function(err, r) {
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
Cart.releaseExpired = function(collections, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  
  collections['carts'].find({state: Cart.EXPIRED}).toArray(function(err, carts) {
    if(err) return callback(err);
    if(carts.length == 0) return callback();
    var left = carts.length;

    // Process each cart
    var processCart = function(cart, callback) {
      // Release all reservations for this cart
      Session.releaseAll(collections, cart._id, options, function(err) {
        // Set cart to expired
        collections['carts'].updateOne(
            { _id: cart._id }
          , { $set: { state: Cart.CANCELED }}, options, callback);
      });
    }

    // Release all the carts
    for(var i = 0; i < carts.length; i++) {
      processCart(carts[i], function(err) {
        left = left - 1;

        if(left == 0) callback();
      });
    }
  });
}

/*
 * Create the optimal indexes for the queries
 */
Cart.createOptimalIndexes = function(collections, callback) {
  collections['carts'].ensureIndex({state:1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Cart;











