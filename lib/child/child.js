var f = require('util').format
  , dnode = require('dnode')
  , os = require('os');

var Child = function(manager, argv) {
  this.manager = manager;
  this.argv = argv;
  this.state = 'init';
}

var performSetups = function(self, scenarios, callback) {
  callback();
}

var execute = function(self, scenarios, callback) {
  callback();
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
    var scenario = this.manager.find(schema.schema.name);
    // Add to the list of scenarios if it's available
    if(scenario != null) {
      console.log(f('[CHILD-%s:%s] located scenario %s', os.hostname(), this.argv.p, scenario.name));
      scenarios.push({
          schema: schema
        , scenario: scenario
      });
    }
  };

  console.log(f('[CHILD-%s:%s] starting process setup of scenarios', os.hostname(), self.argv.p));
  // Perform the needed setup of the schemas
  performSetups(self, scenarios, function(err) {
    if(err) return callerror(self, new Error('failed to execute process setups for scenarios'));
    console.log(f('[CHILD-%s:%s] starting execution of scenarios', os.hostname(), self.argv.p));
    // Execute the scenarios
    execute(self, scenarios, function(err, results) {
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