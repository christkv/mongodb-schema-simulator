var co = require('co');

// Definition of the fields to execute
module.exports = [{
  // Name of the schema
  name: 'metadata',
  
  // Set the collection name for the carts
  collections: {
    metadatas: 'metadatas'
  },

  // Parameters
  params: {
    numberOfObjects: 100
  },

  // Run against specific db
  db: 'metadata',

  // readPreference settings
  readPreferences: {
    metadata: {
        mode: 'secondaryPreferred'
      , tags: {}
    }
  },

  // writeConcern
  writeConcern: {
    metadata: { w: 1, wtimeout: 10000 }
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
      iterations: 100
    // Number of users starting the op at every tick
    , numberOfUsers: 350
  }
}];