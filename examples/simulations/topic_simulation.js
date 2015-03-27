//
// Publish to topics
var publishToTopicsScenario = {
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
    // Number of ticks/iterations we are running
    iterations: 25, 
    // Number of users starting the op at every tick
    numberOfUsers: 250
  }
}

//
// Read from topics
var listenToTopicsScenario = {
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
    // Number of ticks/iterations we are running
    iterations: 25,
    // Number of users starting the op at every tick
    numberOfUsers: 10,
    // Initial delay before executing
    initialDelay: 1000
  }
}

// Definition of the fields to execute
module.exports = [publishToTopicsScenario, listenToTopicsScenario];