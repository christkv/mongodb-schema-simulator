var co = require('co');

// Definition of the fields to execute
module.exports = [{
  // Name of the schema
  name: 'theater_reservation_successful',
  
  // Set the collection name for the carts
  collections: {
      carts: 'carts'
    , theaters: 'theaters'
    , sessions: 'sessions'
    , receipts: 'receipts'
  },

  // Parameters
  params: {
    // Number of theaters
      numberOfTheaters: 10
    // Number of theater rows
    , rows: 30
    // Number of theater seats in a row
    , seats: 30
    // Number of sessions
    , numberOfSessions: 10
    // Number of tickets in each cart
    , numberOfTickets: 5
  },

  // Run against specific db
  db: 'theater',

  // writeConcern
  writeConcern: {
    carts: { w: 'majority', wtimeout: 10000 }
  },

  // Setup function (run before the scenario is executed)
  // used to allow doing stuff like setting up the sharded collection
  // etc.
  setup: function(db, callback) {
    return new Promise(function(resolve, reject) {
      co(function*() {
        // Drop the database
        yield db.dropDatabase();
        resolve();
      }).catch(reject);
    });
  },

  //
  // Execution plan is run using all the process.openStdin();
  execution: {
    // Number of ticks/iterations we are running
      iterations: 25
    // Number of users starting the op at every tick
    , numberOfUsers: 50
  }
}];