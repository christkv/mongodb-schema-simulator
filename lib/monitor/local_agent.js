var cp = require('child_process')
  , f = require('util').format
  , dnode = require('dnode');

/*
 * Child process wrapper
 */
var LocalAgentProcess = function(tag, url, monitorPort, port) {
  this.tag = tag;
  this.url = url;
  this.monitorPort = monitorPort;
  this.port = port;
  this.state = 'init';
  this.registerInfo = null;

  // Remote handles
  this.connection = null;
  this.remote = null;
}

/*
 * Execute scenario using a child process
 */
LocalAgentProcess.prototype.execute = function(scenario, options, callback) {
  var self = this;
  console.log(f("[LOCAL-AGENT] executing scenario against local child process at %s:%s", self.registerInfo.hostname, self.port));
  
  // Connect to the child process and execute the scenario
  if(!this.connection) {
    this.connection = dnode.connect(this.port);
    this.connection.on('remote', function(remote) {
      // Save remote reference
      self.remote = remote;
      // Execute on agent
      remote.execute(scenario, options, function(err, results) {});
    });
  } else {
    self.remote.execute(scenario, options, function(err, results) {});
  }
}

/*
 * Stop the child process
 */
LocalAgentProcess.prototype.stop = function(signal, callback) {
  console.log(f("[LOCAL-AGENT] stopped on %s:%s", this.registerInfo.hostname, this.port));
  if(typeof this.process.exitCode == 'number') return callback();
  this.process.on('exit', callback);
  this.process.kill(signal);
}

/*
 * Start the local child process
 */
LocalAgentProcess.prototype.start = function() {
  var self = this;
  // For
  this.state = 'fork';
  // For the child
  this.process = cp.fork(__dirname + '/../../agent.js', [
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

module.exports = LocalAgentProcess;
