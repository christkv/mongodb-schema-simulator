// Definition of the fields to execute
module.exports = {
  // The schema's we plan to exercise
  schemas: [{
    // Schema we are executing
    schema: {
      // Name of the schema
      name: 'retrieve_products_by_category_subtree',
      
      // Set the collection name for the carts
      collections: {
          categories: 'categories'
        , products: 'products'
      },

      // Parameters
      params: {
          numberOfProducts: (2 * 4096 * 2)
        // Five categories at the top (level 0)
        // Five categories for each category at level 0
        // Five categories for each category at level 1
        , treeStructure: [{
          level: 0, width: 5
        }, {
          level: 1, width: 5
        }, {
          level: 2, width: 5
        }, {
          level: 3, width: 5
        }, {
          level: 4, width: 5
        }]
      }
    },

    // Run against specific db
    db: 'browse',

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
  url: 'mongodb://localhost:27017/browse?maxPoolSize=100'
}