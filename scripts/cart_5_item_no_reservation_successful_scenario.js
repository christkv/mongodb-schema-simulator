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
  url: 'mongodb://localhost:31000/benchmark'
}