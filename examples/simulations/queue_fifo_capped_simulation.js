//
// Publish to topics
var publishToQueueScenario = {
  // Schema we are executing
  schema: {
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
    }
  },

  // Run against specific db
  db: 'queues',

  // Setup function (run before the scenario is executed)
  // used to allow doing stuff like setting up the sharded collection
  // etc.
  setup: function(db, callback) {
    // Drop the database
    db.dropDatabase(function(err, r) {
      // Create a capped collection
      db.createCollection('queues', {capped:true, size: 100000000}, callback);

      // return callback();
      // // return callback();
      // if(err) return callback(err);

      // setTimeout(function() {
      //   // Enable the sharding of the database
      //   db.admin().command({enableSharding:'queues'}, function(err, r) {
      //     if(err) return callback(err);

      //     // Shard the collections we want
      //     db.admin().command({shardCollection: 'queues.queue_0', key: {createdOn:'hashed'}}, function(err, r) {
      //       if(err) return callback(err);
      //       callback();
      //     });
      //   });
      // }, 1000);
    });
  },

  //
  // Execution plan is run using all the process.openStdin();
  execution: {
    //
    // Distribution of interactions starting (per process)
    distribution: {
      // Any specific distribution used
        type: 'linear'
      // The resolution of the incoming interactions
      , resolution: 1000
      // Number of ticks/iterations we are running
      , iterations: 25
      // Number of users starting the op at every tick
      , numberOfUsers: 500
      // How to execute the 20 users inside of the tick
      // slicetime/atonce
      , tickExecutionStrategy: 'slicetime'
    }
  }
}

//
// Read from topics
var listenToQueueScenario = {
  // Schema we are executing
  schema: {
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
    }
  },

  // Run against specific db
  db: 'queues',

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
        type: 'linear'
      // The resolution of the incoming interactions
      , resolution: 1000
      // Number of ticks/iterations we are running
      , iterations: 25
      // Number of users starting the op at every tick
      , numberOfUsers: 150
      // How to execute the 20 users inside of the tick
      // slicetime/atonce
      , tickExecutionStrategy: 'slicetime'
    }
  }
}

// Definition of the fields to execute
module.exports = {
  // The schema's we plan to exercise
  schemas: [publishToQueueScenario, listenToQueueScenario],
  // Number of processes needed to execute
  processes: 2,
  // Connection url
  // url: 'mongodb://192.168.0.10:27017/queues?maxPoolSize=50'
  // url: 'mongodb://localhost:27017/queues?maxPoolSize=50'
  url: 'mongodb://192.168.0.10:27017/queues?maxPoolSize=50'  
}