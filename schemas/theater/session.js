"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID;

/*
 * Create a new session instance
 */
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
          _id: id
        , seats: seats
        , price: self.price
        , total: self.price * seats.length
      } 
    }
  }, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('could not reserve seats %s', seats)));  
    callback(null, self);
  })
}

/*
 * Release all the reservations for a cart across all sessions
 */
Session.releaseAll = function(db, id, callback) {
  db.collection('sessions').find({
    'reservations._id': id
  }).toArray(function(err, docs) {
    if(err) return callback(err);
    if(docs.length == 0) return callback();

    // Reverses a specific reservation
    var reverseReservation = function(doc, id, callback) {
      // Locate the right cart id
      var reservation = null;
      
      for(var i = 0; i < doc.reservations.length; i++) {
        if(doc.reservations[i]._id.equals(id)) {
          reservation = doc.reservations[i];
          break;
        }
      }

      // No reservation found return
      if(!reservation) return callback();
      // Reverse the specific reservation
      new Session(db, doc._id).release(reservation._id, reservation.seats, callback);
    }

    // Process all the entries
    var left = docs.length;

    // For each entry reverse the reservation for this cart
    for(var i = 0; i < docs.length; i++) {
      reverseReservation(docs[i], id, function(err) {
        left = left - 1;

        if(left == 0) {
          callback();
        }
      });
    }
  });
}

/*
 * Release a specific reservation and clear seats
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
    , $pull: { reservations: { _id: id }}
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
  db.collection('sessions').updateMany({
    'reservations._id': id
  }, {
    $pull: { reservations: { _id: id }}
  }, function(err, r) {
    if(err) return callback(err);
    callback();
  });  
}

/*
 * Create the optimal indexes for the queries
 */
Session.createOptimalIndexes = function(db, callback) {
  db.collection('sessions').ensureIndex({'reservations._id':1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Session;