var co = require('co')
  , dnode = require('dnode');

/*
 * Agent class
 */
class Agent {
  constructor(options) {
    this.monitorHost = options.monitorHost || 'localhost';
    this.monitorPort = options.monitorPort || 51000;
    this.host = options.port || 'localhost';
    this.port = options.port || 52000;
    // State
    this.monitor = null;
    this.server = null;
  }

  start() {
    var self = this;
    // Attempt to connect
    return new Promise(function(resolve, reject) {
      // Create our agent endpoint
      self.server = dnode(new Server(self));
      self.server.listen(self.port, self.port);

      // Attempt to connect to the monitor
      connectToMonitor(self, function() {
        self.monitor.register({

        }, function(err) {
          if(err) return reject(err);
          resolve();
        });
      }, reject);
    });
  }
}

/*
 * Server instance
 */
class Server {
  constructor(agent) {
    this.agent = agent;
  }

  setup(options, callback) {
  }

  execute(options, callback) {
  }
}

var connectToMonitor = function(self, resolve, reject) {
  // Attempt to register
  self.monitor = dnode.connect(self.monitorHost, self.monitorPort);
  self.monitor.on('remote', function() {
    console.log(f('[AGENT] connected successfully to remote monitor at %s:%s', self.monitorHost, self.monitorPort));
    resolve();
  });

  // Retry to connect
  self.monitor.on('error', function() {
    console.log(f('[AGENT] failed to connect to remote monitor at %s:%s', self.monitorHost, self.monitorPort));
    setTimeout(function() {
      connectToMonitor(self, resolve, reject);
    }, 1000);
  });
}
