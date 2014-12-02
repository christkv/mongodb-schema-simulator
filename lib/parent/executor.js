var cp = require('child_process')
  , f = require('util').format
  , rimraf = require('rimraf')
  , levelup = require('levelup')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter;

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
    console.log(f('============== monitor process.exit with code %s and signal %s', code, signal));
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
  console.log("======================== Created process :: " + this.n.pid)
  
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
    console.log(f('============== workload process.exit with code %s and signal %s', code, signal));
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
}

inherits(P, EventEmitter);
inherits(Monitor, EventEmitter);

/*
 * Executor
 */
var Executor = function(args, module) {  
  this.args = args;
  this.module = module;
  this.children = [];
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

  // Start executing the workload
  var executeWorkLoad = function() {
    // Signal all processes to start running
    for(var i = 0; i < self.children.length; i++) {
      self.children[i].execute();
    }
  }

  // Process all the data and create the files for
  var done = function() {
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

        // console.log("============================= op counters")
        // console.dir(object.opcounters)
        // Extract current op counter values
        var insertOps = object.opcounters.insert;
        var updateOps = object.opcounters.update;
        var deleteOps = object.opcounters.delete;
        var getmoreOps = object.opcounters.getmore;
        var commandOps = object.opcounters.command;
        var queryOps = object.opcounters.query;

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
        console.log("++++++++++++++++++++++++++++++++++++++++++++++++ END")
        console.dir(results)
        process.exit(0);
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

module.exports = Executor;