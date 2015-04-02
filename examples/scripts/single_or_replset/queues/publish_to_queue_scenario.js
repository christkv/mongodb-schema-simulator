// Definition of the fields to execute
module.exports = [{
  // Name of the schema
  name: 'publish_to_queues',
  
  // Set the collection name for the carts
  collections: {
    queues: 'queues'
  },

  // Parameters
  params: {
    // Range of priorities 
      priorityRange: 10
    // Default work object
    , workObject: {
    }
  },

  // writeConcern
  writeConcern: {
    queues: { w: 1, wtimeout: 10000 }
  },

  // Run against specific db
  db: 'queue',

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