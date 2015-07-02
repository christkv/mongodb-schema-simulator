"use strict";

var co = require('co'),
  f = require('util').format,
  fs = require('fs'),
  path = require('path'),
  mkdirp = require('mkdirp'),
  rimraf = require('rimraf'),
  levelup = require('levelup'),
  dnode = require('dnode'),
  JSONStream = require('JSONStream'),
  MongoClient = require('mongodb').MongoClient,
  EventEmitter = require('events').EventEmitter,
  ServerMonitor = require('./server_monitor'),
  LocalAgents = require('./agent/local_agents'),
  ScenarioManager = require('./common/scenario_manager');

// Scenarios Directory
var scenariosDirectory = path.resolve(__dirname, f('%s', './common/scenarios'));

/*
 * Monitors the load process
 */
class Monitor extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.options = options;
    // Host and port of the monitor
    this.host = options.host || 'localhost';
    this.port = options.port || 51000;
    // MongoDB url
    this.url = options.url || 'mongodb://localhost:27017/load?maxPoolSize=50';
    // Server monitor
    this.serverMonitor = new ServerMonitor({url: this.url});
    // Host and port of the agents
    this.agentStartPort = options.agentStartPort || 52000;
    // Set up the monitor end point
    this.endPoint = new EndPoint(this, options);
    //
    // LOCAL AGENT SETTINGS
    // Are we running local agents
    this.runningLocalAgents = typeof options.runningLocalAgents == 'boolean'
      ? options.runningLocalAgents
      : true;
    // Host and port of the agents
    this.agentStartPort = options.agentStartPort || 52000;
    // If we are running set of local agents set it up
    this.localAgentsProcesses = null;
    //
    // Scenario file running
    this.simulationPath = options.simulationPath;
    // Scenario manager
    this.manager = new ScenarioManager(scenariosDirectory);
    // Current simulation
    this.simulation = null;
    // Current resolution
    this.resolutionMS = 1000;
    // Output directory
    this.output = options.output || './out';
    // Set the start time
    this.startTimeMS = null;
    this.endTimeMS = null;
    // Number of agents to boot up
    this.number = options.number || 2;
    // Contains the output data streams
    this.outputStreams = {};
    // Output data files
    this.ouputDataFiles = {};
  }

  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var id = 1;
        // Read all scenario files
        self.manager.load();
        // Attempt to read the simulation file
        self.simulation = require(self.simulationPath);

        // Add listener to server Process
        self.serverMonitor.on('data', function(result) {
          if(self.outputStreams[result.name] == null) {
            self.outputStreams[result.name] = {};
          }

          if(self.outputStreams[result.name][result.server] == null) {
            self.outputStreams[result.name][result.server] = [];
          }

          self.outputStreams[result.name][result.server].push(JSON.stringify(result));
        });

        // Start the server monitor
        yield self.serverMonitor.start();
        // Boot up the monitor end point
        yield self.endPoint.start();
        // Are we runnign local agent
        if(self.runningLocalAgents) {
          self.localAgentsProcesses = new LocalAgents(self.options);
          yield self.localAgentsProcesses.start();
        }

        resolve();
      }).catch(reject);
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Stop the server monitor
        yield self.serverMonitor.stop();

        // Stop local agents
        for(var agent of self.agents) {
          yield agent.stop();
        }

        // If we have local agents stop them
        if(self.localAgentsProcesses) {
          yield self.localAgentsProcesses.stop();
        }

        // Set the endTime
        self.endTimeMS = new Date().getTime();

        // Add to the report object
        var report = {
          // Schemas run
          report: self.simulation,
          // Runtime information
          runtime: {
            startTimeMS: self.startTimeMS,
            endTimeMS: self.endTimeMS,
            processes: self.number
          },
          topologyData: self.outputStreams
        }

        // Flust out the report to the output directory
        fs.writeFileSync(f('%s/report.json', self.output),
          JSON.stringify(report, null, 2),
          'utf8');

        // Let files finish flushing
        setTimeout(function() {
          // Emit it
          self.emit('done');
          // Done
          resolve();
        }, 1000);
      }).catch(function(err) {
        console.log(err.stack)
        reject();
      });
    });
  }

  execute(agents) {
    var self = this;

    // Global setup for the scenarios
    var globalSetup = function(scenarios) {
      return new Promise(function(resolve, reject) {
        co(function*() {
          // Connect to mongodb
          var db = yield MongoClient.connect(self.url, {
            server: {poolSize:1}
          });

          // For each simulation execute the global setup
          for(var simulation of scenarios) {
            var instance = simulation.db ? db.db(simulation.db) : db;
            yield simulation.setup(instance)
          }

          // Create instances to run global setup against
          var objects = scenarios.map(function(x) {
            // Decorate the simulation with our MongoDB Url
            x.url = self.url
            // Find the actual scenario instance and create one
            return self.manager.find(x.name).create({}, x, x);
          });

          // For each of the schemas run the setup
          for(var scenario of objects) {
            yield scenario.globalSetup();
          }

          db.close();
          resolve();
        }).catch(reject);
      });
    }

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Execute global setup for each scenario
        yield globalSetup(self.simulation);
        // Save the list of available agents
        self.agents = agents;
        // Start the agents
        for(var agent of self.agents) {
          yield agent.start();
          yield agent.setup({
            resolutionMS: self.resolutionMS,
            simulation: self.simulation
          });
          yield agent.execute({
            resolutionMS: self.resolutionMS,
            simulation: self.simulation
          });
        }

        // Set the start time
        self.startTimeMS = new Date().getTime();
        // Finish up
        resolve();
      }).catch(reject);
    });
  }
}

/*
 * DNode endpoint
 */
class EndPoint {
  constructor(monitor, options) {
    this.monitor = monitor;
    this.options = options;
    this.server = null;

    // Host and port of the monitor
    this.host = options.host || 'localhost';
    this.port = options.port || 51000;
    // Number of agents needed before starting
    this.number = options.number || 2;
    // Number of available agents
    this.agents = [];
    // Level db id Incrementing
    this.levelUpId = 1;
    // Level db for the monitor
    this.db = null;
    // Output directory
    this.output = options.output || './out';
  }

  start() {
    var self = this;
    var left = self.number;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Destroy level db
        rimraf.sync(f('%s/db', self.output));
        self.db = levelup(f('%s/db', self.output));

        // Set up dnode endpoint
        self.server = dnode({
          register: function(agent, callback) {
            co(function*() {
              // Save the agent information
              self.agents.push(new Agent(agent));
              // Callback
              callback();
              // We have enough agents, execute
              if(self.number == self.agents.length) {
                yield self.monitor.execute(self.agents);
              }
            });
          },

          log: function(measurements, callback) {
            // console.log("==================================== monitor log")
            var ops = measurements.map(function(x) {
              return {type: 'put', key: self.levelUpId++, value: JSON.stringify(x)};
            });

            self.db.batch(ops, callback);
          },

          tick: function(agent, callback) {
            // console.log("==================================== monitor tick")
            callback();
          },

          done: function(agent, err, callback) {
            co(function*() {
              callback();
              // Countdown
              left = left - 1;
              // Are we done, then wrap up and stop
              if(left == 0) {
                // Stop the end point
                yield self.stop()
                // Stop the monitor
                yield self.monitor.stop();
              }
            });
          }
        });

        self.server.listen(self.port, self.host);
        resolve();
      }).catch(reject);
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        console.log(f('[MONITOR] - stopping monitor server'));
        // Flush levelup db
        self.db.close(function() {
          // Stop the server
          self.server.destroy();
          console.log(f('[MONITOR] - stopping topology monitoring'));
          resolve();          
        });
      }).catch(reject);
    });
  }
}

class Agent {
  constructor(options) {
    this.options = options;
    // Contains the node
    this.agent = null;
    // IntervalId
    this.intervalIds = null;
  }

  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Get the host and port
        self.host = self.options.argv.host;
        self.port = self.options.argv.port;

        // Connect using dnode
        self.connection = dnode.connect(self.port, self.host);
        self.connection.on('remote', function(remote) {
          self.agent = remote;
          // Set up the interval Id to ping the servers
          self.intervalId = setInterval(function() {
            self.agent.ping(function() {});
          }, 1000);

          resolve();
        });

        // Reject the connection
        self.connection.on('error', reject);
      }).catch(reject);
    });
  }

  setup(simulation) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Execute the agents setup
        self.agent.setup(simulation, function(err) {
          if(err) return reject(err);
          resolve();
        });
      }).catch(reject);
    });
  }

  execute(simulation) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Execute the agents setup
        self.agent.execute(simulation, function(err) {
          if(err) return reject(err);
          resolve();
        });
      }).catch(reject);
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Clear the intervalId
        clearInterval(self.intervalId);
        // Kill the remote connection
        console.log(f('[MONITOR-AGENT] - stopping connection to agent at %s:%s', self.host, self.port));
        self.connection.destroy();
        console.log(f('[MONITOR-AGENT] - connection stopped to agent at %s:%s', self.host, self.port));
        resolve();
      }).catch(reject);
    });
  }
}

mkdirp.sync('./out');

co(function*() {
  var monitor = new Monitor({
    simulationPath: f('%s/../examples/simulations/queue_fifo_simulation.js', __dirname),
    url: 'mongodb://localhost:31000,localhost:31001/load?maxPoolSize=50'
  });
  // Wait for done event
  monitor.on('done', function() {
    process.exit(0);
  })
  // Start the monitor
  yield monitor.start();
});
