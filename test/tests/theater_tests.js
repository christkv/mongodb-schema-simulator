"use strict";

var co = require('co');

var setup = function(db) {
  var Session = require('../../lib/common/schemas/theater/session')
    , Cart = require('../../lib/common/schemas/theater/cart');

  // All the collections used
  var collections = {
      theaters: db.collection('theaters')
    , sessions: db.collection('sessions')
    , carts: db.collection('carts')
    , receipts: db.collection('receipts')
  }

  return new Promise(function(resolve, reject) {
    co(function* () {
      try { yield collections['theaters'].drop(); } catch(err) {};
      try { yield collections['sessions'].drop(); } catch(err) {};
      try { yield collections['carts'].drop(); } catch(err) {};
      try { yield collections['receipts'].drop(); } catch(err) {};
      yield Session.createOptimalIndexes(collections);
      yield Cart.createOptimalIndexes(collections);
      resolve();
    }).catch(reject);
  });
}

var validateSeats = function(collections, test, session, seats, seatsLeft) {
  return new Promise(function(resolve, reject) {
    co(function* () {
      var doc = yield collections['sessions'].findOne({_id: session.id});
      test.ok(doc != null);
      test.equal(doc.seatsAvailable, seatsLeft);

      for(var i = 0; i < seats.length; i++) {
        var seat = seats[i];
        test.equal(doc.seats[seat[0]][seat[1]], 1);
      }

      test.equal(0, doc.reservations.length);
      resolve();
    }).catch(reject);
  });
}

var validateCart = function(collections, test, cart, state, reservations) {
  return new Promise(function(resolve, reject) {
    co(function* () {
      var doc = yield collections['carts'].findOne({_id: cart.id});
      test.ok(doc != null);
      test.equal(reservations.length, doc.reservations.length);
      test.equal(state, doc.state);

      // Validate all the reservations in the cart
      for(var i = 0; i < reservations.length; i++) {
        test.equal(doc.reservations[i].total, reservations[i].total);
        test.deepEqual(doc.reservations[i].seats, reservations[i].seats);
      }

      resolve();
    }).catch(reject);
  });
}

exports['Should correctly set up theater and session and buy tickets for some row seats'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Theater = require('../../lib/common/schemas/theater/theater')
      , Session = require('../../lib/common/schemas/theater/session')
      , Cart = require('../../lib/common/schemas/theater/cart')
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          theaters: db.collection('theaters')
        , sessions: db.collection('sessions')
        , carts: db.collection('carts')
        , receipts: db.collection('receipts')
      }

      // Cleanup
      yield setup(db);

      // Create a new Theater
      var theater = new Theater(collections, 1, 'The Royal', [
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ]);

      // Create a theater instance
      var theater = yield theater.create();
      test.ok(theater != null);

      // Add a session to the theater
      var session = yield theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10);
      test.ok(session != null);

      // Create a cart
      var cart = new Cart(collections, 1);
      yield cart.create();
      test.ok(cart != null);

      // Seats to reserve [y cord, x cord]
      var seats = [[1, 5], [1, 6], [1, 7]];

      // Reserve some seats at the movie
      var cart = yield cart.reserve(theater, session, seats);

      // Reservation ok, checkout the cart
      yield cart.checkout();

      // Validate seat reservations
      yield validateSeats(collections, test
        , session, seats, (session.seatsAvailable - seats.length));

      // Our expected cart reservations
      var expectedReservations = [{
            seats: seats
          , total: seats.length * session.price
        }
      ];

      // validateCart
      yield validateCart(collections, test, cart, 'done', expectedReservations);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Should correctly set up theater and session and book tickets but fail to reserve the tickets'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Theater = require('../../lib/common/schemas/theater/theater')
      , Session = require('../../lib/common/schemas/theater/session')
      , Cart = require('../../lib/common/schemas/theater/cart')
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          theaters: db.collection('theaters')
        , sessions: db.collection('sessions')
        , carts: db.collection('carts')
        , receipts: db.collection('receipts')
      }

      // Cleanup
      yield setup(db);

      // Create a new Theater
      var theater = new Theater(collections, 1, 'The Royal', [
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ]);

      // Create a theater instance
      yield theater.create();
      test.ok(theater != null);

      // Add a session to the theater
      var session = yield theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10);
      test.ok(session != null);

      // Create a cart
      var cart = new Cart(collections, 1)
      yield cart.create();
      test.ok(cart != null);

      // Seats to reserve [y cord, x cord]
      var seats = [[1, 5], [1, 6], [1, 7]]

      // Reserve some seats at the movie
      var cart = yield cart.reserve(theater, session, seats);

      // Reservation ok, checkout the cart
      yield cart.checkout();

      // Create a cart
      var cart = new Cart(collections, 2)
      yield cart.create();
      test.ok(cart != null);

      // Seats to reserve [y cord, x cord]
      var seats = [[1, 5], [1, 6], [1, 7]]

      try {
        // Reserve some seats at the movie
        yield cart.reserve(theater, session, seats);
        test.ok(false);
      } catch(err) {
      }

      // Our expected cart reservations
      yield validateCart(collections, test, cart, 'active', []);
      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Should correctly set up theater and session and book tickets but fail to apply to cart as it is gone'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Theater = require('../../lib/common/schemas/theater/theater')
      , Session = require('../../lib/common/schemas/theater/session')
      , Cart = require('../../lib/common/schemas/theater/cart')
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          theaters: db.collection('theaters')
        , sessions: db.collection('sessions')
        , carts: db.collection('carts')
        , receipts: db.collection('receipts')
      }

      // Cleanup
      yield setup(db);

      // Create a new Theater
      var theater = new Theater(collections, 1, 'The Royal', [
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ]);

      // Create a theater instance
      yield theater.create();
      test.ok(theater != null);

      // Add a session to the theater
      var session = yield theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10);
      test.ok(session != null);

      // Create a cart
      var cart = new Cart(collections, 1)
      yield cart.create();
      test.ok(cart != null);

      // Seats to reserve [y cord, x cord]
      var seats = [[1, 5], [1, 6], [1, 7]]
      // Reserve some seats at the movie
      yield cart.reserve(theater, session, seats);

      // Destroy the cart
      var r = yield collections['carts'].removeOne({_id: cart.id});
      test.equal(1, r.deletedCount);

      // Reservation ok, checkout the cart
      yield cart.checkout();

      var doc = yield collections['sessions'].findOne({_id: session.id});

      // Validate that no seats are reserved after cart destroyed
      for(var i = 0; i < doc.seats.length; i++) {
        for(var j = 0; j < doc.seats[i].length; j++) {
          test.equal(0, doc.seats[i][j]);
        }
      }

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}

exports['Should correctly find expired carts and remove any reservations in them'] = {
  metadata: { requires: { } },

  // The actual test we wish to run
  test: function(configuration, test) {
    var Theater = require('../../lib/common/schemas/theater/theater')
      , Session = require('../../lib/common/schemas/theater/session')
      , Cart = require('../../lib/common/schemas/theater/cart')
      , MongoClient = require('mongodb').MongoClient;

    co(function* () {
      // Connect to mongodb
      var db = yield MongoClient.connect(configuration.url());

      // All the collections used
      var collections = {
          theaters: db.collection('theaters')
        , sessions: db.collection('sessions')
        , carts: db.collection('carts')
        , receipts: db.collection('receipts')
      }

      // Cleanup
      yield setup(db);

      // Create a new Theater
      var theater = new Theater(collections, 1, 'The Royal', [
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ]);

      // Create a theater instance
      yield theater.create();
      test.ok(theater != null);

      // Add a session to the theater
      var session = yield theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10);
      test.ok(session != null);

      // Create a cart
      var cart = new Cart(collections, 1)
      yield cart.create();
      test.ok(cart != null);

      // Seats to reserve [y cord, x cord]
      var seats = [[1, 5], [1, 6], [1, 7]];

      // Reserve some seats at the movie
      yield cart.reserve(theater, session, seats);

      // Force expire the cart
      var r = yield collections['carts'].updateOne({_id: cart.id}, {$set: {state: Cart.EXPIRED}});
      test.equal(1, r.modifiedCount);

      // Release all the carts that are expired
      yield Cart.releaseExpired(collections);

      var doc = yield collections['sessions'].findOne({_id: session.id});

      // Validate that no seats are reserved after cart destroyed
      for(var i = 0; i < doc.seats.length; i++) {
        for(var j = 0; j < doc.seats[i].length; j++) {
          test.equal(0, doc.seats[i][j]);
        }
      }

      var c = yield collections['carts'].count({state:'expired'});
      test.equal(0, c);

      db.close();
      test.done();
    }).catch(function(err) {
      process.nextTick(function() {throw err});
    });
  }
}
