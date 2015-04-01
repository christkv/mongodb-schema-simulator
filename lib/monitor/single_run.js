var f = require('util').format
  , fs = require('fs')
  , dnode = require('dnode')
  , mkdirp = require('mkdirp')
  , rimraf = require('rimraf')
  , levelup = require('levelup')  
  , inherits = require('util').inherits
  , Process = require('./process')
  , EventEmitter = require('events').EventEmitter
  , ScenarioManager = require('../common/scenario_manager')
  , ProgressBar = require('progress');

var SingleRun = function(argv, manager) { 
  EventEmitter.call(this);

  // Save the parameters
  this.argv = argv;
  this.manager = manager

  // Create level up db
  if(argv.g == false) {
    rimraf.sync(f('%s/db', argv.o));
    this.db = levelup(f('%s/db', argv.o));
  }

  // Get the total amount of work needed
  this.totalExecutions = 0;
  this.executionsLeft = 0;
  this.bar = null;

  // Incrementing index for the level up db
  this.levelUpId = 0;

  // Monitor instance
  this.monitor = new Process(argv, manager);
}

inherits(SingleRun, EventEmitter);

SingleRun.prototype.report = function() {
  var self = this;

  this.monitor.report(function(err) {
    if(err) return self.emit('error', err);
    self.emit('reportDone');
  });
}

SingleRun.prototype.execute = function() {
  // Get reference to monitor instance
  var monitor = this.monitor;
  var argv = this.argv;
  var self = this;

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

      self.executionsLeft = self.executionsLeft - 1;
      self.bar.tick();
      callback();
    }
  });

  // Wait for all children to be setup
  monitor.on('registrationComplete', function() {  
    // Execute the job
    monitor.execute();
  });

  // Wait for the scenario to finish executing
  monitor.on('complete', function(logEntries) {
    if(argv.debug) console.log("[MONITOR] Execution finished, stopping child processes");
    // Flush levelup db
    self.db.close(function() {
      // Stop the monitor
      monitor.stop(function() {
        if(argv.debug) console.log("[MONITOR] Executon finished, stopping dnode server endpoint");
        // Stop the dnode server
        server.end();
        // Emit end
        self.emit('end');
      });
    });
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
        // Stop the world
        return monitor.stop(function() {
          process.exit(0);
        });
      }

      // Set total number of executions expected
      self.totalExecutions = data.totalExecutions;
    });
  });
}

module.exports = SingleRun;