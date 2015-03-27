var microtime = require('microtime');
// Contains all the scenarios
var scenarios = [];

// Export the scenarios
module.exports = { scenarios: scenarios };

/*
 * Simple fixed items in cart simulation
 */
scenarios.push({
    name: 'theater_reservation_successful'
  , title: 'fixed number of theater tickets reserved'
  , description: 'fixed number of theater tickets reserved'
  , params: {
    // Number of items in the cart
    numberOfTheaters: {
        name: 'number of theaters'
      , type: 'number'
      , default: 100
    }
    // Number rows in each theater
    , rows: {
        name: 'number of rows in a theater'
      , type: 'number'
      , default: 100
    }
    // Number seats in each theater
    , seats: {
        name: 'number of seats in a theater'
      , type: 'number'
      , default: 30
    }
    // Number of items in the cart
    , numberOfSessions: {
        name: 'number of sessions in a theater'
      , type: 'number'
      , default: 100
    }
    // Size of catalog
    , numberOfTickets: {
        name: 'number of tickets in each cart'
      , type: 'number'
      , default: 5
    }
  }
  , create: function(services, scenario, schema) {
    var MongoClient = require('mongodb').MongoClient;

    // Default collection names
    var collections = {
        carts: 'carts'
      , products: 'products'
      , inventories: 'inventories'
      , order: 'orders'
    }

    // Get all the schemas
    var Cart = require('../schemas/theater/cart')
      , Receipt = require('../schemas/theater/receipt')
      , Session = require('../schemas/theater/session')
      , Theater = require('../schemas/theater/theater')
      , ObjectId = require('mongodb').ObjectId;

    // Db instance
    var db = null;

    // Contains the cart scenario
    var Scenario = function() {}

    // Set up all indexes
    var createIndexes = function(db, collectionNames, callback) {
      // Collections
      var collections = {
          carts: db.collection(collectionNames.carts || 'carts')
        , receipts: db.collection(collectionNames.receipts || 'receipts')
        , sessions: db.collection(collectionNames.sessions || 'sessions')
        , theaters: db.collection(collectionNames.theaters || 'theaters')
      }

      Cart.createOptimalIndexes(collections, function(err) {
        if(err) return callback(err);

        Receipt.createOptimalIndexes(collections, function(err) {
          if(err) return callback(err);

          Session.createOptimalIndexes(collections, function(err) {
            if(err) return callback(err);

            Theater.createOptimalIndexes(collections, function(err) {
              if(err) return callback(err);
              callback();
            });
          });
        });
      });
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalSetup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs only once when starting up on the monitor
     */
    Scenario.prototype.globalTeardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.setup = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};

      // Setup some default state variables
      this.currentTheater = 0;
      this.currentSession = 0;
      this.currentRow = 0;
      this.currentSeat = 0;

      // Connect to the database
      MongoClient.connect(schema.url, function(err, instance) {
        if(err) return callback(err);
        db = schema.db ? instance.db(schema.db) : instance;

        // Unpack the parameters
        var numberOfTheaters = schema.params.numberOfTheaters;
        var rows = schema.params.rows;
        var seats = schema.params.seats;
        var numberOfSessions = schema.params.numberOfSessions;

        // CreateIndex for all items
        createIndexes(db, collections, function(err) {
          if(err) return callback(err);

          // Number of tickets we are buying
          var numberOfTickets = schema.params.numberOfTickets;
          var collectionNames= schema.collections ? schema.collections : collections;

          // Collections
          var collections = {
              carts: db.collection(collectionNames.carts || 'carts')
            , receipts: db.collection(collectionNames.receipts || 'receipts')
            , sessions: db.collection(collectionNames.sessions || 'sessions')
            , theaters: db.collection(collectionNames.theaters || 'theaters')
          }

          // Create all the theaters and sessions
          var createTheatersAndSessions = function(collections, theater, numberOfSessions, rows, seats, callback) {
            // Create the plan
            var plan = new Array(rows);
            for(var i = 0; i < rows; i++) {
              plan[i] = new Array(seats);
              for(var j = 0; j < seats; j++) plan[i][j] = 0;
            }

            var theaterId = f('%s.%s', process.pid, theater);
            // Create a theater instance
            var theater = new Theater(collections, theaterId, theaterId, plan);
            theater.create(function() {

              // Create sessions
              var left = numberOfSessions;

              // Create sessions
              for(var i = 0; i < numberOfSessions; i++) {
                // Create the session id
                var sessionId = f('%s.%s', theaterId, i);
                // Add a session
                theater.addSession(i, i, new Date(), new Date(), 10, {id: sessionId}, function() {
                  left = left - 1;

                  if(left == 0) callback();
                });
              }
            });
          }

          // Number of theaters to create
          var left = numberOfTheaters;

          // Create all the theaters
          for(var i = 0; i < numberOfTheaters; i++) {
            createTheatersAndSessions(collections, i, numberOfSessions, rows, seats, function() {
              left = left - 1;

              if(left == 0) {
                callback();
              }
            });
          }
        });
      });
    }

    /*
     * Runs for each executing process
     */
    Scenario.prototype.teardown = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      if(db) db.close();
      callback();
    }

    /*
     * The actual scenario running
     */
    Scenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      var self = this;
      // Unpack the parameters
      var numberOfTheaters = schema.params.numberOfTheaters;
      var rows = schema.params.rows;
      var seats = schema.params.seats;
      var numberOfSessions = schema.params.numberOfSessions;

      // Number of tickets we are buying
      var numberOfTickets = schema.params.numberOfTickets;
      var collectionNames = schema.collections ? schema.collections : collections;

      // Collections
      var collections = {
          carts: db.collection(collectionNames.carts || 'carts')
        , receipts: db.collection(collectionNames.receipts || 'receipts')
        , sessions: db.collection(collectionNames.sessions || 'sessions')
        , theaters: db.collection(collectionNames.theaters || 'theaters')
      }

      // Current theater
      var currentTheater = this.currentTheater + 1;
      var currentSession = this.currentSession;
      var currentSeat = this.currentSeat;
      var currentRow = this.currentRow;

      // Check if we have overflowed the number of theaters
      if(currentTheater > numberOfTheaters - 1) {
        currentTheater = 0;
        currentSession = (currentSession + 1) % numberOfSessions;

        // Update the seats
        currentSeat = currentSeat + numberOfTickets;

        // We have passed the number of available seats
        if(currentSeat >= seats) {
          currentSeat = 0;

          // Update the current Row
          currentRow = currentRow + 1;
        }
      }

      // Update the theater
      this.currentTheater = currentTheater
      this.currentSession = currentSession;
      this.currentSeat = currentSeat;
      this.currentRow = currentRow;

      // Theater id
      var theaterId = f('%s.%s', process.pid, currentTheater);

      // Cart start time
      var startTime = microtime.now();
      // Create a cart
      var cart = new Cart(collections, Math.round(Number.MAX_VALUE * Math.random()));
      cart.create(function(err, cart) {
        if(err) {
          console.dir(err)
          return callback();
        }
        var seats = [];

        for(var i = 0; i < numberOfTickets; i++) {
          seats.push([self.currentRow, self.currentSeat + i]);
        }

        // Create a theater instance
        var theater = new Theater(collections, theaterId, theaterId);
        // Create the session id
        var sessionId = f('%s.%s', theaterId, currentSession);
        // Get a session
        var session = new Session(collections, sessionId, theaterId);
        // Peform the reservation
        cart.reserve(theater, session, seats, function(err, cart) {
          if(err) {
            return callback();
          }

          // Reservation ok, checkout the cart
          cart.checkout(function(err) {
            // Operation end time
            var endTime = microtime.now();

            // Log the time taken for the operation
            services.log('second', 'theater_reservation_successful', {
                start: startTime
              , end: endTime
              , time: endTime - startTime
            });

            callback();
          });
        });
      });
    }

    return new Scenario(services, scenario, schema);
  }
})
