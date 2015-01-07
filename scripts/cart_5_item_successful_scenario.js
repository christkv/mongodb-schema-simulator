// Definition of the fields to execute
module.exports = {
  // The schema's we plan to exercise
  schemas: [{
    // Schema we are executing
    schema: {
      // Name of the schema
      name: 'cart_reservation_successful',
      // Parameters
      params: {
          numberOfItems: 5
        , numberOfProducts: 1000
        , sizeOfProductsInBytes: 1024
      }
    },

    // Run against specific db
    db: 'shop',

    // Execution plan
    plan: {
      // Typeo
      type: 'iterations',
      // Number of iterations to execute
      iterations: 1000,
      // Distribution over time 
      distribution: 'none',
      // Concurrency
      maxConcurrency: 5
    }
  }],

  // Number of processes needed to execute
  processes: 2,
  // Connection url
  url: 'mongodb://localhost:27017/benchmark'
}