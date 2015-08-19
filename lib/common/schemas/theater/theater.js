"use strict";

var f = require('util').format,
  ObjectID = require('mongodb').ObjectID,
  Session = require('./session'),
  co = require('co');

/*
 * Create a new theater instance
 */
class Theater {
  constructor(collections, id, name, seats) {
    this.id = id == null ? new ObjectID() : id;
    this.collections = collections;
    this.name = name;
    this.seats = seats;
    this.theaters = collections['theaters'];
    this.sessions = [];
  }

  /*
   *  Create a new theater instance
   */
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var seatsAvailable = 0;
        for(var i = 0; i < self.seats.length; i++) {
          seatsAvailable += self.seats[i].length;
        }

        // Theater
        var theater = {
            _id: self.id
          , name: self.name
          , seats: self.seats
          , seatsAvailable: seatsAvailable
        }

        // Save the document
        yield self.theaters.insertOne(theater, options);
        resolve(self);
      }).catch(reject);
    });
  }

  /*
   *  Add a new screening session to the theater
   */
  addSession(name, description, start, end, price, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Create a new session
        var session = new Session(self.collections, options.id == null ? new ObjectID() : options.id, self.id, name, description, start, end, price);
        session = yield session.create(options);
        self.sessions.push(session);
        resolve(session);
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Theater;
