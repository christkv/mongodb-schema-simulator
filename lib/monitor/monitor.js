var cp = require('child_process')
  , f = require('util').format;

/*
 * Monitor that coordinates all the child processes
 */
var Monitor = function(argv, clients) {
  this.argv = argv;
  this.clients = clients;
  this.children = [];
}

/*
 * Start the monitor
 */
Monitor.prototype.start = function(callback) {
  // Not running in local mode
  if(!this.argv.l) return callback();
  
  // Start the number of processes we need
  var left = this.argv.l;
  var errors = [];

  // Default child port
  var port = this.argv['local-process-port'];
  var url = this.argv['local-process-url'];

  // Kick off the processes
  for(var i = 0; i < this.argv.n; i++) {
    var child = new LocalChild(url, this.argv.p, port++);
    // Save the child to the list of children
    this.children.push(child);
    // Start the child
    child.start();
  }
}

Monitor.prototype.execute = function(callback) {
  console.log("============ Monitor.execute :: " + process.cwd())
  var file = f('%s/%s', process.cwd(), this.argv.s);
  
  // Load the passed in scenario
  var scenario = require(file);
  var errors = [];
  var results = [];
  var left = this.children.length;
  
  // Call each child with the executor
  for(var i = 0; i < this.children.length; i++) {

    // Execute the scenario on the child process
    this.children[i].execute(scenario, function(err, results) {
      left = left - 1;

      if(left == 0) {
        callback(errors.length > 0 ? errors : null, results);
      }
    });
  }
}

/*
 * Child process wrapper
 */
var LocalChild = function(url, monitorPort, port) { 
  this.url = url;
  this.monitorPort = monitorPort;
  this.port = port;
  this.state = 'init';
}

/*
 * Execute scenario using a child process
 */
LocalChild.prototype.execute = function(scenario, callback) {

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
    , '-u', self.url]);
  
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















