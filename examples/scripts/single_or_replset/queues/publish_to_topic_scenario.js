// Definition of the fields to execute
module.exports = [{
  // Name of the schema
  name: 'publish_to_topics',
  
  // Set the collection name for the carts
  collections: {
    topics: 'topics'
  },

  // Parameters
  params: {
    // Size of capped collection
      sizeInBytes: 100000000
    // Default work object
    , workObject: {
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
      iterations: 100
    // Number of users starting the op at every tick
    , numberOfUsers: 500
  }
}];