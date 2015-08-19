"use strict"

var f = require('util').format,
  os = require('os'),
  es = require('event-stream'),
  stream = require('stream'),
  datasets = require('mongodb-datasets'),
  co = require('co'),
  Logger = require('../logger'),
  ScenarioManager =  require('../common/scenario_manager'),
  path = require('path'),
  dnode = require('dnode');

// Parse the passed in parameters
var yargs = require('yargs')
  .usage('Start a load creating process.\nUsage: $0')
  .describe('host', 'Host process is running on').default('host', 'localhost')
  .describe('port', 'Port process is running on').default('port', 52000)
  .describe('url', 'URL mongodb is running on').default('url', 'mongodb://localhost:27017/load?maxPoolSize=50')
  .describe('monitorHost', 'Host monitor process is running on').default('monitorHost', 'localhost')
  .describe('monitorPort', 'Port monitor process is running on').default('monitorPort', 51000)
// Get parsed arguments
var argv = yargs.argv
// List help
if(argv.h) return console.log(yargs.help())
// Scenarios Directory
var scenariosDirectory = path.resolve(__dirname, f('%s', '../common/scenarios'));

class Services {
  constructor(argv, agent, monitor) {
    this.argv = argv;
    this.agent = agent;
    this.monitor = monitor;
    // All the entries
    this.logEntries = {};
    // Current second timestamp
    this.currentSecondTimestamp = null;
    // Current minute timestamp
    this.currentMinuteTimestamp = null;
    // Current cache of operations
    this.opCacheEntriesMax = 500;
    this.opCache = [];
    // Total entries emitted
    this.totalEmitted = 0;
    // Total number logged
    this.logged = 0;
  }

  flush() {
    var self = this;

    // Return promise
    return new Promise(function(resolve, reject) {
      co(function*() {
        if(self.opCache.length == 0) return resolve();
        // Add to the list of totalEmitted
        self.totalEmitted += self.opCache.length;
        // Flush out any remaining operations
        self.monitor.log(self.opCache, function(err) {
          if(err) reject(err);
          self.opCache = [];
          resolve();
        });

        // Send the number of operation
        self.monitor.tick(self.opCache.length, self.agent, function() {})
      });
    });
  }

  status(options) {
    var self = this;

    // Return the promise
    return new Promise(function(resolve, reject) {
      self.monitor.status(options, function(err) {
        if(err) return reject(err);
        resolve();
      });
    }).catch(function(err) {
      console.log(err.stack);
    });
  }

  log(resolution, tag, object, options) {
    var self = this;
    options = options || {};
    // Set the counter
    self.logged = self.logged + 1;

    // Return the promise
    return new Promise(function(resolve, reject) {
      if(self.logEntries[tag] == null) self.logEntries[tag] = {};
      // Set a new second timestamp
      if(self.currentSecondTimestamp == null) {
        self.currentSecondTimestamp = new Date();
        self.currentSecondTimestamp.setMilliseconds(0);
      } else {
        var timestamp = new Date();
        timestamp.setMilliseconds(0);
        // If we have a new second adjust the current timestamp
        if(timestamp.getTime() > self.currentSecondTimestamp.getTime()) {
          self.currentSecondTimestamp = timestamp;
        }
      }

      // Add the current log statement
      if(self.logEntries[tag][self.currentSecondTimestamp.getTime()] == null) {
        self.logEntries[tag][self.currentSecondTimestamp.getTime()] = [];
      }

      // Push the logged item
      self.logEntries[tag][self.currentSecondTimestamp.getTime()].push(object);

      // Number of miliseconds
      var end = Math.round(object.end/1000);
      var endDate = new Date();
      endDate.setTime(end);
      endDate.setMilliseconds(0);

      // If we are done
      if(self.opCache.length < self.opCacheEntriesMax) {
        self.opCache.push({
            host: os.hostname(), port: self.argv.p, tag: tag
          , timestamp: endDate.getTime(), object: object
        });        
      } 

      // Emit the logged measurements
      if(self.opCache.length == self.opCacheEntriesMax) {
        // Add to the list of totalEmitted
        self.totalEmitted += self.opCache.length;
        
        // Send the entry to the monitor
        self.monitor.log(self.opCache, function(err) {
          resolve();
        });

        if(!options.noTick) {
          self.monitor.tick(self.opCache.length, self.agent, function() {})
        }

        // Clear out the opCache
        self.opCache = [];
      } else {
        resolve();
      }
    }).catch(function(err) {
      console.log(err.stack);
      reject(err);
    });
  }

  generateObjectFromTemplate(template) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var items = yield self.generateObjectsFromTemplate(template, 1);
        resolve(items[0]);
      });
    }).catch(function(err) {
      console.log(err.stack);
      reject(err);
    });
  }

  generateObjectsFromTemplate(template, number) {
    var self = this;

    return new Promise(function(resolve, reject) {
      // Create a readable stream to pipe into generator
      var s = new stream.Readable();
      s.push(template);
      s.push(null);

      // Generate the document
      s.pipe(datasets.createGeneratorStream({size: number}))
       .pipe(es.writeArray(function(err, array) {
         resolve(array);
       }));
    }).catch(function(err) {
      console.log(err.stack);
      reject(err);
    });
  }
}

class Agent {
  constructor(options) {
    // Setup the options
    this.host = options.host;
    this.port = options.port;
    this.url = options.url;
    this.monitorHost = options.monitorHost;
    this.monitorPort = options.monitorPort;
    // DNode instances
    this.server = null;
    this.monitor = null;
    this.services = null;
    // Scenario manager
    this.manager = new ScenarioManager(scenariosDirectory);
    // Var scenarios
    this.scenarios = null;
    // Set the logger
    this.logger = new Logger('EndPoint');
  }

  done(err) {
    var self = this;

    // Return promise
    return new Promise(function(resolve, reject) {
      co(function*() {
        // Flush the services
        yield self.services.flush();

        // Return the done signal
        self.monitor.done({
          // Arguments passed to the child
            argv: argv
          // Process pid
          , pid: process.pid
          // Provide the hostname
          , hostname: os.hostname()
        }, err, function() {
          resolve();
        });
      });
    });
  }

  start() {
    var self = this;

    // Connect to the monitor process
    var connectionAttemptToMonitor = function(self, callback) {
      // Attempt to connect to the monitor
      var d = dnode.connect(self.monitorPort, self.monitorHost);

      // Succesfully connected
      d.on('remote', function(remote) {
        self.monitor = remote;
        // Create the services
        self.services = new Services(argv, self, self.monitor);
        // Register the process with the monitor
        self.monitor.register({
          // Arguments passed to the child
            argv: argv
          // Process pid
          , pid: process.pid
          // Provide the hostname
          , hostname: os.hostname()
        }, callback);
      });

      // Connection error, attempt to reconnect
      d.on('error', function(err) {
        setTimeout(function() {
          connectionAttemptToMonitor(self, callback);
        }, 1000);
      });
    }

    var connectToMonitor = function(self) {
      return new Promise(function(resolve, reject) {
        co(function*() {
          connectionAttemptToMonitor(self, function() {
            resolve();
          })
        });
      });
    }

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Load the scenarios
        self.manager.load();
        // Set up the dnode
        self.server = dnode({
          setup: function(options, callback) {
            if(typeof options == 'function') callback = options, options = {};
            // Unpack the options
            self.resolutionMS = options.resolutionMS || 1000;
            self.scenarios = options.simulation;

            // Setup the scenarios
            co(function*() {
              // Get create objects
              self.scenarios = self.scenarios.map(function(x) {
                // Decorate the simulation with our MongoDB Url
                x.url = self.url
                // Create the instance
                x.instance = self.manager.find(x.name).create(self.services, x, x);
                // Find the actual scenario instance and create one
                return x;
              });

              // For each of the schemas run the setup
              for(var scenario of self.scenarios) {
                yield scenario.instance.setup();
              }

              callback();
            }).catch(function(err) {
              console.log(err.stack);
              callback(err);
            });
          },

          execute: function(options, callback) {
            if(typeof options == 'function') callback = options, options = {};
            co(function*() {
              // Scenarios
              var scenarios = [];
              // Build the scenarios to run from the passed in simulations
              for(var sim of options.simulation) {
                for(var s of self.scenarios) {
                  if(s.name == sim.name) {
                    scenarios.push(s);
                    break;
                  }
                }
              }

              // Execute the scenarios
              yield executeScenarios(self, scenarios, self.services);
              // Finish up
              callback();
            }).catch(function(err) {
              console.log(err.stack);
              callback(err)
            });
          },

          cancel: function(options, callback) {
            if(typeof options == 'function') callback = options, options = {};
            callback();
          },

          ping: function(options, callback) {
            if(typeof options == 'function') callback = options, options = {};
            callback();
          }
        });

        // Set up the node
        self.server.listen(self.port, self.host);

        // Attempt to connect to the monitor and keep trying until we have a connection
        yield connectToMonitor(self);

        // Finish startup
        resolve();
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    });
  }
}

/*
 * Executes the scenarios
 */
var executeScenarios = function(agent, scenarios, services) {
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Return immediatly
      resolve();
      // Number of scenarios left
      var left = scenarios.length;

      // Execute the scenarios
      for(var scenario of scenarios) {
        // Calculate the number of ticks
        if(scenario.instance.execute) {
          var iterations = scenario.execution.iterations;
          var numberOfUsers = scenario.execution.numberOfUsers;

          yield services.status({
            ops: iterations * numberOfUsers
          });
        }

        // Execute the scenario
        executeScenario(agent, scenario, function() {
          left = left - 1;

          // Done, perform the scenario teardown
          if(left == 0) {
            co(function*() {
              // Peform teardown
              for(var s of scenarios) {
                yield s.instance.teardown();
              }

              // Signal that we are done
              yield agent.done();
            }).catch(function(err) {
              co(function*() {
                yield agent.done(err);
              });
            });
          }
        });
      }
    }).catch(function(err) {
      console.log(err.stack);
      reject(err);
    });
  });
}

/*
 * Executes the scenario
 */
var executeScenario = function(agent, scenario, callback) {
  // Unpack the variables used in running the scenario
  scenario.execution = scenario.execution || { iteration: 25, numberOfUsers: 100 };
  // Unpack the fields
  var iterations = scenario.execution.iterations;
  var numberOfUsers = scenario.execution.numberOfUsers;
  var resolutionMS = agent.resolutionMS;
  var numberOfIterationsLeft = iterations * numberOfUsers;
  // We need to calculate the number of users pr. millisecond we need to execute
  var numberOfUsersPrTick = numberOfUsers/resolutionMS;
  // Current user
  var usersToExecute = 0;
  // Already executed stop
  var dead = false;
  // Promises to resolve
  var promises = [];

  // If we have a custom load generation method use that
  if(scenario.instance.custom) {
    co(function*() {
      yield scenario.instance.custom(agent);
      callback();
    });

    return;
  }

  // Execute method
  var executeMethod = function() {
    // Number of iterations are done
    if(numberOfIterationsLeft == 0 && dead ==false && promises.length == 0) {
      if(agent.logger.isDebug()) agent.logger.debug(f('[AGENT-%s:%s-%s] - done', agent.host, agent.port, process.pid));
      dead = true;
      return callback();
    } else if(numberOfIterationsLeft == 0 && dead && promises.length == 0) {
      return;
    } else if(numberOfIterationsLeft == 0 && promises.length > 0) {
      co(function*() {
        yield Promise.all(promises);
        callback();
      }).catch(function(err) {
        console.log(err.stack);
        callback(err);
      });
      
      promises = [];
      dead = true;
      return;
    }

    // Add to the number of usersToExecute
    usersToExecute += numberOfUsersPrTick;

    // Extract the total number of whole users
    var totalNumberOfUsers = Math.floor(usersToExecute);

    // We execute any left over users
    if(totalNumberOfUsers >= 1) {
      // Execute the number of users
      var usersLeft = totalNumberOfUsers;
      // Adjust the number of users to execute
      usersToExecute = usersToExecute - totalNumberOfUsers;

      // Execute method
      if(scenario.instance.execute) {
        // Execute numberOfUsersToExecute in parallel
        for(var i = 0; i < totalNumberOfUsers; i++) {
          scenario.instance.execute().then(function() {
            // Adjust the user left
            usersLeft = usersLeft - 1;

            // Adjust the number os iterations left
            if(usersLeft == 0) {
              numberOfIterationsLeft = numberOfIterationsLeft - 1;
              setTimeout(executeMethod, 1);
            }       
          }).catch(function(err) {
            if(agent.logger.isDebug()) agent.logger.debug(f('[AGENT-%s:%s-%s] - scenario error with [%s]', agent.host, agent.port, process.pid, err.stack));
            // Adjust the user left
            usersLeft = usersLeft - 1;

            // Adjust the number os iterations left
            if(usersLeft == 0) {
              numberOfIterationsLeft = numberOfIterationsLeft - 1;
              setTimeout(executeMethod, 1);
            }
          });
        }
      }
    } else {
      setTimeout(executeMethod, 1);
    }
  }  

  // Interval for execution
  // var intervalId = setInterval(, 1);
  setTimeout(executeMethod, 1);
}

// Create the agent
co(function*() {
  var agent = new Agent(argv);
  yield agent.start();
});
