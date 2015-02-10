// Definition of the fields to execute
module.exports = {
  // The schema's we plan to exercise
  schemas: [{
    // Schema we are executing
    schema: {
      // Name of the schema
      name: 'cart_no_reservation_successful',
      
      // Set the collection name for the carts
      collections: {
          carts: 'carts'
        , products: 'products'
        , inventories: 'inventories'
        , order: 'orders'
      },

      // Parameters
      params: {
          numberOfItems: 5
        , numberOfProducts: 1000
        , sizeOfProductsInBytes: 1024
      }
    },

    // Run against specific db
    db: 'shop',

    // Setup function (run before the scenario is executed)
    // used to allow doing stuff like setting up the sharded collection
    // etc.
    setup: function(db, callback) {
      // Drop the database
      db.dropDatabase(function(err, r) {
        if(err) return callback(err);

        // Enable the sharding of the database
        db.admin().command({enableSharding:'shop'}, function(err, r) {
          if(err) return callback(err);

          // Shard the collections we want
          db.admin().command({shardCollection: 'shop.carts', key: {_id:'hashed'}}, function(err, r) {
            if(err) return callback(err);
            callback();
          });
        });
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
        , iterations: 100
        // Number of users starting the op at every tick
        , numberOfUsers: 500
        // How to execute the 20 users inside of the tick
        // slicetime/atonce
        , tickExecutionStrategy: 'slicetime'
      }
    }
  }],

  // Number of processes needed to execute
  processes: 2,
  // Connection url
  url: 'mongodb://localhost:50000/shop'
}