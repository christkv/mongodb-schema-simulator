var drop = function(db, callback) {
  db.collection('theaters').drop(function() {
    db.collection('sessions').drop(function() {
      db.collection('carts').drop(function() {
        db.collection('orders').drop(function() {
          callback();
        });
      });
    });
  });
}

exports['Should correctly set up theater and session and buy tickets for some row seats'] = {
  metadata: { requires: { } },
  
  // The actual test we wish to run
  test: function(configuration, test) {
    var Theater = require('../../schemas/theater/theater')
      , Session = require('../../schemas/theater/session')
      , Cart = require('../../schemas/theater/cart')
      , MongoClient = require('mongodb').MongoClient;

    // Connect to mongodb
    MongoClient.connect(configuration.url(), function(err, db) {
      test.equal(null, err);

      // Cleanup
      drop(db, function() {

        // Create a new Theater
        var theater = new Theater(db, 'The Royal', [
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
            var cart = new Cart(db)
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
                  validateSeats(session, seats, function(err) {
                    test.equal(null, err);

                    // validateCart
                    validateCart(cart
                      , seats
                      , seats.length * session.price
                      , session.seatsAvailable - seats.length, function(err) {
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