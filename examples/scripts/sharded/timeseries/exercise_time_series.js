// Definition of the fields to execute
module.exports = [{
  // Name of the schema
  name: 'timeseries',

  // Set the collection name for the carts
  collections: {
    timeseries: 'timeseries'
  },

  // Parameters
  params: {
    // Preallocate time series buckets
    preAllocate: true
    // Resolution
    , resolution: 'minute'
    // Number of time series
    , numberOfTimeSeries: 10000
  },

  // Run against specific db
  db: 'timeseries',

  // Setup function (run before the scenario is executed)
  // used to allow doing stuff like setting up the sharded collection
  // etc.
  setup: function(db, callback) {
    // Drop the database
    db.dropDatabase(function(err, r) {
      if(err) return callback(err);

      setTimeout(function() {
        // Enable the sharding of the database
        db.admin().command({enableSharding:'timeseries'}, function(err, r) {
          if(err) return callback(err);

          // Shard the collections we want
          db.admin().command({shardCollection: 'timeseries.timeseries', key: {tag:1, timestamp:1}}, function(err, r) {
            if(err) return callback(err);
            callback();
          });
        });
      }, 1000);
    });
  },

  //
  // Execution plan is run using all the process.openStdin();
  execution: {
    // Number of ticks/iterations we are running
      iterations: 25
    // Number of users starting the op at every tick
    , numberOfUsers: 500
  }
}];