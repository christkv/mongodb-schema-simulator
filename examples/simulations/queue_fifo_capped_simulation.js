var co = require('co');

//
// Publish to topics
var publishToQueueScenario = {
  // Name of the schema
  name: 'publish_to_queues',
  
  // Set the collection name for the carts
  collections: {
    queues: 'queues_capped'
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
  setup: function(db, callback) {
    return new Promise(function(resolve, reject) {
      co(function*() {
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

        // Drop the database
        yield db.dropDatabase();
        // Create a capped collection
        yield db.createCollection('queues_capped', {capped:true, size: 100000000});
        resolve();
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    });
  },

  //
  // Execution plan is run using all the process.openStdin();
  execution: {
    // Number of ticks/iterations we are running
      iterations: 25
    // Number of users starting the op at every tick
    , numberOfUsers: 250
  }
}

//
// Read from topics
var listenToQueueScenario = {
  // Name of the schema
  name: 'fetch_from_queue_by_fifo',
  
  // Set the collection name for the carts
  collections: {
    queues: 'queues_capped'
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
  setup: function(db, callback) {
    return new Promise(function(resolve, reject) {
      co(function*() {
        // Drop the database
        yield db.dropDatabase();
        resolve();
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
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

// Definition of the fields to execute
module.exports = [publishToQueueScenario, listenToQueueScenario];