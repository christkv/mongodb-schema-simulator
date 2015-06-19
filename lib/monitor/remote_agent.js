var f = require('util').format
  , co = require('co');

/*
 * Child process wrapper
 */
class RemoteAgentProcess {
  constructor() {
    this.registerInfo = null;
    // Remote handles
    this.connection = null;
    this.remote = null;
  }

  /*
   * Execute scenario using a child process
   */
  execute(scenario, options) {
    var self = this;
    console.log(f("[REMOTE-AGENT] executing scenario against local child process at %s:%s", self.registerInfo.hostname, self.registerInfo.port));

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Connect to the child process and execute the scenario
        if(!self.connection) {
          self.connection = dnode.connect(self.registerInfo.argv.p);
          self.connection.on('remote', function(remote) {
            co(function*() {
              // Save remote reference
              self.remote = remote;
              // Execute on agent
              yield remote.execute(scenario, options);
              resolve();
            }).catch(function(err) { reject(err); });
          });
        } else {
          yield self.remote.execute(scenario, options);
          resolve();
        }
      }).catch(function(err) { reject(err); });
    });
  }

  /*
   * Stop the child process
   */
  RemoteAgentProcess.prototype.stop = function(signal) {
    return new Promise(function(resolve, reject) {
      resolve();
    });
  }

  /*
   * Start the local child process
   */
  RemoteAgentProcess.prototype.start = function() {
    return new Promise(function(resolve, reject) {
      resolve();
    });
  }
}

module.exports = RemoteAgentProcess;
