var co = require('co');

//
// Publish to topics
var publishToQueueScenario = {
  // Name of the schema
  name: 'publish_to_queues',

  // Set the collection name for the carts
  collections: {
    queues: 'queues'
  },

  // Parameters
  params: {
    // Size of capped collection
    priorityRange: 10
    // Default work object
    , workObject: {
    }
  },

  // Run against specific db
  db: 'queues',

  // writeConcern
  writeConcern: {
    queues: { w: 1, wtimeout: 10000 }
  },

  // Setup function (run before the scenario is executed)
  // used to allow doing stuff like setting up the sharded collection
  // etc.
  setup: function(db) {
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
    , numberOfUsers: 75
  }
}

//
// Read from topics
var listenToQueueScenario = {
  // Name of the schema
  name: 'fetch_from_queue_by_fifo',

  // Set the collection name for the carts
  collections: {
    queues: 'queues'
  },

  // Parameters
  params: {
    // Priority range
    priorityRange: 10
  },

  // Run against specific db
  db: 'queues',

  // Setup function (run before the scenario is executed)
  // used to allow doing stuff like setting up the sharded collection
  // etc.
  setup: function(db) {
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
    , numberOfUsers: 35
  }
}

// Definition of the fields to execute
module.exports = [publishToQueueScenario, listenToQueueScenario];
