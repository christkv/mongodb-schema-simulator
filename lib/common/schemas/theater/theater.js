"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID
  , Session = require('./session');

/*
 * Create a new theater instance
 */
var Theater = function(collections, id, name, seats) {
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
Theater.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  var seatsAvailable = 0;
  for(var i = 0; i < this.seats.length; i++) {
    seatsAvailable += this.seats[i].length;
  }

  // Theater
  var theater = {
      _id: this.id
    , name: this.name
    , seats: this.seats
    , seatsAvailable: seatsAvailable
  }

  // Save the document
  this.theaters.insertOne(theater, options, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

/*
 *  Add a new screening session to the theater
 */
Theater.prototype.addSession = function(name, description, start, end, price, options, callback) {
  var self = this;
  if(typeof options == 'function') callback = options, options = {};
  
  // Create a new session
  var session = new Session(this.collections, options.id == null ? new ObjectID() : options.id, this.id, name, description, start, end, price);
  session.create(options, function(err, session) {
    if(err) return callback(err);
    self.sessions.push(session);
    callback(null, session);
  });
}

/*
 * Create the optimal indexes for the queries
 */
Theater.createOptimalIndexes = function(collections, callback) {
  callback();
}

module.exports = Theater;