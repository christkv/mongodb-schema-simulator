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
}

/*
 * Execute scenario using a child process
 */
LocalAgentProcess.prototype.execute = function(scenario, options, callback) {
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
LocalAgentProcess.prototype.stop = function(signal, callback) {
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
