"use strict"

var f = require('util').format,
  os = require('os'),
  es = require('event-stream'),
  stream = require('stream'),
  datasets = require('mongodb-datasets'),
  co = require('co'),
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
  constructor(argv, monitor) {
    this.argv = argv;
    this.monitor = monitor;
    // All the entries
    this.logEntries = {};
    // Current second timestamp
    this.currentSecondTimestamp = null;
    // Current minute timestamp
    this.currentMinuteTimestamp = null;
    // Current cache of operations
    this.opCacheEntriesMax = 10;
    this.opCache = [];
  }

  log(resolution, tag, object) {
    if(this.logEntries[tag] == null) this.logEntries[tag] = {};
    // Set a new second timestamp
    if(this.currentSecondTimestamp == null) {
      this.currentSecondTimestamp = new Date();
      this.currentSecondTimestamp.setMilliseconds(0);
    } else {
      var timestamp = new Date();
      timestamp.setMilliseconds(0);
      // If we have a new second adjust the current timestamp
      if(timestamp.getTime() > this.currentSecondTimestamp.getTime()) {
        this.currentSecondTimestamp = timestamp;
      }
    }

    // Add the current log statement
    if(this.logEntries[tag][this.currentSecondTimestamp.getTime()] == null) {
      this.logEntries[tag][this.currentSecondTimestamp.getTime()] = [];
    }

    // Push the logged item
    this.logEntries[tag][this.currentSecondTimestamp.getTime()].push(object);

    // Number of miliseconds
    var end = Math.round(object.end/1000);
    var endDate = new Date();
    endDate.setTime(end);
    endDate.setMilliseconds(0);

    // If we are done
    if(this.opCache.length < this.opCacheEntriesMax) {
      this.opCache.push({
          host: os.hostname(), port: this.argv.p, tag: tag
        , timestamp: endDate.getTime(), object: object
      });
    } else if(this.opCache.length == this.opCacheEntriesMax) {
      // Send the entry to the monitor
      this.monitor.log(this.opCache, function(err) {});
      this.opCache = [];
    }
  }

  generateObjectFromTemplate(template, callback) {
    this.generateObjectsFromTemplate(template, 1, function(err, items) {
      callback(null, items[0]);
    });
  }

  generateObjectsFromTemplate(template, number, callback) {
    // Create a readable stream to pipe into generator
    var s = new stream.Readable();
    s.push(template);
    s.push(null);

    // Generate the document
    s.pipe(datasets.createGeneratorStream({size: number}))
     .pipe(es.writeArray(function(err, array) {
       callback(null, array);
     }));
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
    // Simulation

    // Var scenarios
    this.scenarios = null;
  }

  done(err) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
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
        self.services = new Services(argv, self.monitor);
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
              callback(err);
            });
          },

          execute: function(options, callback) {
            if(typeof options == 'function') callback = options, options = {};
            co(function*() {
              // Execute the scenarios
              yield executeScenarios(self, self.scenarios);
              // Finish up
              callback();
            }).catch(function(err) {
              callback(err)
            });
          },

          cancel: function(options, callback) {
            console.log("--------------------------------------- agent cancel")
            if(typeof options == 'function') callback = options, options = {};
            callback();
          },

          ping: function(options, callback) {
            // console.log("--------------------------------------- agent ping")
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
      }).catch(reject);
    });
  }
}

/*
 * Executes the scenarios
 */
var executeScenarios = function(agent, scenarios) {
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Return immediatly
      resolve();
      // Number of scenarios left
      var left = scenarios.length;

      // Execute the scenarios
      for(var scenario of scenarios) {
        executeScenario(agent, scenario, function() {
          left = left - 1;
          console.log("++++++++++++++++++++++++++++++++++++++++++++ DONE 0 :: " + left)

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
    }).catch(reject);
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
  var currentUser = 0;

  // We need to calculate the number of users per second
  var usersPrMs = numberOfUsers / agent.resolutionMS;
  var numberOfIterationsLeft = iterations * agent.resolutionMS;

  // Execute a tick
  var executeTick = function() {
    // Adjust the number os iterations left
    numberOfIterationsLeft = numberOfIterationsLeft - 1;
    // Number of users to execute
    var numberOfUsersToExecute = numberOfUsers;

    // If we have less than a user for the ms
    if(usersPrMs < 1) {
      currentUser = currentUser + usersPrMs;

      // Is the current user >= 1 then it's time to execute a single user
      if(currentUser >= 1) {
        numberOfUsersToExecute = 1;
        currentUser = 0;
      } else {
        // Send a tick for each full iteration
        if(numberOfIterationsLeft % agent.resolutionMS == 0) {
          // Send a tick to the monitor for progress
          return agent.monitor.tick({}, function() {
            setTimeout(executeTick, 1);
          });
        }

        // It's not yet time to execute a user
        return setTimeout(executeTick, 1);
      }
    }

    // Execute the number of users
    var usersLeft = numberOfUsersToExecute;

    // Execute numberOfUsersToExecute in parallel
    for(var i = 0; i < numberOfUsersToExecute; i++) {
      scenario.instance.execute().then(function() {
        usersLeft = usersLeft - 1;
        // Done executing in parallel
        if(usersLeft == 0) {
          // We are done with the execution
          if(numberOfIterationsLeft == 0) {
            console.log(f('[AGENT-%s:%s-%s] - done', agent.host, agent.port, process.pid));
            return callback();
          }

          // Send a tick for each full iteration
          if(numberOfIterationsLeft % agent.resolutionMS == 0) {
            // Send a tick to the monitor for progress
            return agent.monitor.tick({}, function() {
              setTimeout(executeTick, 1);
            });
          }

          // Perform next iteration
          setTimeout(executeTick, 1);
        }
      }).catch(function(err) {
        console.log(f('[AGENT-%s:%s-%s] - scenario error with [%s]', agent.host, agent.port, process.pid, err.stack));
        usersLeft = usersLeft - 1;
        // Done executing in parallel
        if(usersLeft == 0) {
          // We are done with the execution
          if(numberOfIterationsLeft == 0) {
            console.log(f('[AGENT-%s:%s-%s] - done', agent.host, agent.port, process.pid));
            return callback();
          }

          // Send a tick for each full iteration
          if(numberOfIterationsLeft % agent.resolutionMS == 0) {
            // Send a tick to the monitor for progress
            return agent.monitor.tick({}, function() {
              setTimeout(executeTick, 1);
            });
          }

          // Perform next iteration
          setTimeout(executeTick, 1);
        }
      });
    }
  }

  // Set the interval
  setTimeout(executeTick, 1)
}

// Create the agent
co(function*() {
  var agent = new Agent(argv);
  yield agent.start();
});
