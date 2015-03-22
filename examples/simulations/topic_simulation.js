//
// Publish to topics
var publishToTopicsScenario = {
  // Schema we are executing
  schema: {
    // Name of the schema
    name: 'publish_to_topics',

    // Set the collection name for the carts
    collections: {
      topics: 'topics'
    },

    // Parameters
    params: {
      // Size of capped collection
      sizeInBytes: 1000000000,
      // Default work object
      workObject: {
        "user_email": "{{chance.email()}}",
        "job": {
          "company": "{{chance.word()}}",
          "phone": "{{chance.phone()}}",
          "duties": "{[chance.sentence()}}"
        }
      }
    }
  },

  // Run against specific db
  db: 'topics',

  // Setup function (run before the scenario is executed)
  // used to allow doing stuff like setting up the sharded collection
  // etc.
  setup: function(db, callback) {
    db.dropDatabase(callback);
  },

  //
  // Execution plan is run using all the process.openStdin();
  execution: {
    //
    // Distribution of interactions starting (per process)
    distribution: {
      // Any specific distribution used
      type: 'linear', // The resolution of the incoming interactions

      resolution: 1000, // Number of ticks/iterations we are running

      iterations: 25, // Number of users starting the op at every tick

      numberOfUsers: 500, // How to execute the 20 users inside of the tick
      // slicetime/atonce

      tickExecutionStrategy: 'slicetime'
    }
  }
}

//
// Read from topics
var listenToTopicsScenario = {
  // Schema we are executing
  schema: {
    // Name of the schema
    name: 'fetch_from_topics',

    // Set the collection name for the carts
    collections: {
      topics: 'topics'
    },

    // Parameters
    params: {
      // Size of capped collection
      sizeInBytes: 1000000000
    }
  },

  // Run against specific db
  db: 'topics',

  // Setup function (run before the scenario is executed)
  // used to allow doing stuff like setting up the sharded collection
  // etc.
  setup: function(db, callback) {
    db.dropDatabase(callback);
  },

  //
  // Execution plan is run using all the process.openStdin();
  execution: {
    //
    // Distribution of interactions starting (per process)
    distribution: {
      // Any specific distribution used
      type: 'linear',
      // The resolution of the incoming interactions
      resolution: 1000,
      // Number of ticks/iterations we are running
      iterations: 25,
      // Number of users starting the op at every tick

      numberOfUsers: 10,
      
      // How to execute the users inside of the tick
      // slicetime/custom
      tickExecutionStrategy: 'custom',
      // Initial delay before executing
      initialDelay: 1000
    }
  }
}

// Definition of the fields to execute
module.exports = {
  // The schema's we plan to exercise
  schemas: [publishToTopicsScenario, listenToTopicsScenario],
  // Number of processes needed to execute
  processes: 2,
  // Connection url
  // url: 'mongodb://192.168.0.10:27017/topics?maxPoolSize=50'
  // url: 'mongodb://localhost:27017/topics?maxPoolSize=50'
  url: 'mongodb://192.168.0.10:27017/topics?maxPoolSize=50'
}
