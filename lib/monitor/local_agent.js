var cp = require('child_process')
  , f = require('util').format
  , co = require('co')
  , dnode = require('dnode');

/*
 * Child process wrapper
 */
class LocalAgentProcess {
  constructor(tag, url, monitorPort, port) {
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
  execute(scenario, options) {
    var self = this;
    console.log(f("[LOCAL-AGENT] executing scenario against local child process at %s:%s", self.registerInfo.hostname, self.port));

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Connect to the child process and execute the scenario
        if(!self.connection) {
          self.connection = dnode.connect(self.port);
          self.connection.on('remote', function(remote) {
            co(function*() {
              // Save remote reference
              self.remote = remote;
              // Execute on agent
              yield remote.execute(scenario, options);
              // Running
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
  stop(signal) {
    var self = this;
    console.log(f("[LOCAL-AGENT] stopped on %s:%s", this.registerInfo.hostname, this.port));

    return new Promise(function(resolve, reject) {
      if(typeof self.process.exitCode == 'number') return resolve();
      self.process.on('exit', resolve);
      self.process.kill(signal);
    });
  }

  /*
   * Start the local child process
   */
  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      // For
      self.state = 'fork';
      // For the child
      self.process = cp.fork(__dirname + '/../../agent.js', [
          '-p', self.port
        , '-m', self.monitorPort
        , '-u', self.url
        , '-t', self.tag]);

      // Receive message exit
      self.process.on('exit', function(code, signal) {
        self.state = 'exited';
      });

      // Receive message exit
      self.process.on('close', function(code, signal) {});

      // Receive error message
      self.process.on('error', function(err) {
        self.state = 'error';
        reject(err);
      });

      resolve();
    });
  }
}

module.exports = LocalAgentProcess;
