var co = require('co');

// Definition of the fields to execute
module.exports = [{
  // Name of the schema
  name: 'fetch_from_topics',
  
  // Set the collection name for the carts
  collections: {
    topics: 'topics'
  },

  // Parameters
  params: {
    // Size of capped collection
    sizeInBytes: 100000
  },

  // Run against specific db
  db: 'topics',

  // writeConcern
  writeConcern: {
    queues: { w: 1, wtimeout: 10000 }
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
      iterations: 10
    // Number of users starting the op at every tick
    , numberOfUsers: 500
    // How to execute the 20 users inside of the tick
    // slicetime/atonce
    , tickExecutionStrategy: 'custom'
    // Initial delay before executing
    , initialDelay: 1000
  }
}];