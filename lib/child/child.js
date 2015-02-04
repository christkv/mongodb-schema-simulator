var f = require('util').format
  , dnode = require('dnode')
  , os = require('os');

var Services = function(argv, manager) {
  this.argv = argv;
  this.manager = manager;
  // All the entries
  this.logEntries = {};
  // Current second timestamp
  this.currentSecondTimestamp = null;
  // Current minute timestamp
  this.currentMinuteTimestamp = null;
}

Services.prototype.log = function(resolution, tag, object) {
  if(this.logEntries[tag] == null) this.logEntries[tag] = {};
  
  // Set a new second timestamp
  if(this.currentSecondTimestamp == null) {
    this.currentSecondTimestamp = new Date();
    this.currentSecondTimestamp.setMilliseconds(0);
  } else {
    var timestamp = new Date();
    timestamp.setMilliseconds(0);
    // If we have a new second adjust the current timestamp
    if(timestamp.getTime() > this.currentSecondTimestamp.getTime()) {
      this.currentSecondTimestamp = timestamp;
    }
  }

  // Add the current log statement
  if(this.logEntries[tag][this.currentSecondTimestamp.getTime()] == null) {
    this.logEntries[tag][this.currentSecondTimestamp.getTime()] = [];
  }

  // Push the logged item
  this.logEntries[tag][this.currentSecondTimestamp.getTime()].push(object);
}

var Child = function(manager, argv) {
  this.manager = manager;
  this.argv = argv;
  this.state = 'init';
  this.debug = this.argv.debug;

  // Contains all the services we can use from
  // our scenarios
  this.services = new Services(argv, manager);
}

var performSetups = function(self, scenario, scenarios, callback) {
  console.log(f("[CHILD-%s:%s] peforming per process setups", os.hostname(), self.argv.p));

  // Number of scenarios left
  var left = scenarios.length;
  var errors = [];

  // Execute the global schema setup
  var setupSchema = function(schema, callback) {
    console.log(f('[CHILD] execute global scenarios setup for scenario %s %s', schema.schema.name, JSON.stringify(schema.schema.params)));
    // Fetch the scenario class
    var object = self.manager.find(schema.schema.name);
    // No scenario found return an error
    if(!object) return callback(new Error(f('could not find scenario instance for %s', schema.schema.name)));

    // Validate that all paramters are valid
    for(var name in schema.schema.params) {
      if(!object.params[name]) return callback(new Error(f('scenario %s does not support the parameter %s', schema.schema.name, name)));
    }

    var object = object.create(self.services, scenario, schema);
    // The actual object
    schema.schema.object = object;
    // Initiate an instance and call it
    object.setup(callback);
  }

  // Iterate over all the schemas
  for(var i = 0; i < scenarios.length; i++) {
    setupSchema(scenarios[i].schema, function(err) {
      left = left - 1;
      if(err) errors.push(err);

      if(left == 0) {
        callback(errors.length > 0 ? errors : null);
      }
    });
  }
}

// var executeWorker = function(self, scenario, schema, iterationsPrConcurrent, callback) {
//   var left = iterationsPrConcurrent;
//   // Get an instance
//   // var object = self.manager.find(schema.schema.name).create(self.services, scenario, schema);
//   var object = schema.schema.object;
//   var errors = [];

//   // Execute across all the iterations
//   for(var i = 0; i < iterationsPrConcurrent; i++) {
//     object.execute(function(err) {
//       if(err) errors.push(err);
//       left = left - 1;

//       if(left == 0) {
//         callback(errors.length > 0 ? errors : null);
//       }
//     });
//   }
// }

var executePlan = function(self, d, remote, scenario, scenarioInstance, callback) {
  // Get the schema object
  var schema = scenarioInstance.schema;

  // The actual schema execution function
  var object = schema.schema.object;
  
  // Get the plan we are executing against the schema
  var plan = schema.execution;

  // Get the distribution
  var distribution = plan.distribution;
  // Actual fields
  var type = distribution.type;
  // The timing resolution to start another run of iteractions in milliseconds
  var resolution = distribution.resolution;
  // Number of iterations to run for load test
  var iterations = distribution.iterations;  
  // Number of users in each iteration
  var numberOfUsers = distribution.numberOfUsers;
  // The way we execute the users in the allocated time (when to start)
  var tickExecutionStrategy = distribution.tickExecutionStrategy;
  var errors = [];

  // Only support for the linear type
  if(type != 'linear') return callback([new Error('only linear distribution supported')]);

  // Return the number of items we are executing in total
  remote.setup({totalExecutions: iterations * numberOfUsers}, function() {
    // Start the execution
    if(tickExecutionStrategy == 'slicetime') {
      // Calculate the elapsed time between each user, ensure it's not 0
      var timeBetweenEachUser = Math.round(resolution/numberOfUsers);
      var iterationsLeft = iterations;
      var totalLeft = iterations * numberOfUsers;
      var totalOpsLeft = iterations * numberOfUsers;

      // Execute the toal number of operations left to do
      var executeUser = function() {
        totalLeft = totalLeft - 1;
        // Execute the user
        object.execute(function(err) {
          if(err) errors.push(err);
          totalOpsLeft = totalOpsLeft - 1;
          
          // Signal monitor that we have finished a piece of work
          remote.tick(function() {
            if(totalOpsLeft == 0) d.end();
          });

          // Are we done ?        
          if(totalOpsLeft == 0) {
            callback(errors.length > 0 ? errors : null);
          }
        });

        if(totalLeft == 0) return;
        setTimeout(executeUser, timeBetweenEachUser);
      }

      // Start executing
      setTimeout(executeUser, timeBetweenEachUser);
    } else {

    }
  });
}
 
var execute = function(self, scenario, scenarios, callback) {
  console.log(f("[CHILD-%s:%s] starting execution of plan against scenarios", os.hostname(), self.argv.p));

  // Number of scenarios left to execute
  var left = scenarios.length;
  var errors = [];

  // Attempt to connect to the monitor
  var d = dnode.connect(self.argv.m, self.argv.s);
  d.on('remote', function(remote) {
    // Execute the plans
    for(var i = 0; i < scenarios.length; i++) {
      executePlan(self, d, remote, scenario, scenarios[i], function(err) {
        if(err) errors.push(err);
        left = left - 1;

        if(left == 0) {
          callback(errors.length > 0 ? errors : null, self.services.logEntries);
        }
      });
    }
  });
}

var callerror = function(self, err) {  
  // Attempt to connect to the monitor
  var d = dnode.connect(self.argv.m, self.argv.s);
  d.on('remote', function(remote) {
    remote.error(err, function() {
      d.end();
    });
  })
}

var calldone = function(self, results) {  
  // Attempt to connect to the monitor
  var d = dnode.connect(self.argv.m, self.argv.s);
  d.on('remote', function(remote) {
    remote.done({
        host: os.hostname()
      , port: self.argv.p
      , logEntries: results
    }, function() {
      d.end();
    });
  });
}

Child.prototype.execute = function(scenario, options) {
  var self = this;
  // Set child running
  this.state = 'running';

  // Locate all the scenarios we need and execute the setup plan
  var scenarios = [];

  // Get all the schemas
  for (var i = scenario.schemas.length - 1; i >= 0; i--) {
    var schema = scenario.schemas[i];
    // Attempt to locate the scenario
    var object = this.manager.find(schema.schema.name);
    // Add to the list of scenarios if it's available
    if(scenario != null) {
      console.log(f('[CHILD-%s:%s] located scenario %s', os.hostname(), this.argv.p, scenario.name));
      scenarios.push({
          schema: schema
        , scenario: object
      });
    }
  };

  console.log(f('[CHILD-%s:%s] starting process setup of scenarios', os.hostname(), self.argv.p));
  // Perform the needed setup of the schemas
  performSetups(self, scenario, scenarios, function(err) {
    if(err) return callerror(self, new Error('failed to execute process setups for scenarios'));
    console.log(f('[CHILD-%s:%s] starting execution of scenarios', os.hostname(), self.argv.p));
    // Execute the scenarios
    execute(self, scenario, scenarios, function(err, results) {
      if(err) return callerror(self, new Error('failed to execute scenarios'));
      console.log(f('[CHILD-%s:%s] finished execution of scenarios', os.hostname(), self.argv.p));
      calldone(self, results);
    });
  });
}

Child.prototype.isRunning = function() {
  return this.state == 'running';
}

module.exports = Child;