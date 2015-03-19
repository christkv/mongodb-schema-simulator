var f = require('util').format
  , dnode = require('dnode')
  , os = require('os')
  , Services = require('./services');

var performSetups = function(self, scenario, scenarios, callback) {
  console.log(f("[AGENT-%s:%s] peforming per process setups", os.hostname(), self.argv.p));

  // Number of scenarios left
  var left = scenarios.length;
  var errors = [];

  // Execute the global schema setup
  var setupSchema = function(schema, callback) {
    console.log(f('[AGENT] execute local scenario setup for scenario %s %s', schema.schema.name, JSON.stringify(schema.schema.params)));
    // Fetch the scenario class
    var object = self.manager.find(schema.schema.name);
    // No scenario found return an error
    if(!object) return callback(new Error(f('could not find scenario instance for %s', schema.schema.name)));

    // Validate that all paramters are valid
    for(var name in schema.schema.params) {
      if(!object.params[name]) return callback(new Error(f('scenario %s does not support the parameter %s', schema.schema.name, name)));
    }

    // Create the object
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

var executePlan = function(self, remote, scenario, scenarioInstance, callback) {
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
    // Calculate the elapsed time between each user, ensure it's not 0
    var timeBetweenEachUser = Math.round(resolution/numberOfUsers);
    var iterationsLeft = iterations;
    var totalLeft = iterations * numberOfUsers;
    var totalOpsLeft = iterations * numberOfUsers;

    // Start the execution
    if(tickExecutionStrategy == 'slicetime') {
      // Execute the toal number of operations left to do
      var executeUser = function() {
        totalLeft = totalLeft - 1;
        // Execute the user
        object.execute(function(err) {
          if(err) errors.push(err);
          totalOpsLeft = totalOpsLeft - 1;

          // Signal monitor that we have finished a piece of work
          remote.tick(function() {
            // Are we done ?
            if(totalOpsLeft == 0) {
              callback(errors.length > 0 ? errors : null);
            }
          });
        });

        if(totalLeft == 0) return;
        setTimeout(executeUser, timeBetweenEachUser);
      }

      // Start executing
      setTimeout(executeUser, timeBetweenEachUser);
    } else if(tickExecutionStrategy == 'custom') {
      // We have a custom execution plan in the scenario
      // useful for a case like listening to topics
      object.custom(remote, totalOpsLeft, callback);
    }
  });
}

var execute = function(self, scenario, scenarios, callback) {
  console.log(f("[AGENT-%s:%s] starting execution of plan against scenarios", os.hostname(), self.argv.p));

  // Number of scenarios left to execute
  var left = scenarios.length;
  var errors = [];

  // Execute the plans
  for(var i = 0; i < scenarios.length; i++) {
    executePlan(self, self.monitor, scenario, scenarios[i], function(err) {
      if(err) errors.push(err);
      left = left - 1;

      if(left == 0) {
        callback(errors.length > 0 ? errors : null, self.services.logEntries);
      }
    });
  }
}

var callerror = function(self, err) {
  self.monitor.error(err, function() {});
}

var calldone = function(self, scenario, scenarios, results) {
  self.monitor.done({
      host: os.hostname()
    , port: self.argv.p
    , schemas: scenario
    , logEntries: results
  }, function() {});
}

/*
 * Represents a child process running
 */
var Process = function(manager, argv) {
  this.manager = manager;
  this.argv = argv;
  this.state = 'init';
  this.debug = this.argv.debug;
}

Process.prototype.setMonitor = function(monitor) {
  this.monitor = monitor;

  // Contains all the services we can use from
  // our scenarios
  this.services = new Services(this.argv, this.manager, monitor);
}

Process.prototype.execute = function(scenario, options, callback) {
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
      console.log(f('[AGENT-%s:%s] located scenario %s', os.hostname(), this.argv.p, scenario.name));
      scenarios.push({
          schema: schema
        , scenario: object
      });
    }
  };

  console.log(f('[AGENT-%s:%s] starting process setup of scenarios', os.hostname(), self.argv.p));
  // Perform the needed setup of the schemas
  performSetups(self, scenario, scenarios, function(err) {
    if(err) return callerror(self, new Error('failed to execute process setups for scenarios'));
    console.log(f('[AGENT-%s:%s] starting execution of scenarios', os.hostname(), self.argv.p));

    // Execute a scenario
    var executeScenario = function(_self, _scenario, _scenarios, _callback) {
      execute(_self, _scenario, _scenarios, function(err, results) {
        if(err) callerror(_self, new Error('failed to execute scenarios'));
        console.log(f('[AGENT-%s:%s] finished execution of scenarios', os.hostname(), _self.argv.p));
        calldone(_self, _scenario, _scenarios, results);
        console.log(f('[AGENT-%s:%s] notified monitor that agent finished', os.hostname(), _self.argv.p));
        callback();
      });
    }

    // Execute the scenario
    executeScenario(self, scenario ,scenarios, callback);
  });
}

Process.prototype.isRunning = function() {
  return this.state == 'running';
}

module.exports = Process;
