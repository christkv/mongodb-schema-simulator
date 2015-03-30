var f = require('util').format
  , fs = require('fs')
  , dnode = require('dnode')
  , mkdirp = require('mkdirp')
  , levelup = require('levelup')  
  , inherits = require('util').inherits
  , Process = require('./process')
  , EventEmitter = require('events').EventEmitter
  , ScenarioManager = require('../common/scenario_manager')
  , ProgressBar = require('progress');

var Optimizer = function(argv, manager) { 
  EventEmitter.call(this);

  // Save the parameters
  this.argv = argv;
  this.manager = manager
  
  // Create level up db
  if(argv.g == false) this.db = levelup(f('%s/db', argv.o));  
  
  // Get the total amount of work needed
  this.totalExecutions = 0;
  this.bar = null;
  
  // Incrementing index for the level up db
  this.levelUpId = 0;

  // Marging in error %
  this.marginOfError = argv['optimize-margin'] || 10;
  
  // Monitor instance
  this.monitor = new Process(argv, manager);
}

inherits(Optimizer, EventEmitter);

Optimizer.prototype.report = function(callback) {
  this.emit('reportDone');
}

Optimizer.prototype.execute = function() {
  // Get reference to monitor instance
  var monitor = this.monitor;
  var argv = this.argv;
  var data = null;
  var self = this;

  // The actual server (handles clients reporting back)
  var server = dnode({
    // Registration call from the client process
    register: function(client, callback) {
      monitor.register(client)
      callback();
    },

    log: function(measurements, callback) {},

    // Error from the client process
    error: function(err, callback) {
      monitor.error(err);
      callback();
    },

    // Results from a client process
    done: function(results, callback) {
      monitor.done(results);
      callback();
    },

    // Reports the number of items we are executing for all jobs
    setup: function(data, callback) {
      callback();
    },

    // A work unit was finished
    tick: function(callback) {
      if(self.bar == null) self.bar = new ProgressBar('  executing [:bar] [:current/:total] :etas', {
            complete: '='
          , incomplete: ' '
          , width: 60
          , total: self.totalExecutions
        }
      );

      self.bar.tick();
      callback();
    }
  });

  // Wait for all children to be setup
  monitor.on('registrationComplete', function() {  
    monitor.execute();
  });

  // Wait for the scenario to finish executing
  monitor.on('complete', function() {
    if(argv.debug) console.log("[MONITOR] Execution finished, stopping child processes");

    // // How long was the runtime
    // console.log("----------------------------------------- FINISHED");
    // console.log("startTime :: " + monitor.startTime);
    // console.log("endTime :: " + monitor.endTime);

    // Calculate total time taken
    var totalTimeMS = monitor.endTime.getTime() - monitor.startTime.getTime();
    // console.log("totalTimeMS :: " + totalTimeMS);

    // Calculate expected time for the iterations
    var expectedTimeMS = monitor.scenario[0].execution.iterations 
      * monitor.scenario[0].execution.resolution;
    // console.log("expectedTimeMS :: " + expectedTimeMS);

    // Clear out bar
    self.bar = null;
    
    // Calculate the margin of error in MS
    var marginErrorMS = expectedTimeMS * (self.marginOfError/100);
    var lowerMarginMS = expectedTimeMS - marginErrorMS;
    var upperMarginMS = expectedTimeMS + marginErrorMS;

    // Validate if we are inside the margin of error
    if(totalTimeMS > lowerMarginMS && totalTimeMS < upperMarginMS) {
      return monitor.stop(function() {
        // Write the schemas out
        fs.writeFileSync(f('%s/optimized_scenario.json', argv.o), JSON.stringify(monitor.scenario, null, 2));
        // Exit the process
        process.exit(0);
      });      
    }

    // console.log("marginErrorMS :: " + marginErrorMS);
    // console.log("lowerMarginMS :: " + lowerMarginMS);
    // console.log("upperMarginMS :: " + upperMarginMS);

    // Calculate the difference between the miliseconds in percentage
    var percentageFactor = (expectedTimeMS/totalTimeMS);
    // Reset total
    self.totalExecutions = 0;

    // Time to adjust the number of users in each scenario
    for(var i = 0; i < monitor.scenario.length; i++) {
      var dist = monitor.scenario[i].execution
      // Adjust number of users
      dist.numberOfUsers = Math.round(dist.numberOfUsers * percentageFactor);
      // Calculate total number of executions needed
      self.totalExecutions += (dist.iterations * dist.numberOfUsers * argv.n);
    }

    // Reset the monitor
    monitor.reset();
    // Let's force a restart
    monitor.execute();
  });

  // In case the scenario failed to execute
  monitor.on('error', function(err) {
    self.emit('error', err);
  });

  // Run the monitor listening point
  server.listen(argv.p, function() {
    // Start the monitor
    monitor.start(function(err, data) {
      // Handle error and exit
      if(err) {
        console.log(f("failed to start monitor with error: %s", err));
          console.log("---------------------------------- 0")
        // Stop the world
        return monitor.stop(function() {
          console.log("---------------------------------- 1")
          process.exit(0);
        });
      }

      // Set total number of executions expected
      self.totalExecutions = data.totalExecutions;
    });
  });
}

module.exports = Optimizer;