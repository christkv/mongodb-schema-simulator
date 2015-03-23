// Definition of the fields to execute
module.exports = {
  // The schema's we plan to exercise
  schemas: [{
    // Schema we are executing
    schema: {
      // Name of the schema
      name: 'timeseries',

      // Set the collection name for the carts
      collections: {
        timeseries: 'timeseries'
      },

      // Parameters
      params: {
        // Preallocate time series buckets
        preAllocate: false
        // Resolution
        , resolution: 'minute'
        // Number of time series
        , numberOfTimeSeries: 1000
      }
    },

    // Run against specific db
    db: 'timeseries',

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
        , iterations: 1
        // Number of users starting the op at every tick
        , numberOfUsers: 5
        // How to execute the 20 users inside of the tick
        // slicetime/atonce
        , tickExecutionStrategy: 'slicetime'
      }
    }
  }],

  // Number of processes needed to execute
  processes: 2,
  // Connection url
  // url: 'mongodb://localhost:27017/timeseries'
  // url: 'mongodb://localhost:31000/timeseries'
  // url: 'mongodb://localhost:50000/timeseries'
  // url: 'mongodb://192.168.0.10:27017/timeseries?maxPoolSize=25'
  // url: 'mongodb://10.211.55.4:27017/timeseries?maxPoolSize=25'
  url: 'mongodb://192.168.0.18:27017/timeseries?maxPoolSize=25'
}
