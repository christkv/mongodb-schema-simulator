var cp = require('child_process')
  , f = require('util').format
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter;

/*
 * Child Process
 */
var P = function(executor) {
  EventEmitter.call(this);
  // Initiate the number of children we are going to use to execute against
  var n = cp.fork(__dirname + '/../child/process.js');
  var self = this;
  
  // Receive messages
  n.on('message', function(m) {      
    console.log("======================== Got child message")
    console.dir(m);

    // We got a child message ready
    if(m.type == 'ready') {
      self.emit('ready');
    } else if(m.type == 'done') {
      self.emit('done');
    }
  });

  // Receive message exit
  n.on('exit', function(code, signal) {
    console.log(f('============== process.exit with code %s and signal %s', code, signal));
  });

  // Receive message exit
  n.on('close', function(code, signal) {

  });

  // Receive message exit
  n.on('error', function(err) {

  });

  // Send the module information to the child process
  n.send({type: 'init', module: executor.module, args: executor.args});

  // Execute the primed process
  this.execute = function() {
    n.send({type: 'execute'});
  }
}

inherits(P, EventEmitter);

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

  // Start executing the workload
  var executeWorkLoad = function() {
    console.log("====================== executeWorkLoad")
    // Signal all processes to start running
    for(var i = 0; i < self.children.length; i++) {
      p.execute();
    }
  }

  var done = function() {
    console.log("====================== done")
    process.exit(0);
  }

  // Create all processes and wait for them to report ready status
  for(var i = 0; i < this.args.p; i++) {
    // Create a process
    var p = new P(this);
    p.on('ready', function() {
      numberOfProcessesReady = numberOfProcessesReady + 1;
      
      if(numberOfProcessesReady == self.args.p) {
        executeWorkLoad();
      }
    });

    p.on('done', function() {
      numberOfDone = numberOfDone + 1;

      if(numberOfDone == self.args.p) {
        done();
      }
    });

    // Save child information
    this.children.push(p);
  } 
}

module.exports = Executor;