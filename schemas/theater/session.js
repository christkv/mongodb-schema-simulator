"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID;

var Session = function(db, theaterId, name, description, start, end, price) {  
  this.db = db;
  this.theaterId = theaterId;
  this.name = name;
  this.description = description;
  this.start = start;
  this.end = end;
  this.price = price;
  this.sessions = db.collection('sessions');
  this.theaters = db.collection('theaters');
}

Session.prototype.create = function(callback) {
  var self = this;

  this.theaters.findOne({_id: this.theaterId}, function(err, doc) {
    if(err) return callback(err);
    if(!doc) return callback(new Error(f("no theater instance found for id %s", this.theaterId)));
    // Create a session id
    self.id = new ObjectID();

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

module.exports = Session;