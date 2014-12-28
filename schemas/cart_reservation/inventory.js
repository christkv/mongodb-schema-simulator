"use strict";

var f = require('util').format;

var Inventory = function(db, id) {  
  this.db = db;
  this.id = id;
  this.inventories = db.collection('inventories';)
}

/*
 * Reserve a specific quantity of a product for a cart
 */
Inventory.prototype.reserve = function(id, quantity, callback) {
  var self = this;

  this.inventories.updateOne({
    _id: this.id, quantity: { $gte: quantity }
  }, {
      $inc: {quantity: -quantity}
    , $push: {
      reserved: {
        quantity: quantity, cartId: id, created_on: new Date()
      }
    }
  }, function(err, r) {
    if(err) return callback(err);
    if(r.nUpdated == 0) return callback(new Error(f('could not add the reservation for %s with the quantity %s', id, quantity)));
    callback(null, self);
  });
}

/*
 * Change the reservation quantity for a specific cart
 */
Inventory.prototype.adjust = function(id, quantity, delta, callback) {
  var self = this;

  // Attempt to update a reservation of inventory
  self.inventories.updateOne({
      _id: self.id
    , 'reserved._id': id
    , quantity: {
      $gte: delta
    }
  }, {
      $inc: { quantity: -delta }
    , $set: {
         'reserved.$.quantity': quantity
      , modified_on: new Date()
    }
  }, function(err, r) {
    if(err) return callback(err);
    if(r.result.nModified == 0) return callback(new Error(f('could not adjust the reservation for %s with the change of quantity %s', id, delta)));
    callback(null, self);
  });
}

/*
 * Release a reservation for a specific cart
 */
Inventory.prototype.release = function(id, callback) {
  var self = this;
  // Get the latest inventory view to retrieve the amount in the reservation
  self.inventories.findOne({
    _id: self.id
  }, function(err, doc) {
    if(err) return callback(err);

    // Keep the reserved quantity
    var quantity = 0;

    // Locate the reserved quantity
    for(var i = 0; i < doc.reserved.length; i++) {
      if(doc.reserved[i]._id == id) {
        quantity = doc.reserved[i].quantity;
        break;
      }
    }

    // Update the inventory removing the reserved item and returning
    // the quantity
    self.inventories.updateOne({
        _id: self.id
      , "reserved._id": id    
    }, {
        $pull : { reserved: {_id: id } }
      , $inc: { quantity: quantity }
    }, function(err, r) {
      if(err) return callback(err);
      if(r.result.nModified == 0) return callback(new Error(f('failed to remove reservation for %s from inventory for product %s', id, self.id)));
      callback(null, self);
    });
  });
}

/*
 * Commit all the reservations by removing them from the reserved array
 */
Inventory.commit = function(db, id, callback) {
  db.collection('inventories').updateMany({
    'reserved._id': id
  }, {
    $pull: { reserved: {_id: id } }
  }, function(err, r) {
    if(err) return callback(err);
    callback();
  });
}

module.exports = Inventory;