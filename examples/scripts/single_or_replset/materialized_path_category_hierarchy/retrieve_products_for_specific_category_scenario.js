// Definition of the fields to execute
module.exports = [{
  // Name of the schema
  name: 'retrieve_products_by_category',
  
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
    // Number of ticks/iterations we are running
      iterations: 100
    // Number of users starting the op at every tick
    , numberOfUsers: 500
  }
}];