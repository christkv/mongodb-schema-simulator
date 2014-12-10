var cp = require('child_process')
  , f = require('util').format
  , fs = require('fs')
  , spawn = require('child_process').spawn
  , rimraf = require('rimraf')
  , levelup = require('levelup')
  , inherits = require('util').inherits
  , RunningStats = require('./running_stats')
  , EventEmitter = require('events').EventEmitter
  , Line = require('../gnuplot/gnuplot').Line
  , https = require('https');

/*
 * Monitoring Process (monitors the MongoDB processes and records statistics)
 */
var Monitor = function(executor) {
  var self = this;
  EventEmitter.call(this);
  // Initiate the number of children we are going to use to execute against
  this.n = cp.fork(__dirname + '/../child/monitor.js');
  
  // Receive messages
  this.n.on('message', function(m) {      
    // We got a child message ready
    if(m.type == 'ready') {
      self.emit('ready');
    } else if(m.type == 'done') {
      self.emit('done');
    }
  });

  // Receive message exit
  this.n.on('exit', function(code, signal) {
    // console.log(f('============== monitor process.exit with code %s and signal %s', code, signal));
  });

  // Receive message exit
  this.n.on('close', function(code, signal) {});
  // Receive message exit
  this.n.on('error', function(err) {});

  // Send the module information to the child process
  this.n.send({type: 'init', module: executor.module, args: executor.args});

  // Execute the primed process
  this.execute = function() {
    self.n.send({type: 'execute'});
  }  

  // Stop the monitor
  this.stop = function() {
    self.n.send({type: 'stop'});
  }
}

/*
 * Child Process
 */
var P = function(executor) {
  var self = this;
  EventEmitter.call(this);
  // Initiate the number of children we are going to use to execute against
  this.n = cp.fork(__dirname + '/../child/process.js');
  // Debug enabled
  if(executor.options.debug) {
    console.log(f("[Parent Process] Created process with pid %s", this.n.pid))
  }
  
  // Receive messages
  this.n.on('message', function(m) {      
    // We got a child message ready
    if(m.type == 'ready') {
      self.emit('ready');
    } else if(m.type == 'done') {
      self.emit('done');
    }
  });

  // Receive message exit
  this.n.on('exit', function(code, signal) {
    // Debug enabled
    if(executor.options.debug) {
      console.log(f("[Parent Process] workload process.exit with code %s and signal %s", code, signal))
    }
  });

  // Receive message exit
  this.n.on('close', function(code, signal) {});
  // Receive message exit
  this.n.on('error', function(err) {});

  // Send the module information to the child process
  this.n.send({type: 'init', module: executor.module, args: executor.args, options: executor.options});

  // Execute the primed process
  this.execute = function() {
    self.n.send({type: 'execute'});
  }

  // Kill the process
  this.kill = function() {
    process.kill(self.n.pid);
  }
}

inherits(P, EventEmitter);
inherits(Monitor, EventEmitter);

/*
 * Executor
 */
var Executor = function(args, module, options) {  
  this.args = args;
  this.module = module;
  this.children = [];
  this.options = options || {};  
  this.debug = typeof options.debug == 'boolean' ? options.debug : false;
}

Executor.prototype.execute = function() {
  var numberOfProcessesReady = 0;
  var numberOfDone = 0;
  var self = this;
  var monitor = null;

  // If we have specified to clean up the data directory
  if(this.args.x) {
    try {
      rimraf.sync(this.args.d || './tmp');      
    } catch(err) {}
  }

  // Terminate all processes on exit
  process.on('SIGTERM', function() {
    for(var i = 0; i < self.children.length; i++) {
      self.children[i].kill();
    }
  });

  // Start executing the workload
  var executeWorkLoad = function() {
    // Signal all processes to start running
    for(var i = 0; i < self.children.length; i++) {
      self.children[i].execute();
    }
  }

  var processOperationsData = function(pid, callback) {
    // Process all the data from the monitor
    var opsDb = f('%s/%s/db', self.args.d || './tmp', pid); 
    // Open the db
    var db = levelup(opsDb);
    // First result
    var firstResult = true;
    // Total data points
    var totalPoints = 0;
    // Final results based on operations pr unit of time
    var results = {
        inserts: []
      , updates: []
      , deletes: []
      , getmores: []
      , commands: []
      , queries: []
    }

    // Latest values
    var lastValues = {
      insert: 0, update: 0, delete: 0, getmore: 0, query: 0, command: 0
    }

    // Results
    var results = [];
    var index = 0;
    // Current second of data
    var currentSecond = null;

    // Iterate over the saved data
    db.createValueStream({ keys:false, values: true})
      .on('data', function(data) {
        // Parse the object
        var object = JSON.parse(data);
        if(currentSecond == null) {
          currentSecond = object.s;
        }

        // Is this outside the current second
        if(object.s > (currentSecond + (1000*1000))) {
          // Set bucket to next second
          currentSecond = currentSecond + (1000 * 1000);
          index = index + 1;
        }

        // Initialize the counter
        if(results[index] == null) {
          results[index] = {stats: []};
        }

        if(results[index][object.c + "_" + object.m] == null) {
          results[index][object.c + "_" + object.m] = { count: 0 };
        }

        // Update the type of doc
        results[index][object.c + "_" + object.m].count += 1;
        results[index].stats.push(object.t);
      })
      .on('end', function() {
        db.close();
        callback(results);
      });        
  }

  var processMonitorData = function(callback) {
    // Process all the data from the monitor
    var monitorDb = f('%s/monitor-%s/db', self.args.d || './tmp', monitor.n.pid); 
    // Open the db
    var db = levelup(monitorDb);
    // First result
    var firstResult = true;
    // Total data points
    var totalPoints = 0;
    // Final results based on operations pr unit of time
    var results = {
        inserts: []
      , updates: []
      , deletes: []
      , getmores: []
      , commands: []
      , queries: []
    }

    // Latest values
    var lastValues = {
      insert: 0, update: 0, delete: 0, getmore: 0, query: 0, command: 0
    }

    // Iterate over the saved data
    db.createValueStream({ keys:false, values: true})
      .on('data', function(data) {
        // Parse the object
        var object = JSON.parse(data);

        // Extract current op counter values
        var insertOps = object.opcounters.insert;
        var updateOps = object.opcounters.update;
        var deleteOps = object.opcounters.delete;
        var getmoreOps = object.opcounters.getmore;
        var commandOps = object.opcounters.command;
        var queryOps = object.opcounters.query;

        // Log the opcounters
        if(self.debug) {
          console.dir(object.opcounters)
        }

        // Skip the first result to ensure we don't get a spike
        if(firstResult) {
          firstResult = false;
        } else {
          totalPoints = totalPoints + 1;
          // Calculate the delta 
          results.inserts.push(insertOps - lastValues.insert);
          results.updates.push(updateOps - lastValues.update);
          results.deletes.push(deleteOps - lastValues.delete);
          results.getmores.push(getmoreOps - lastValues.getmore);
          results.commands.push(commandOps - lastValues.command);
          results.queries.push(queryOps - lastValues.query);
        }

        // Set last op
        lastValues = object.opcounters;
      })
      .on('end', function() {
        db.close();
        // // Write out the file to the current data directory
        var outputFile = f('%s/%s-%s-monitor-result.dat', self.args.d || './tmp', self.args.e, self.args.m);
        // Create the gnuplot
        executeGnuPlot(self, outputFile, outputFile, results, function() {
          callback();
        });
      });    
  }

  var processAllOpsData = function(self, children, callback) {
    var left = self.children.length;
    var finalResults = [];
    
    // Process all ops streams
    for(var j = 0; j < left; j++) {
      processOperationsData(self.children[j].n.pid, function(results) {
        left = left - 1;

        // Process all the results
        for(var i = 0; i < results.length; i++) {
          for(var name in results[i]) {
            if(finalResults[i] == null) finalResults[i] = {};

            if(name != "stats") {
              if(finalResults[i][name] == null) finalResults[i][name] = {count:0};
              finalResults[i][name].count += results[i][name].count;
            } else {
              if(finalResults[i][name] == null) finalResults[i][name] = new RunningStats();
              
              for(var j = 0; j < results[i].stats.length; j++) {
                finalResults[i][name].push(results[i].stats[j]);
              }
            }
          }
        }

        // Done parsing all the results from the process
        if(left == 0) {
          // Write out the file to the current data directory
          var outputFile = f('%s/%s-%s-ops-result.dat', self.args.d || './tmp', self.args.e, self.args.m);
          
          // Final results based on operations pr unit of time
          var results = {
              inserts: []
            , updates: []
            , deletes: []
            , getmores: []
            , commands: []
            , queries: []
          }

          // Just change format of files
          for(var i = 0; i < finalResults.length; i++) {
            for(var name in results) {
              results[name][i] = 0;
            }

            if(finalResults[i]['Collection_update']) {
              results['updates'][i] = finalResults[i]['Collection_update'].count;
            }
          }

          // Create the gnuplot
          executeGnuPlot(self, outputFile, outputFile, results, function() {
            callback();
          });

          // callback();
        }
      });
    }    
  }

  // Process all the data and create the files for
  var done = function() {
    processAllOpsData(self, self.children, function() {
      // Process the Monitor data
      processMonitorData(function() {
        for(var i = 0; i < self.children.length; i++) {
          self.children[i].kill();
        }
        
        process.exit(0);
      });      
    });
  }

  var startMonitor = function() {
    monitor = new Monitor(self);
    monitor.on('ready', function() {
      executeWorkLoad();
    });

    // Start monitor
    monitor.execute();
  }

  // Create all processes and wait for them to report ready status
  for(var i = 0; i < this.args.p; i++) {
    // Create a process
    var p = new P(this);
    p.on('ready', function() {
      numberOfProcessesReady = numberOfProcessesReady + 1;
      
      // Start the monitoring process
      if(numberOfProcessesReady == self.args.p) {
        startMonitor();
      }
    });

    p.on('done', function() {
      numberOfDone = numberOfDone + 1;
      // All processes done, return
      if(numberOfDone == self.args.p) {
        // Stop the monitor
        monitor.stop();
        // Finish
        done();
      }
    });

    // Save child information
    this.children.push(p);
  }
}

var executeGnuPlot = function(executor, file, dataFileName, data, callback) {  
  var graph = new Line({debug: executor.debug});
  graph.terminal('png');
  graph.output('./testfile.png')


  // Create the data file
  var line = new Line({debug: executor.debug});
  line.terminal('png');
  line.output(f('%s.png', dataFileName));
  line.xlabel('iteration');
  line.ylabel('ops');
  line.style('data linespoints');

  var labels = [];
  // Figure out the length and create the point array
  for(var i = 0; i < data['inserts'].length; i++) {
    labels.push(i);
  }

  line.addData(labels);

  // Lines rendered
  var lines = [];
  var count = 2;
  // Add the name
  for(var name in data) {
    line.addData(data[name]);
    lines.push(f('"-" using 1:%s title "%s"', count++, name));
  }

  // Add the plot commands
  line.plotData(lines);
  line.execute(callback);  
}

module.exports = Executor;