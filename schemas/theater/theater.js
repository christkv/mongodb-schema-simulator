"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID
  , Session = require('./session');

var Theater = function(db, name, seats) {
  this.db = db;
  this.name = name;
  this.seats = seats;
  this.theaters = db.collection('theaters');
  this.id = new ObjectID();
  this.sessions = []; 
}

Theater.prototype.create = function(callback) {
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
  this.theaters.insertOne(theater, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

Theater.prototype.addSession = function(name, description, start, end, price, callback) {
  var self = this;
  
  // Create a new session
  var session = new Session(this.db, this.id, name, description, start, end, price);
  session.create(function(err, session) {
    if(err) return callback(err);
    self.sessions.push(session);
    callback(null, session);
  });
}

module.exports = Theater;