"use strict";

var f = require('util').format,
  co = require('co'),
  ObjectID = require('mongodb').ObjectID;

class Inventory {
  constructor(collections, id, quantity) {
    this.id = id == null ? new ObjectID() : id;
    this.quantity = quantity;
    this.inventories = collections['inventories'];
  }

  /*
   * Create an inventory mongodb document
   */
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var r = yield self.inventories.insertOne({
            _id: self.id
          , quantity: self.quantity
          , reservations: []
        }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Reserve a specific quantity of a product for a cart
   */
  reserve(id, quantity, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var r = yield self.inventories.updateOne({
          _id: self.id, quantity: { $gte: quantity }
        }, {
            $inc: {quantity: -quantity}
          , $push: {
            reservations: {
              quantity: quantity, _id: id, created_on: new Date()
            }
          }
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('could not add the reservation for %s with the quantity %s', id, quantity)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Change the reservation quantity for a specific cart
   */
  adjust(id, quantity, delta, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Attempt to update a reservation of inventory
        var r = yield self.inventories.updateOne({
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
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('could not adjust the reservation for %s with the change of quantity %s', id, delta)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Release all the reservations for a cart across all products
   */
  static releaseAll(collections, id, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var docs = yield collections['inventories'].find({
          'reservations._id': id
        }).toArray();

        if(docs.length == 0) return resolve();

        // Reverses a specific reservation
        var reverseReservation = function(doc, id, callback) {
          co(function*() {
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
            var inventory = new Inventory(collections, doc._id)
            yield inventory.release(reservation._id, options);
            callback();
          });
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
   * Release a reservation for a specific cart
   */
  release(id, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Get the latest inventory view to retrieve the amount in the reservation
        var doc = yield self.inventories.findOne({
          _id: self.id
        });

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
        var r = yield self.inventories.updateOne({
            _id: self.id
          , "reservations._id": id
        }, {
            $pull : { reservations: {_id: id } }
          , $inc: { quantity: quantity }
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('failed to remove reservation for %s from inventory for product %s', id, self.id)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Commit all the reservations by removing them from the reservations array
   */
  static commit(collections, id, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var r = yield collections['inventories'].updateMany({
          'reservations._id': id
        }, {
          $pull: { reservations: {_id: id } }
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('no reservations for cart %s found in inventory', id)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['inventories'].ensureIndex({"reservations._id": 1});
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = Inventory;
