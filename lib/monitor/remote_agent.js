var cp = require('child_process')
  , f = require('util').format
  , dnode = require('dnode');

/*
 * Child process wrapper
 */
var RemoteAgentProcess = function() {
  this.registerInfo = null;

  // Remote handles
  this.connection = null;
  this.remote = null;
}

/*
 * Execute scenario using a child process
 */
RemoteAgentProcess.prototype.execute = function(scenario, options, callback) {
  var self = this;
  console.log(f("[REMOTE-AGENT] executing scenario against local child process at %s:%s", self.registerInfo.hostname, self.registerInfo.port));
  
  // Connect to the child process and execute the scenario
  if(!this.connection) {
    this.connection = dnode.connect(this.registerInfo.argv.p);
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
RemoteAgentProcess.prototype.stop = function(signal, callback) {
  callback();
}

/*
 * Start the local child process
 */
RemoteAgentProcess.prototype.start = function() {
}

module.exports = RemoteAgentProcess;
