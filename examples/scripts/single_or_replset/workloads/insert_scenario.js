var co = require('co');

// Definition of the fields to execute
module.exports = [{
  // Name of the schema
  name: 'insert',

  // Set the collection name for the carts
  collections: {
    insert: 'insert'
  },

  // Parameters
  params: {
    workObject: {
      "user_email": "{{chance.email()}}",
      "job": {
        "company": "{{chance.word()}}",
        "phone": "{{chance.phone()}}",
        "duties": "{[chance.sentence()}}"
      }
    },
    batchSize: 1
  },

  // Run against specific db
  db: 'insert',

  // writeConcern
  writeConcern: {
    insert: { w: 'majority', wtimeout: 10000 }
  },

  // Setup function (run before the scenario is executed)
  // used to allow doing stuff like setting up the sharded collection
  // etc.
  setup: function(db, callback) {
    return new Promise(function(resolve, reject) {
      co(function*() {
        // Drop the database
        yield db.dropDatabase();
        resolve();
      }).catch(reject);
    });
  },

  //
  // Execution plan is run using all the process.openStdin();
  execution: {
    // Number of ticks/iterations we are running
      iterations: 25
    // Number of users starting the op at every tick
    , numberOfUsers: 2000
  }
}];