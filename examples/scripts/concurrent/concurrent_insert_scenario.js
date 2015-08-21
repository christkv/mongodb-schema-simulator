var co = require('co');

// Clone the template
var clone = function(o) {
  var object = {};
  for(var name in o) object[name] = o[name];
  return object;
}

// Template object
var template = {
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
}

// Scenarios
var scenario1 = clone(template);
scenario1.collections.insert = 'insert_1';

var scenario2 = clone(template);
scenario2.collections.insert = 'insert_2';

var scenario3 = clone(template);
scenario3.collections.insert = 'insert_3';

var scenario4 = clone(template);
scenario4.collections.insert = 'insert_4';

var scenario5 = clone(template);
scenario5.collections.insert = 'insert_5';

var scenario6 = clone(template);
scenario6.collections.insert = 'insert_6';

// Definition of the fields to execute
module.exports = [scenario1, scenario2, scenario3, scenario4, scenario5, scenario6];