var f = require('util').format
  , dnode = require('dnode')
  , os = require('os');

var Child = function(manager, argv) {
  this.manager = manager;
  this.argv = argv;
  this.state = 'init';

  // Contains all the services we can use from
  // our scenarios
  this.services = {};
}

var performSetups = function(self, scenario, scenarios, callback) {
  console.log(f("[CHILD-%s:%s] peforming per process setups", os.hostname(), self.argv.p));

  // Number of scenarios left
  var left = scenarios.length;
  var errors = [];

  // Execute the global schema setup
  var setupSchema = function(schema, callback) {
    console.log(f('[MONITOR] execute global scenarios setup for scenario %s %s', schema.schema.name, JSON.stringify(schema.schema.params)));
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

var executeWorker = function(self, scenario, schema, iterationsPrConcurrent, callback) {
  var left = iterationsPrConcurrent;
  // Get an instance
  // var object = self.manager.find(schema.schema.name).create(self.services, scenario, schema);
  var object = schema.schema.object;
  var errors = [];

  // Execute across all the iterations
  for(var i = 0; i < iterationsPrConcurrent; i++) {
    object.execute(function(err) {
      if(err) errors.push(err);
      left = left - 1;

      if(left == 0) {
        callback(errors.length > 0 ? errors : null);
      }
    });
  }
}

var executePlan = function(self, scenario, scenarioInstance, callback) {
  // Get the schema object
  var schema = scenarioInstance.schema;
  // Get the plan we are executing against the schema
  var plan = schema.plan;

  // Unpack the plan parameters
  var type = plan.type;
  var iterations = plan.iterations;
  var distribution = plan.distribution;
  var maxConcurrency = plan.maxConcurrency;
  
  // Iterations pr concurrent operation
  var iterationsPrConcurrent = Math.round(iterations/maxConcurrency);
  var left = maxConcurrency;
  var errors = [];
  // Execute in parallel
  for(var i = 0; i < maxConcurrency; i++) {
    executeWorker(self, scenario, schema, iterationsPrConcurrent, function(err) {
      if(err) errors.push(err);
      left = left - 1;
      
      // Finished executing
      if(left == 0) {
        callback(errors.length > 0 ? errors : null);
      }
    });
  }
}
 
var execute = function(self, scenario, scenarios, callback) {
  console.log(f("[CHILD-%s:%s] starting execution of plan against scenarios", os.hostname(), self.argv.p));

  // Number of scenarios left to execute
  var left = scenarios.length;
  var errors = [];

  // Execute a plan
  for(var i = 0; i < scenarios.length; i++) {
    executePlan(self, scenario, scenarios[i], function(err) {
      if(err) errors.push(err);
      left = left - 1;

      if(left == 0) {
        callback(errors.length > 0 ? errors : null);
      }
    });
  }
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
    remote.done(results, function() {
      d.end();
    });
  })
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