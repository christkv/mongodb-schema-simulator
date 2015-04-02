"use strict";

var f = require('util').format
  , ObjectID = require('mongodb').ObjectID;

var Inventory = function(collections, id, quantity) {  
  this.id = id == null ? new ObjectID() : id;
  this.quantity = quantity;
  this.inventories = collections['inventories'];
}

/*
 * Create an inventory mongodb document
 */
Inventory.prototype.create = function(options, callback) {
  if(typeof options == 'function') callback = options, options = {};

  var self = this;
  self.inventories.insertOne({
      _id: this.id
    , quantity: this.quantity
    , reservations: []
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    callback(null, self);
  });
}

/*
 * Reserve a specific quantity of a product for a cart
 */
Inventory.prototype.reserve = function(id, quantity, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  this.inventories.updateOne({
    _id: this.id, quantity: { $gte: quantity }
  }, {
      $inc: {quantity: -quantity}
    , $push: {
      reservations: {
        quantity: quantity, _id: id, created_on: new Date()
      }
    }
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('could not add the reservation for %s with the quantity %s', id, quantity)));
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    callback(null, self);
  });
}

/*
 * Change the reservation quantity for a specific cart
 */
Inventory.prototype.adjust = function(id, quantity, delta, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Attempt to update a reservation of inventory
  self.inventories.updateOne({
      _id: self.id
    , 'reservations._id': id
    , quantity: {
      $gte: delta
    }
  }, {
      $inc: { quantity: -delta }
    , $set: {
         'reservations.$.quantity': quantity
      , modified_on: new Date()
    }
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('could not adjust the reservation for %s with the change of quantity %s', id, delta)));
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    callback(null, self);
  });
}

/*
 * Release all the reservations for a cart across all products
 */
Inventory.releaseAll = function(collections, id, options, callback) {
  if(typeof options == 'function') callback = options, options = {};

  collections['inventories'].find({
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
      new Inventory(collections, doc._id).release(reservation._id, options, callback);
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
 * Release a reservation for a specific cart
 */
Inventory.prototype.release = function(id, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Get the latest inventory view to retrieve the amount in the reservation
  self.inventories.findOne({
    _id: self.id
  }, function(err, doc) {
    if(err) return callback(err);

    // Keep the reservations quantity
    var quantity = 0;

    // Locate the reservations quantity
    for(var i = 0; i < doc.reservations.length; i++) {
      if(doc.reservations[i]._id.equals(id)) {
        quantity = doc.reservations[i].quantity;
        break;
      }
    }

    // Update the inventory removing the reservations item and returning
    // the quantity
    self.inventories.updateOne({
        _id: self.id
      , "reservations._id": id    
    }, {
        $pull : { reservations: {_id: id } }
      , $inc: { quantity: quantity }
    }, options, function(err, r) {
      if(err) return callback(err);
      if(r.modifiedCount == 0) return callback(new Error(f('failed to remove reservation for %s from inventory for product %s', id, self.id)));
      if(r.result.writeConcernError) return callback(r.result.writeConcernError);
      callback(null, self);
    });
  });
}

/*
 * Commit all the reservations by removing them from the reservations array
 */
Inventory.commit = function(collections, id, options, callback) {
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  collections['inventories'].updateMany({
    'reservations._id': id
  }, {
    $pull: { reservations: {_id: id } }
  }, options, function(err, r) {
    if(err) return callback(err);
    if(r.modifiedCount == 0) return callback(new Error(f('no reservations for cart %s found in inventory', id)));
    if(r.result.writeConcernError) return callback(r.result.writeConcernError);
    callback();
  });
}

/*
 * Create the optimal indexes for the queries
 */
Inventory.createOptimalIndexes = function(collections, callback) {
  collections['inventories'].ensureIndex({"reservations._id": 1}, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Inventory;