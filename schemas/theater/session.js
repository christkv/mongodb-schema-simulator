"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID;

var Session = function(db, id, theaterId, name, description, start, end, price) {  
  this.db = db;
  this.id = id;
  this.theaterId = theaterId;
  this.name = name;
  this.description = description;
  this.start = start;
  this.end = end;
  this.price = price;
  this.sessions = db.collection('sessions');
  this.theaters = db.collection('theaters');
}

/*
 *  Create a new session instance and save the document in mongodb
 */
Session.prototype.create = function(callback) {
  var self = this;

  this.theaters.findOne({_id: this.theaterId}, function(err, doc) {
    if(err) return callback(err);
    if(!doc) return callback(new Error(f("no theater instance found for id %s", this.theaterId)));

    // Set current values
    self.seatsAvailable = doc.seatsAvailable;
    self.seats = doc.seats;

    // Create a session for this theater
    self.sessions.insertOne({
        _id: self.id
      , theaterId: self.theaterId
      , name: self.name
      , description: self.description
      , start: self.start
      , end: self.end
      , price: self.price
      , seatsAvailable: doc.seatsAvailable
      , seats: doc.seats
      , reservations: []
    }, function(err, r) {
      if(err) return callback(err);
      callback(null, self);
    });
  });
}

/*
 *  Perform a reservation of a set of seats in this specific session
 */
Session.prototype.reserve = function(id, seats, callback) {
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

  // Attempt to reserve the seats
  self.sessions.updateOne({
      _id: self.id, theaterId: self.theaterId
    , $and: seatsQuery
  }, {
      $set: setSeatsSelection
    , $inc: { seatsAvailable: -seats.length }
    , $push: { 
      reservations: {
          cartId: self.id
        , seats: seats
        , price: self.price
        , total: self.price * seats.length
      } 
    }
  }, function(err, r) {
    if(err) return callback(err);
    if(r.nModified == 0) return callback(new Error(f('could not reserve seats %s', seats)));  
    callback(null, self);
  })
}

/*
 *  Release a specific reservation and clear seats
 */
Session.prototype.release = function(id, seats, callback) {
  var setSeatsSelection = {};
  // Release all the seats
  for(var i = 0; i < seats.length; i++) {
    setSeatsSelection[f('seats.%s.%s', seats[i][0], seats[i][1])] = 0;
  }

  // Remove the reservation
  this.sessions.updateOne({
    _id: this.id
  }, {
      $set: setSeatsSelection
    , $pull: { reservations: { cartId: id }}
  }, function(err, r) {
    if(err) return callback(err);
    callback();
  });
}

/*
 * Apply all the reservations for a specific id across all sessions
 */
Session.apply = function(db, id, callback) {
  // Apply the cart by removing the cart from all sessions
  db.collection('sessisons').updateMany({
    'reservations.cartId': id
  }, {
    $pull: { reservations: { cartId: id }}
  }, function(err, r) {
    if(err) return callback(err);
    callback();
  });  
}

module.exports = Session;