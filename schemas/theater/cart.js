"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID
  , Receipt = require('./receipt');

var Cart = function(db) {
  this.db = db;
  this.id = new ObjectID();
  this.carts = db.collection('carts');
  this.sessions = db.collection('sessions');
  this.theaters = db.collection('theaters');
}

Cart.ACTIVE = 'active';
Cart.DONE = 'done';

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
  var seatsQuery = [];
  var setSeatsSelection = {};
  
  // Build the seats check
  for(var i = 0; i < seats.length; i++) {
    var seatSelector = {};
    // Build the $and that ensures that we only reserve seats if they are all available
    seatSelector[f('seats.%s.%s', seats[i][0], seats[i][1])] = 0;
    seatsQuery.push(seatSelector)
    // Set all the seats to occupied
    setSeatsSelection[f('seats.%s.%s', seats[i][0], seats[i][1])] = 1;
  }

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
    if(err) return callback(err);
    if(r.nModified == 0) return callback(new Error('could not add seats to cart'));

    // Attempt to reserve the seats
    self.sessions.updateOne({
        _id: session.id, theaterId: theater.id
      , $and: seatsQuery
    }, {
        $set: setSeatsSelection
      , $inc: { seatsAvailable: -seats.length }
      , $push: { 
        reservations: {
            cartId: self.id
          , seats: seats
          , price: session.price
          , total: session.price * seats.length
        } 
      }
    }, function(err, r) {
      if(err) return callback(err);
      if(r.nModified == 0) return callback(new Error(f('could not reserve seats %s', seats)));
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
    var receipt = new Receipt(self.db, doc.reservations);
    receipt.create(function(err, receipt) {
      if(err) return callback(err);

      // Apply the cart by removing the cart from all sessions
      self.sessions.updateMany({
        'reservations.cartId': doc._id
      }, {
        $pull: { reservations: { cartId: doc._id }}
      }, function(err, r) {
        if(err) return callback(err);

        // Update state of Cart to DONE
        self.carts.updateOne({
          _id: self.id
        }, {
          $set: {state: Cart.DONE }
        }, function(err, r) {
          if(err) return callback(err);
          if(r.nModified == 0) return callback(new Error(f('could not find cart with id %s', self.id)))
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
  var self = this;
  var setSeatsSelection = {};
  var seats = reservation.seats;
  
  // Release all the seats
  for(var i = 0; i < seats.length; i++) {
    setSeatsSelection[f('seats.%s.%s', seats[i][0], seats[i][1])] = 0;
  }

  // Remove the reservation
  self.sessions.updateOne({
    _id: sessionId
  }, {
      $set: setSeatsSelection
    , $pull: { reservations: { cartId: self.id }}
  }, function(err, r) {
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

module.exports = Cart;











