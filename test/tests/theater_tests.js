"use strict";

var setup = function(db, callback) {
  var Session = require('../../lib/common/schemas/theater/session')
    , Cart = require('../../lib/common/schemas/theater/cart');

  // All the collections used
  var collections = {
      theaters: db.collection('theaters')
    , sessions: db.collection('sessions')
    , carts: db.collection('carts')
    , receipts: db.collection('receipts')
  }

  collections['theaters'].drop(function() {
    collections['sessions'].drop(function() {
      collections['carts'].drop(function() {
        collections['receipts'].drop(function() {
          Session.createOptimalIndexes(collections, function(err) {
            Cart.createOptimalIndexes(collections, function(err) {
              callback();
            });
          });
        });
      });
    });
  });
}

var validateSeats = function(collections, test, session, seats, seatsLeft, callback) {
  collections['sessions'].findOne({_id: session.id}, function(err, doc) {
    test.equal(null, err);
    test.ok(doc != null);
    test.equal(doc.seatsAvailable, seatsLeft);

    for(var i = 0; i < seats.length; i++) {
      var seat = seats[i];
      test.equal(doc.seats[seat[0]][seat[1]], 1);
    }

    test.equal(0, doc.reservations.length);
    callback();
  });
}

var validateCart = function(collections, test, cart, state, reservations, callback) {
  collections['carts'].findOne({_id: cart.id}, function(err, doc) {
    test.equal(null, err);
    test.ok(doc != null);
    test.equal(reservations.length, doc.reservations.length);
    test.equal(state, doc.state);

    // Validate all the reservations in the cart
    for(var i = 0; i < reservations.length; i++) {
      test.equal(doc.reservations[i].total, reservations[i].total);
      test.deepEqual(doc.reservations[i].seats, reservations[i].seats);
    }

    callback();
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

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          theaters: db.collection('theaters')
        , sessions: db.collection('sessions')
        , carts: db.collection('carts')
        , receipts: db.collection('receipts')
      }

      // Cleanup
      setup(db, function() {

        // Create a new Theater
        var theater = new Theater(collections, 1, 'The Royal', [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]);

        // Create a theater instance
        theater.create(function(err, theater) {
          test.equal(null, err);
          test.ok(theater != null);

          // Add a session to the theater
          theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10, function(err, session) {
            test.equal(null, err);
            test.ok(session != null);

            // Create a cart
            var cart = new Cart(collections, 1);
            cart.create(function(err, cart) {
              test.equal(null, err);
              test.ok(cart != null);

              // Seats to reserve [y cord, x cord]
              var seats = [[1, 5], [1, 6], [1, 7]]
              // Reserve some seats at the movie
              cart.reserve(theater, session, seats, function(err, cart) {
                test.equal(null, err);

                // Reservation ok, checkout the cart
                cart.checkout(function(err) {
                  test.equal(null, err);

                  // Validate seat reservations
                  validateSeats(collections, test
                    , session, seats, (session.seatsAvailable - seats.length), function(err) {
                    test.equal(null, err);

                    // Our expected cart reservations
                    var expectedReservations = [{
                          seats: seats
                        , total: seats.length * session.price
                      }
                    ];

                    // validateCart
                    validateCart(collections, test, cart, 'done', expectedReservations, function(err) {
                      test.equal(null, err);

                      db.close();
                      test.done();
                    });
                  });
                });
              })
            });
          });
        });
      });
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

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // All the collections used
      var collections = {
          theaters: db.collection('theaters')
        , sessions: db.collection('sessions')
        , carts: db.collection('carts')
        , receipts: db.collection('receipts')
      }

      // Cleanup
      setup(db, function() {

        // Create a new Theater
        var theater = new Theater(collections, 1, 'The Royal', [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]);

        // Create a theater instance
        theater.create(function(err, theater) {
          test.equal(null, err);
          test.ok(theater != null);

          // Add a session to the theater
          theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10, function(err, session) {
            test.equal(null, err);
            test.ok(session != null);

            // Create a cart
            var cart = new Cart(collections, 1)
            cart.create(function(err, cart) {
              test.equal(null, err);
              test.ok(cart != null);

              // Seats to reserve [y cord, x cord]
              var seats = [[1, 5], [1, 6], [1, 7]]
              // Reserve some seats at the movie
              cart.reserve(theater, session, seats, function(err, cart) {
                test.equal(null, err);

                // Reservation ok, checkout the cart
                cart.checkout(function(err) {
                  test.equal(null, err);

                  // Create a cart
                  var cart = new Cart(collections, 2)
                  cart.create(function(err, cart) {
                    test.equal(null, err);
                    test.ok(cart != null);

                    // Seats to reserve [y cord, x cord]
                    var seats = [[1, 5], [1, 6], [1, 7]]
                    // Reserve some seats at the movie
                    cart.reserve(theater, session, seats, function(err) {
                      test.ok(err != null);

                      // Our expected cart reservations
                      validateCart(collections, test, cart, 'active', [], function(err) {
                        test.equal(null, err);

                        db.close();
                        test.done();
                      });
                    });
                  });
                });
              })
            });
          });
        });
      });
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

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {

        // All the collections used
        var collections = {
            theaters: db.collection('theaters')
          , sessions: db.collection('sessions')
          , carts: db.collection('carts')
          , receipts: db.collection('receipts')
        }

        // Create a new Theater
        var theater = new Theater(collections, 1, 'The Royal', [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]);

        // Create a theater instance
        theater.create(function(err, theater) {
          test.equal(null, err);
          test.ok(theater != null);

          // Add a session to the theater
          theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10, function(err, session) {
            test.equal(null, err);
            test.ok(session != null);

            // Create a cart
            var cart = new Cart(collections, 1)
            cart.create(function(err, cart) {
              test.equal(null, err);
              test.ok(cart != null);

              // Seats to reserve [y cord, x cord]
              var seats = [[1, 5], [1, 6], [1, 7]]
              // Reserve some seats at the movie
              cart.reserve(theater, session, seats, function(err, cart) {
                test.equal(null, err);

                // Destroy the cart
                collections['carts'].removeOne({_id: cart.id}, function(err, r) {
                  test.equal(null, err);
                  test.equal(1, r.deletedCount);

                  // Reservation ok, checkout the cart
                  cart.checkout(function(err) {
                    test.ok(err != null);

                    collections['sessions'].findOne({_id: session.id}, function(err, doc) {
                      test.equal(null, err);

                      // Validate that no seats are reserved after cart destroyed
                      for(var i = 0; i < doc.seats.length; i++) {
                        for(var j = 0; j < doc.seats[i].length; j++) {
                          test.equal(0, doc.seats[i][j]);
                        }
                      }

                      db.close();
                      test.done();
                    });
                  });
                });
              })
            });
          });
        });
      });
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

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      setup(db, function() {

        // All the collections used
        var collections = {
            theaters: db.collection('theaters')
          , sessions: db.collection('sessions')
          , carts: db.collection('carts')
          , receipts: db.collection('receipts')
        }

        // Create a new Theater
        var theater = new Theater(collections, 1, 'The Royal', [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]);

        // Create a theater instance
        theater.create(function(err, theater) {
          test.equal(null, err);
          test.ok(theater != null);

          // Add a session to the theater
          theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10, function(err, session) {
            test.equal(null, err);
            test.ok(session != null);

            // Create a cart
            var cart = new Cart(collections, 1)
            cart.create(function(err, cart) {
              test.equal(null, err);
              test.ok(cart != null);

              // Seats to reserve [y cord, x cord]
              var seats = [[1, 5], [1, 6], [1, 7]]
              // Reserve some seats at the movie
              cart.reserve(theater, session, seats, function(err, cart) {
                test.equal(null, err);

                // Force expire the cart
                collections['carts'].updateOne({_id: cart.id}, {$set: {state: Cart.EXPIRED}}, function(err, r) {
                  test.equal(null, err);
                  test.equal(1, r.modifiedCount);

                  // Release all the carts that are expired
                  Cart.releaseExpired(collections, function(err) {
                    test.equal(null, err);

                    collections['sessions'].findOne({_id: session.id}, function(err, doc) {
                      test.equal(null, err);

                      // Validate that no seats are reserved after cart destroyed
                      for(var i = 0; i < doc.seats.length; i++) {
                        for(var j = 0; j < doc.seats[i].length; j++) {
                          test.equal(0, doc.seats[i][j]);
                        }
                      }

                      collections['carts'].count({state:'expired'}, function(err, c) {
                        test.equal(null, err);
                        test.equal(0, c);

                        db.close();
                        test.done();
                      });
                    });
                  });
                });
              })
            });
          });
        });
      });
    });
  }
}
