var f = require('util').format
  , fs = require('fs')
  , dnode = require('dnode')
  , mkdirp = require('mkdirp')
  , rimraf = require('rimraf')
  , levelup = require('levelup')
  , inherits = require('util').inherits
  , RunningStats = require('./gnuplot/running_stats')
  , Stats = require('fast-stats').Stats
  , Process = require('./process')
  , EventEmitter = require('events').EventEmitter
  , ScenarioManager = require('../common/scenario_manager')
  , ProgressBar = require('progress');

class Optimizer extends EventEmitter {
  constructor(argv, manager) {
    super();
    // Save the parameters
    this.argv = argv;
    this.manager = manager

    // Get the total amount of work needed
    this.totalExecutions = 0;
    this.bar = null;

    // Level db id
    this.dbId = 0;

    // Incrementing index for the level up db
    this.levelUpId = 0;

    // Marging in error %
    this.optimizeMargin = argv['optimize-margin'] || 25;

    // Optimizing mode
    this.optimizeMode = argv['optimize-mode'] || 'total-time';

    // Optimize against percentil
    this.optimizePercentile = argv['optimize-percentile'] || 100;

    // Latency target
    this.optimizeLatencyTarget = argv['optimize-latency-target'] || 100;

    // Scenario to optimize against
    this.optimizeForScenario = argv['optimize-for-scenario'];

    // Monitor instance
    this.monitor = new Process(argv, manager);
  }

  report(callback) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*(){
        yield self.monitor.report();
        self.emit('reportDone');
        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  execute() {
    // Get reference to monitor instance
    var monitor = this.monitor;
    var argv = this.argv;
    var data = null;
    var self = this;

    // Create level up db
    if(argv.g == false) {
      rimraf.sync(f('%s/db%s', argv.o, this.dbId));
      this.db = levelup(f('%s/db%s', argv.o, this.dbId));
    }

    // The actual server (handles clients reporting back)
    var server = dnode({
      // Registration call from the client process
      register: function(client, callback) {
        monitor.register(client)
        callback();
      },

      log: function(measurements, callback) {
        var ops = measurements.map(function(x) {
          return {type: 'put', key: self.levelUpId++, value: JSON.stringify(x)};
        });

        self.db.batch(ops, callback);
      },

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

    var optimizeTotalTime = function() {
      // Calculate total time taken
      var totalTimeMS = monitor.endTime.getTime() - monitor.startTime.getTime();

      // Calculate expected time for the iterations
      var expectedTimeMS = monitor.scenario[0].execution.iterations
        * monitor.scenario[0].execution.resolution;

      // Clear out bar
      self.bar = null;

      // Calculate the margin of error in MS
      var marginErrorMS = expectedTimeMS * (self.optimizeMargin/100);
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

      // Debugging
      if(argv.debug) console.log("[MONITOR] startTime :: " + monitor.startTime);
      if(argv.debug) console.log("[MONITOR] endTime :: " + monitor.endTime);
      if(argv.debug) console.log("[MONITOR] totalTimeMS :: " + totalTimeMS);
      if(argv.debug) console.log("[MONITOR] expectedTimeMS :: " + expectedTimeMS);
      if(argv.debug) console.log("[MONITOR] marginErrorMS :: " + marginErrorMS);
      if(argv.debug) console.log("[MONITOR] lowerMarginMS :: " + lowerMarginMS);
      if(argv.debug) console.log("[MONITOR] upperMarginMS :: " + upperMarginMS);

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
    }

    var optimizeLatency = function() {
      // Get the schema
      var schemas = monitor.scenario;
      // Collect all the scenarios for each tag
      var scenarios = {};
      var statistics = {};
      var resolution = monitor.scenario[0].execution.resolution;

      // Clear out bar
      self.bar = null;

      // Attempt to read the db
      var db = levelup(f('%s/db%s', monitor.argv.o, self.dbId));
      var stream = db.createReadStream();

      // Process all the data events
      stream.on('data', function(data) {
        var obj = JSON.parse(data.value);
        if(scenarios[obj.tag] == null) scenarios[obj.tag] = [];
        scenarios[obj.tag].push(obj);
      });

      // Finished emitting level-up events
      stream.on('end', function() {
        co(function*() {
          yield db.close();

          // Calculate all the statistical values of the set
          for(var name in scenarios) {
            // Create new stats runners
            var stats = new Stats();

            // Get the measurements
            var measurements = scenarios[name];
            // Iterare over all the measurements
            for(var i = 0; i < measurements.length; i++) {
              var timestamp = measurements[i].timestamp;
              stats.push(measurements[i].object.time);
            }

            // Calculate time in miliseconds
            var amean = Math.round(stats.amean()/1000);
            var σ = Math.round(stats.σ()/1000);
            var percentile_75 = Math.round(stats.percentile(75)/1000);
            var percentile_95 = Math.round(stats.percentile(95)/1000);
            var percentile_99 = Math.round(stats.percentile(99)/1000);
            var min = Math.round(stats.range()[0]/1000);
            var max = Math.round(stats.range()[1]/1000);

            // Push stats object
            statistics[name] = stats;

            // Debugging
            if(argv.debug) console.log("[MONITOR] .amean() = " + amean);
            if(argv.debug) console.log("[MONITOR] .σ() = " + σ);
            if(argv.debug) console.log("[MONITOR] .percentile(75) = " + percentile_75);
            if(argv.debug) console.log("[MONITOR] .percentile(95) = " + percentile_95);
            if(argv.debug) console.log("[MONITOR] .percentile(99) = " + percentile_99);
            if(argv.debug) console.log("[MONITOR] .min = " + min);
            if(argv.debug) console.log("[MONITOR] .max = " + max);
          }

          // Get the keys
          var keys = Object.keys(statistics);
          // Get th first stats object
          var stats  = statistics[keys[0]];

          if(statistics[self.optimizeForScenario]) {
            stats = statistics[self.optimizeForScenario];
          }

          // Calculate the margin of error in MS
          var marginErrorMS = self.optimizeLatencyTarget * (self.optimizeMargin/100);
          var lowerMarginMS = self.optimizeLatencyTarget - marginErrorMS;
          var upperMarginMS = self.optimizeLatencyTarget + marginErrorMS;

          // Validate the percentile
          var percentile = Math.round(stats.percentile(self.optimizePercentile)/1000);

          // Calculate the difference
          var percentageFactor = (self.optimizeLatencyTarget/percentile);

          // Debugging
          if(argv.debug) console.log("[MONITOR] optimizeLatencyTarget = " + self.optimizeLatencyTarget)
          if(argv.debug) console.log("[MONITOR] optimizeForScenario = " + self.optimizeForScenario)
          if(argv.debug) console.log("[MONITOR] percentile = " + percentile)
          if(argv.debug) console.log("[MONITOR] percentageFactor = " + percentageFactor)
          if(argv.debug) console.log("[MONITOR] marginErrorMS = " + marginErrorMS)
          if(argv.debug) console.log("[MONITOR] lowerMarginMS = " + lowerMarginMS)
          if(argv.debug) console.log("[MONITOR] upperMarginMS = " + upperMarginMS)

          // Validate if we are inside the margin of error
          if(percentile > lowerMarginMS && percentile < upperMarginMS) {
            yield monitor.stop();
            // Write the schemas out
            fs.writeFileSync(f('%s/optimized_scenario.json', argv.o), JSON.stringify(monitor.scenario, null, 2));
            // Exit the process
            process.exit(0);
          }

          // Debugging
          if(argv.debug) console.log("[MONITOR] resolution = " + resolution)
          if(argv.debug) console.log("[MONITOR] percentile = " + percentile)
          if(argv.debug) console.log("[MONITOR] percentageFactor = " + percentageFactor)

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

          // Create a new db
          self.db = levelup(f('%s/db%s', argv.o, ++self.dbId));
          // Reset the monitor
          monitor.reset();
          // Let's force a restart
          monitor.execute();
        });
      });
    }

    // Wait for the scenario to finish executing
    monitor.on('complete', function() {
      co(function*() {
        if(argv.debug) console.log("[MONITOR] Execution finished, stopping child processes");
        // Flush levelup db
        yield self.db.close();
        // Are we optimizing for total time
        if(self.optimizeMode == 'latency') {
          optimizeLatency();
        } else {
          optimizeTotalTime();
        }
      });
    });

    // In case the scenario failed to execute
    monitor.on('error', function(err) {
      self.emit('error', err);
    });

    // Run the monitor listening point
    server.listen(argv.p, function() {
      co(function*() {
        // Start the monitor
        var data = yield monitor.start();
        // Handle error and exit
        if(err) {
          console.log(f("failed to start monitor with error: %s", err));
          // Stop the world
          yield monitor.stop()
          process.exit(0);
        }

        // Set total number of executions expected
        self.totalExecutions = data.totalExecutions;
      });
    });
  }
}

// var Optimizer = function(argv, manager) {
//   EventEmitter.call(this);
//
//   // Save the parameters
//   this.argv = argv;
//   this.manager = manager
//
//   // Get the total amount of work needed
//   this.totalExecutions = 0;
//   this.bar = null;
//
//   // Level db id
//   this.dbId = 0;
//
//   // Incrementing index for the level up db
//   this.levelUpId = 0;
//
//   // Marging in error %
//   this.optimizeMargin = argv['optimize-margin'] || 25;
//
//   // Optimizing mode
//   this.optimizeMode = argv['optimize-mode'] || 'total-time';
//
//   // Optimize against percentil
//   this.optimizePercentile = argv['optimize-percentile'] || 100;
//
//   // Latency target
//   this.optimizeLatencyTarget = argv['optimize-latency-target'] || 100;
//
//   // Scenario to optimize against
//   this.optimizeForScenario = argv['optimize-for-scenario'];
//
//   // Monitor instance
//   this.monitor = new Process(argv, manager);
// }
//
// inherits(Optimizer, EventEmitter);

// Optimizer.prototype.report = function(callback) {
//   var self = this;
//
//   this.monitor.report(function(err) {
//     if(err) return self.emit('error', err);
//     self.emit('reportDone');
//   });
// }

// Optimizer.prototype.execute = function() {
//   // Get reference to monitor instance
//   var monitor = this.monitor;
//   var argv = this.argv;
//   var data = null;
//   var self = this;
//
//   // Create level up db
//   if(argv.g == false) {
//     rimraf.sync(f('%s/db%s', argv.o, this.dbId));
//     this.db = levelup(f('%s/db%s', argv.o, this.dbId));
//   }
//
//   // The actual server (handles clients reporting back)
//   var server = dnode({
//     // Registration call from the client process
//     register: function(client, callback) {
//       monitor.register(client)
//       callback();
//     },
//
//     log: function(measurements, callback) {
//       var ops = measurements.map(function(x) {
//         return {type: 'put', key: self.levelUpId++, value: JSON.stringify(x)};
//       });
//
//       self.db.batch(ops, callback);
//     },
//
//     // Error from the client process
//     error: function(err, callback) {
//       monitor.error(err);
//       callback();
//     },
//
//     // Results from a client process
//     done: function(results, callback) {
//       monitor.done(results);
//       callback();
//     },
//
//     // Reports the number of items we are executing for all jobs
//     setup: function(data, callback) {
//       callback();
//     },
//
//     // A work unit was finished
//     tick: function(callback) {
//       if(self.bar == null) self.bar = new ProgressBar('  executing [:bar] [:current/:total] :etas', {
//             complete: '='
//           , incomplete: ' '
//           , width: 60
//           , total: self.totalExecutions
//         }
//       );
//
//       self.bar.tick();
//       callback();
//     }
//   });
//
//   // Wait for all children to be setup
//   monitor.on('registrationComplete', function() {
//     monitor.execute();
//   });
//
//   var optimizeTotalTime = function() {
//     // Calculate total time taken
//     var totalTimeMS = monitor.endTime.getTime() - monitor.startTime.getTime();
//
//     // Calculate expected time for the iterations
//     var expectedTimeMS = monitor.scenario[0].execution.iterations
//       * monitor.scenario[0].execution.resolution;
//
//     // Clear out bar
//     self.bar = null;
//
//     // Calculate the margin of error in MS
//     var marginErrorMS = expectedTimeMS * (self.optimizeMargin/100);
//     var lowerMarginMS = expectedTimeMS - marginErrorMS;
//     var upperMarginMS = expectedTimeMS + marginErrorMS;
//
//     // Validate if we are inside the margin of error
//     if(totalTimeMS > lowerMarginMS && totalTimeMS < upperMarginMS) {
//       return monitor.stop(function() {
//         // Write the schemas out
//         fs.writeFileSync(f('%s/optimized_scenario.json', argv.o), JSON.stringify(monitor.scenario, null, 2));
//         // Exit the process
//         process.exit(0);
//       });
//     }
//
//     // Debugging
//     if(argv.debug) console.log("[MONITOR] startTime :: " + monitor.startTime);
//     if(argv.debug) console.log("[MONITOR] endTime :: " + monitor.endTime);
//     if(argv.debug) console.log("[MONITOR] totalTimeMS :: " + totalTimeMS);
//     if(argv.debug) console.log("[MONITOR] expectedTimeMS :: " + expectedTimeMS);
//     if(argv.debug) console.log("[MONITOR] marginErrorMS :: " + marginErrorMS);
//     if(argv.debug) console.log("[MONITOR] lowerMarginMS :: " + lowerMarginMS);
//     if(argv.debug) console.log("[MONITOR] upperMarginMS :: " + upperMarginMS);
//
//     // Calculate the difference between the miliseconds in percentage
//     var percentageFactor = (expectedTimeMS/totalTimeMS);
//
//     // Reset total
//     self.totalExecutions = 0;
//
//     // Time to adjust the number of users in each scenario
//     for(var i = 0; i < monitor.scenario.length; i++) {
//       var dist = monitor.scenario[i].execution
//       // Adjust number of users
//       dist.numberOfUsers = Math.round(dist.numberOfUsers * percentageFactor);
//       // Calculate total number of executions needed
//       self.totalExecutions += (dist.iterations * dist.numberOfUsers * argv.n);
//     }
//
//     // Reset the monitor
//     monitor.reset();
//     // Let's force a restart
//     monitor.execute();
//   }
//
//   var optimizeLatency = function() {
//     // Get the schema
//     var schemas = monitor.scenario;
//     // Collect all the scenarios for each tag
//     var scenarios = {};
//     var statistics = {};
//     var resolution = monitor.scenario[0].execution.resolution;
//
//     // Clear out bar
//     self.bar = null;
//
//     // Attempt to read the db
//     var db = levelup(f('%s/db%s', monitor.argv.o, self.dbId));
//     var stream = db.createReadStream();
//
//     // Process all the data events
//     stream.on('data', function(data) {
//       var obj = JSON.parse(data.value);
//       if(scenarios[obj.tag] == null) scenarios[obj.tag] = [];
//       scenarios[obj.tag].push(obj);
//     });
//
//     // Finished emitting level-up events
//     stream.on('end', function() {
//       // Flush levelup db
//       db.close(function() {
//         // Calculate all the statistical values of the set
//         for(var name in scenarios) {
//           // Create new stats runners
//           var stats = new Stats();
//
//           // Get the measurements
//           var measurements = scenarios[name];
//           // Iterare over all the measurements
//           for(var i = 0; i < measurements.length; i++) {
//             var timestamp = measurements[i].timestamp;
//             stats.push(measurements[i].object.time);
//           }
//
//           // Calculate time in miliseconds
//           var amean = Math.round(stats.amean()/1000);
//           var σ = Math.round(stats.σ()/1000);
//           var percentile_75 = Math.round(stats.percentile(75)/1000);
//           var percentile_95 = Math.round(stats.percentile(95)/1000);
//           var percentile_99 = Math.round(stats.percentile(99)/1000);
//           var min = Math.round(stats.range()[0]/1000);
//           var max = Math.round(stats.range()[1]/1000);
//
//           // Push stats object
//           statistics[name] = stats;
//
//           // Debugging
//           if(argv.debug) console.log("[MONITOR] .amean() = " + amean);
//           if(argv.debug) console.log("[MONITOR] .σ() = " + σ);
//           if(argv.debug) console.log("[MONITOR] .percentile(75) = " + percentile_75);
//           if(argv.debug) console.log("[MONITOR] .percentile(95) = " + percentile_95);
//           if(argv.debug) console.log("[MONITOR] .percentile(99) = " + percentile_99);
//           if(argv.debug) console.log("[MONITOR] .min = " + min);
//           if(argv.debug) console.log("[MONITOR] .max = " + max);
//         }
//
//         // Get the keys
//         var keys = Object.keys(statistics);
//         // Get th first stats object
//         var stats  = statistics[keys[0]];
//
//         if(statistics[self.optimizeForScenario]) {
//           stats = statistics[self.optimizeForScenario];
//         }
//
//         // console.dir(statistics)
//
//         // Calculate the margin of error in MS
//         var marginErrorMS = self.optimizeLatencyTarget * (self.optimizeMargin/100);
//         var lowerMarginMS = self.optimizeLatencyTarget - marginErrorMS;
//         var upperMarginMS = self.optimizeLatencyTarget + marginErrorMS;
//
//         // Validate the percentile
//         var percentile = Math.round(stats.percentile(self.optimizePercentile)/1000);
//
//         // Calculate the difference
//         var percentageFactor = (self.optimizeLatencyTarget/percentile);
//
//         // Debugging
//         if(argv.debug) console.log("[MONITOR] optimizeLatencyTarget = " + self.optimizeLatencyTarget)
//         if(argv.debug) console.log("[MONITOR] optimizeForScenario = " + self.optimizeForScenario)
//         if(argv.debug) console.log("[MONITOR] percentile = " + percentile)
//         if(argv.debug) console.log("[MONITOR] percentageFactor = " + percentageFactor)
//         if(argv.debug) console.log("[MONITOR] marginErrorMS = " + marginErrorMS)
//         if(argv.debug) console.log("[MONITOR] lowerMarginMS = " + lowerMarginMS)
//         if(argv.debug) console.log("[MONITOR] upperMarginMS = " + upperMarginMS)
//
//         // Validate if we are inside the margin of error
//         if(percentile > lowerMarginMS && percentile < upperMarginMS) {
//           return monitor.stop(function() {
//             // Write the schemas out
//             fs.writeFileSync(f('%s/optimized_scenario.json', argv.o), JSON.stringify(monitor.scenario, null, 2));
//             // Exit the process
//             process.exit(0);
//           });
//         }
//
//         // Debugging
//         if(argv.debug) console.log("[MONITOR] resolution = " + resolution)
//         if(argv.debug) console.log("[MONITOR] percentile = " + percentile)
//         if(argv.debug) console.log("[MONITOR] percentageFactor = " + percentageFactor)
//
//         // Reset total
//         self.totalExecutions = 0;
//
//         // Time to adjust the number of users in each scenario
//         for(var i = 0; i < monitor.scenario.length; i++) {
//           var dist = monitor.scenario[i].execution
//           // Adjust number of users
//           dist.numberOfUsers = Math.round(dist.numberOfUsers * percentageFactor);
//           // Calculate total number of executions needed
//           self.totalExecutions += (dist.iterations * dist.numberOfUsers * argv.n);
//         }
//
//         // Create a new db
//         self.db = levelup(f('%s/db%s', argv.o, ++self.dbId));
//         // Reset the monitor
//         monitor.reset();
//         // Let's force a restart
//         monitor.execute();
//       });
//     });
//   }
//
//   // Wait for the scenario to finish executing
//   monitor.on('complete', function() {
//     if(argv.debug) console.log("[MONITOR] Execution finished, stopping child processes");
//     // Flush levelup db
//     self.db.close(function() {
//       // Are we optimizing for total time
//       if(self.optimizeMode == 'latency') {
//         optimizeLatency();
//       } else {
//         optimizeTotalTime();
//       }
//     });
//   });
//
//   // In case the scenario failed to execute
//   monitor.on('error', function(err) {
//     self.emit('error', err);
//   });
//
//   // Run the monitor listening point
//   server.listen(argv.p, function() {
//     // Start the monitor
//     monitor.start(function(err, data) {
//       // Handle error and exit
//       if(err) {
//         console.log(f("failed to start monitor with error: %s", err));
//         // Stop the world
//         return monitor.stop(function() {
//           process.exit(0);
//         });
//       }
//
//       // Set total number of executions expected
//       self.totalExecutions = data.totalExecutions;
//     });
//   });
// }

module.exports = Optimizer;
