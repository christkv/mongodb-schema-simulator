var co = require('co');

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
    co(function*() {
      // Drop the database
      yield db.dropDatabase();

      setTimeout(function() {
        // Enable the sharding of the database
        yield db.admin().command({enableSharding:'timeseries'});
        // Shard the collections we want
        yield db.admin().command({shardCollection: 'timeseries.timeseries', key: {tag:1, timestamp:1}});
        resolve();
      }, 1000);
    }).catch(function(err) {
      console.log(err.stack);
      reject(err);
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