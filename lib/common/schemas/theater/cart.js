"use strict";

var f = require('util').format,
  co = require('co'),
  ObjectID = require('mongodb').ObjectID,
  Receipt = require('./receipt'),
  Session = require('./session');

/*
 * Create a new cart instance
 */
class Cart {
  constructor(collections, id) {
    this.id = id == null ? new ObjectID() : id;
    this.collections = collections;
    this.carts = collections['carts'];
    this.sessions = collections['sessions'];
    this.theaters = collections['theaters'];
    this.receipts = collections['receipts'];
  }

  /*
   * Create a new cart
   */
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Create a new cart
        var r = yield self.carts.insertOne({
            _id: self.id
          , state: Cart.ACTIVE
          , total: 0
          , reservations: []
          , modifiedOn: new Date()
          , createdOn: new Date()
        });

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Attempt to reserve seats
   */
  reserve(theater, session, seats, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Reserve seats in the session
        yield session.reserve(self.id, seats, options);
        var err = null;
        var r = null;

        try {
          // Put reservation in the cart
          var r = yield self.carts.updateOne({
            _id: self.id
          }, {
              $push: {
                reservations: {
                    sessionId: session.id
                  , seats: seats
                  , price: session.price
                  , total: session.price * seats.length
                }
              }
            , $inc: { total: session.price * seats.length }
            , $set: { modifiedOn: new Date() }
          });
        } catch(e) {
          err = e;
        }

        // If we have an error or no modified documents
        if(err || r.modifiedCount == 0) {
          // Release the seats in the session
          var r = yield session.release(self.id, seats, options);

          if(r.modifiedCount == 0) {
            return reject(new Error('could not add seats to cart'));
          }

          if(r.result.writeConcernError)
            return reject(r.result.writeConcernError);

            // Could not add the seats to the cart
          return reject(new Error('could not add seats to cart'));
        }

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        // Success in reserving the seats and putting them in the cart
        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Attempt to checkout the cart
   */
  checkout(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Fetch the newest cart
        var doc = yield self.carts.findOne({_id: self.id});
        if(!doc) {
          // Cart is gone force clean all sessions for this cart
          yield Session.releaseAll(self.collections, self.id, options);
          return resolve(new Error(f('could not locate cart with id %s', self.id)));
        }

        var receipt = new Receipt(self.collections, doc.reservations);
        yield receipt.create(options);

        // Apply all reservations in the cart
        yield Session.apply(self.collections, doc._id);

        // Update state of Cart to DONE
        var r = yield self.carts.updateOne({
          _id: self.id
        }, {
          $set: {state: Cart.DONE }
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('could not find cart with id %s', self.id)))

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve();
      }).catch(reject);
    });
  }

  /*
   * Release a reservation
   */
  release(reservation, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Release all reservations in a specific reservation
        yield new Session(collections, reservation.sessionId).release(self.id, reservation.seats, options);
        resolve();
      }).catch(reject);
    });
  }


  /*
   * Destroy the cart and cleanup
   */
  destroy(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Fetch the cart
        var doc = yield self.carts.findOne({_id: self.id});

        if(!doc)
          return reject(new Error(f("could not locate cart with id %s", self.id)));

        // Reservations left
        var left = doc.reservations.length;

        // Any errors collected
        var errors = [];

        // For all the reservations, reverse them
        for(var i = 0; i < doc.reservations.length; i++) {
          self.release(doc.reservations[i], options, function(err, r) {
            left = left - 1;

            if(left == 0) {
              if(errors.length > 0) return reject(errors);
              resolve();
            }
          })
        }
      }).catch(reject);
    });
  }

  /*
   * Locate all expired carts and release all reservations
   */
  static releaseExpired(collections, options) {
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var carts = yield collections['carts'].find({state: Cart.EXPIRED}).toArray();
        if(carts.length == 0) return callback();
        var left = carts.length;

        // Process each cart
        var processCart = function(cart, callback) {
          co(function* () {
            // Release all reservations for this cart
            yield Session.releaseAll(collections, cart._id, options);
            // Set cart to expired
            yield collections['carts'].updateOne(
                { _id: cart._id }
              , { $set: { state: Cart.CANCELED }}, options);
            callback();
          }).catch(callback);
        }

        // Release all the carts
        for(var i = 0; i < carts.length; i++) {
          processCart(carts[i], function(err) {
            left = left - 1;
            if(left == 0) resolve();
          });
        }
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
        yield collections['carts'].ensureIndex({state:1});
        resolve();
      }).catch(reject);
    });
  }
}

Cart.ACTIVE = 'active';
Cart.DONE = 'done';
Cart.CANCELED = 'canceled';
Cart.EXPIRED = 'expired';

module.exports = Cart;
