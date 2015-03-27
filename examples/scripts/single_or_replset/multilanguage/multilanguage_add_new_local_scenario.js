// Definition of the fields to execute
module.exports = [{
  // Name of the schema
  name: 'multilanguage_add_new_local',
  
  // Set the collection name for the carts
  collections: {
      categories: 'categories'
    , products: 'products'
  },

  // Parameters
  params: {
      numberOfProducts: 2048
    , numberOfCategories: 128
  },

  // Run against specific db
  db: 'multilanguage',

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
      iterations: 25
    // Number of users starting the op at every tick
    , numberOfUsers: 250
  }
}];