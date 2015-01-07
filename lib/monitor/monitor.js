var cp = require('child_process')
  , f = require('util').format
  , dnode = require('dnode')
  , inherits = require('util').inherits
  , MongoClient = require('mongodb').MongoClient
  , EventEmitter = require('events').EventEmitter;

/*
 * Monitor that coordinates all the child processes
 */
var Monitor = function(argv, manager, clients) {
  this.argv = argv;
  this.manager = manager;
  this.clients = clients;
  this.children = [];

  // Execution state
  this.registeredChildrenCount = 0;
  this.processesDoneCount = 0;
  this.results = [];
  this.errors = [];
}

inherits(Monitor, EventEmitter);

/*
 * Start the monitor
 */
Monitor.prototype.start = function(callback) {
  EventEmitter.call(this);
  // Not running in local mode
  if(!this.argv.l) return callback();  
  // Default child port
  var port = this.argv['local-process-port'];
  var url = this.argv['local-process-url'];

  // Kick off the processes
  for(var i = 0; i < this.argv.n; i++) {
    var child = new LocalChild(f('child_%s', i), url, this.argv.p, port++);
    // Save the child to the list of children
    this.children.push(child);
    // Start the child
    child.start();
  }
}

Monitor.prototype.error = function(err) {  
  console.log(f('[MONITOR] client signaled error'));
  // console.log(f('[MONITOR] register execution process node %s:%s', client.hostname, client.argv.p));
  this.errors.push(err);
  // Update number of processes done
  this.processesDoneCount = this.processesDoneCount + 1;
  // Are we done ?
  if(this.processesDoneCount == this.children.length) {
    this.emit('error')
  } 
}

Monitor.prototype.done = function(results) {  
  console.log(f('[MONITOR] client signaled done'));

  this.results.push(results);
  // Update number of processes done
  this.processesDoneCount = this.processesDoneCount + 1;
  // Are we done ?
  if(this.processesDoneCount == this.children.length) {
    this.emit('complete')
  } 
}

Monitor.prototype.stop = function(signal, callback) {
  if(typeof signal == 'function') callback = signal, signal = 'SIGTERM';
  var left = this.children.length;

  for (var i = this.children.length - 1; i >= 0; i--) {
    this.children[i].stop(signal, function() {
      left = left - 1;

      if(left == 0) {
        callback();
      }
    });
  };
}

var finish = function(self) {

}

Monitor.prototype.register = function(client) {
  var found = false
  // We have enough children ignore any more incoming clients
  if(this.registeredChildrenCount == this.argv.n) return;
  console.log(f('[MONITOR] register execution process node %s:%s', client.hostname, client.argv.p));
  
  // Locate the matching child (if we have one)
  for(var i = 0; i < this.children.length; i++) {
    var child = this.children[i];

    if(child.tag == client.argv.t) {
      child.registerInfo = client;
      found = true;
      break;
    }
  }

  // Registered another child
  this.registeredChildrenCount = this.registeredChildrenCount + 1;
  // Do we have enough workers execute them
  if(this.registeredChildrenCount == this.argv.n) return this.execute();
}

var scenarioSetup = function(self, scenario, callback) {
  MongoClient.connect(scenario.url, function(err, db) {
    if(err) return callback(err);

    // How many schemas are left
    var left = scenario.schemas.length;
    var errors = [];

    // Execute the global schema setup
    var setupSchema = function(schema, callback) {

    }

    // Iterate over all the schemas
    for(var i = 0; i < scenario.schemas.length; i++) {
      setupSchema(scenario.schemas[i], function(err) {
        left = left - 1;
        if(err) errors.push(err);

        if(left == 0) {
          callback(errors.length > 0 ? errors : null);
        }
      });
    }
  });
}

Monitor.prototype.execute = function(callback) {
  console.log(f("[MONITOR] starting execution of provided scenario %s", this.argv.s));
  var file = f('%s/%s', process.cwd(), this.argv.s);
  
  // Load the passed in scenario
  var scenario = require(file);
  var errors = [];
  var results = [];
  var left = this.children.length;
  
  // Perform scenario setup
  scenarioSetup(this, scenario, function(err) {
    if(err) throw err;

    // Call each child with the executor
    for(var i = 0; i < this.children.length; i++) {

      // Execute the scenario on the child process
      this.children[i].execute(scenario, {}, function(err, results) {
        left = left - 1;

        if(left == 0) {
          callback(errors.length > 0 ? errors : null, results);
        }
      });
    }
  });
}

/*
 * Child process wrapper
 */
var LocalChild = function(tag, url, monitorPort, port) { 
  this.tag = tag;
  this.url = url;
  this.monitorPort = monitorPort;
  this.port = port;
  this.state = 'init';
  this.registerInfo = null;
}

/*
 * Execute scenario using a child process
 */
LocalChild.prototype.execute = function(scenario, options, callback) {
  var self = this;
  // Connect to the child process and execute the scenario
  var d = dnode.connect(this.port);
  d.on('remote', function(remote) {
    console.log(f("[MONITOR] executing scenario against local child process at %s:%s", self.registerInfo.hostname, self.port));
    remote.execute(scenario, options, function(err, results) {
      d.end();
    });
  });
}

/*
 * Stop the child process
 */
LocalChild.prototype.stop = function(signal, callback) {
  this.process.on('exit', callback);
  this.process.kill(signal);
}

/*
 * Start the local child process
 */
LocalChild.prototype.start = function() {
  var self = this;
  // For
  this.state = 'fork';
  // For the child
  this.process = cp.fork(__dirname + '/../../child.js', [
      '-p', self.port
    , '-m', self.monitorPort
    , '-u', self.url
    , '-t', self.tag]);
  
  // Receive message exit
  this.process.on('exit', function(code, signal) {
    self.state = 'exited';
  });

  // Receive message exit
  this.process.on('close', function(code, signal) {});

  // Receive error message
  this.process.on('error', function(err) {
    self.state = 'error';
  });
}

module.exports = Monitor;















