"use strict";

var f = require('util').format,
  co = require('co'),
  ObjectID = require('mongodb').ObjectID;

/*
 * Create a new session instance
 */
class Session {
  constructor(collections, id, theaterId, name, description, start, end, price) {
    this.id = id == null ? new ObjectID() : id;
    this.theaterId = theaterId;
    this.name = name;
    this.description = description;
    this.start = start;
    this.end = end;
    this.price = price;
    this.sessions = collections['sessions'];
    this.theaters = collections['theaters'];
  }

  /*
   *  Create a new session instance and save the document in mongodb
   */
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var doc = yield self.theaters.findOne({_id: self.theaterId});
        if(!doc)
          return reject(new Error(f("no theater instance found for id %s", self.theaterId)));

        // Set current values
        self.seatsAvailable = doc.seatsAvailable;
        self.seats = doc.seats;

        // Create a session for this theater
        var r = yield self.sessions.insertOne({
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
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   *  Perform a reservation of a set of seats in this specific session
   */
  reserve(id, seats, options) {
    if(typeof options == 'function') callback = options, options = {};
    var self = this;
    var seatsQuery = [];
    var setSeatsSelection = {};

    return new Promise(function(resolve, reject) {
      co(function* () {
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
        var r = yield self.sessions.updateOne({
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
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('could not reserve seats %s', seats)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Release a specific reservation and clear seats
   */
  release(id, seats, options) {
    var self = this;
    options = options || {};

    var setSeatsSelection = {};
    // Release all the seats
    for(var i = 0; i < seats.length; i++) {
      setSeatsSelection[f('seats.%s.%s', seats[i][0], seats[i][1])] = 0;
    }

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Remove the reservation
        var r = yield self.sessions.updateOne({
          _id: self.id
        }, {
            $set: setSeatsSelection
          , $pull: { reservations: { _id: id }}
        }, options);
        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve();
      }).catch(reject);
    });
  }

  /*
   * Release all the reservations for a cart across all sessions
   */
  static releaseAll(collections, id, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var docs = yield collections['sessions'].find({
          'reservations._id': id
        }).toArray();
        if(docs.length == 0) return resolve();

        // Reverses a specific reservation
        var reverseReservation = function(doc, id, callback) {
          co(function* () {
            // Locate the right cart id
            var reservation = null;

            for(var i = 0; i < doc.reservations.length; i++) {
              if(doc.reservations[i]._id.toString() == id.toString()) {
                reservation = doc.reservations[i];
                break;
              }
            }

            // No reservation found return
            if(!reservation) return callback();
            // Reverse the specific reservation
            var session = new Session(collections, doc._id)
            yield session.release(reservation._id, reservation.seats, options);
            callback();
          }).catch(callback);
        }

        // Process all the entries
        var left = docs.length;

        // For each entry reverse the reservation for this cart
        for(var i = 0; i < docs.length; i++) {
          reverseReservation(docs[i], id, function(err) {
            left = left - 1;

            if(left == 0) {
              resolve();
            }
          });
        }
      }).catch(reject);
    });
  }

  /*
   * Apply all the reservations for a specific id across all sessions
   */
  static apply(collections, id, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Apply the cart by removing the cart from all sessions
        var r = yield collections['sessions'].updateMany({
          'reservations._id': id
        }, {
          $pull: { reservations: { _id: id }}
        }, options);
        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve();
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['sessions'].ensureIndex({'reservations._id':1});
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Session;
