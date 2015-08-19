"use strict";

var co = require('co'),
  f = require('util').format,
  fs = require('fs'),
  path = require('path'),
  mkdirp = require('mkdirp'),
  rimraf = require('rimraf'),
  levelup = require('levelup'),
  dnode = require('dnode'),
  Logger = require('./logger'),
  MongoClient = require('mongodb').MongoClient,
  EventEmitter = require('events').EventEmitter,
  TopologyMonitor = require('./topology_monitor'),
  LocalAgents = require('./agent/local_agents'),
  ScenarioManager = require('./common/scenario_manager');

// Scenarios Directory
var scenariosDirectory = path.resolve(__dirname, f('%s', './common/scenarios'));

// Clone the options
var clone = function(o) {
  var object = {};

  for(var name in o) {
    object[name] = o[name];
  }

  return object;
}


/*
 * Monitors the load process
 */
class Monitor extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    // Clone the options
    options = clone(options);
    // Set the logger
    this.logger = new Logger('Monitor');
    // Options
    this.options = options;
    // Host and port of the monitor
    this.host = options.host || 'localhost';
    this.port = options.port || 51000;
    // MongoDB url
    this.url = options.url || 'mongodb://localhost:27017/load?maxPoolSize=50';
    // Server monitor
    this.TopologyMonitor = new TopologyMonitor({url: this.url});
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
        if(self.logger.isInfo()) self.logger.info('starting monitor');
        var id = 1;
        // Read all scenario files
        self.manager.load();
        // Attempt to read the simulation file
        self.simulation = require(self.simulationPath);

        // Add listener to server Process
        self.TopologyMonitor.on('data', function(result) {
          if(self.outputStreams[result.name] == null) {
            self.outputStreams[result.name] = {};
          }

          if(self.outputStreams[result.name][result.server] == null) {
            self.outputStreams[result.name][result.server] = [];
          }

          self.outputStreams[result.name][result.server].push(JSON.stringify(result));
        });

        if(self.logger.isInfo()) self.logger.info('starting topology monitor');
        // Start the server monitor
        yield self.TopologyMonitor.start();
        if(self.logger.isInfo()) self.logger.info('topology monitor successfully started');
        if(self.logger.isInfo()) self.logger.info('starting monitor endpoint');
        // Boot up the monitor end point
        yield self.endPoint.start();
        if(self.logger.isInfo()) self.logger.info('monitor endpoint successfully started');

        // if we are running x number of simulations we will be running n * x number of processes
        if(self.simulation.length > 1) {
          self.number = self.number * self.simulation.length;
          self.options.number = self.options.number * self.simulation.length;
        }

        // Are we runnign local agent
        if(self.runningLocalAgents) {
          if(self.logger.isInfo()) self.logger.info('running local agent processes');
          self.localAgentsProcesses = new LocalAgents(self.options);
          yield self.localAgentsProcesses.start();
        }

        if(self.logger.isInfo()) self.logger.info('monitor started successfully');
        resolve();
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Stop the server monitor
        yield self.TopologyMonitor.stop();

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
          if(self.logger.isInfo()) self.logger.info(f('execute - connect to mongodb at %s', self.url));
          // Connect to mongodb
          var db = yield MongoClient.connect(self.url, {
            server: {poolSize:1}
          });

          // For each simulation execute the global setup
          for(var simulation of scenarios) {
            var instance = simulation.db ? db.db(simulation.db) : db;
            if(self.logger.isInfo()) self.logger.info(f('execute - perform scenario setup for [%s]', simulation.name));
            yield simulation.setup(instance)
          }

          // Simulation global setup done
          if(self.logger.isInfo()) self.logger.info(f('execute - scenario setup for [%s] executed successfully', simulation.name));

          // Create instances to run global setup against
          var objects = scenarios.map(function(x) {
            // Decorate the simulation with our MongoDB Url
            x.url = self.url
            // Find the actual scenario instance and create one
            return self.manager.find(x.name).create({}, x, x);
          });

          // Simulation global setup done
          if(self.logger.isInfo()) self.logger.info(f('successfully created instances of schemas for simulation'));

          // For each of the schemas run the setup
          for(var scenario of objects) {
            if(self.logger.isInfo()) self.logger.info(f('execute globalSetup for scenario'));
            yield scenario.globalSetup();
          }

          if(self.logger.isInfo()) self.logger.info(f('successfully executed global setup for scenarios'));

          db.close();
          resolve();
        }).catch(function(err) {
          console.log(err.stack);
          reject(err);
        });
      });
    }

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Execute global setup for each scenario
        yield globalSetup(self.simulation);
        
        // Save the list of available agents
        self.agents = agents;

        // Index for the sim
        var index = 0;

        // Start the agents
        for(var agent of self.agents) {
          if(self.logger.isInfo()) self.logger.info(f('start agent at %s:%s', agent.options.argv.host, agent.options.argv.port));
          // Start the agent
          yield agent.start();
          if(self.logger.isInfo()) self.logger.info(f('agent at %s:%s started successfully', agent.options.argv.host, agent.options.argv.port));
          
          // Run the setup on the agent
          yield agent.setup({
            resolutionMS: self.resolutionMS,
            simulation: self.simulation
          });
          
          if(self.logger.isInfo()) self.logger.info(f('agent setup at %s:%s succeeded', agent.options.argv.host, agent.options.argv.port));
        }

        // Emit starting execution
        self.emit('execute');

        // Start executing       
        for(var agent of self.agents) {
          if(self.logger.isInfo()) self.logger.info(f('signal start executing scenarios on agent at %s:%s', agent.options.argv.host, agent.options.argv.port));

          // Get the index
          index = index % self.simulation.length;
          // Get the sim
          var sim = self.simulation[index++];

          // Execute the scenario using the agent
          yield agent.execute({
            resolutionMS: self.resolutionMS,
            simulation: [sim]
          });           

          if(self.logger.isInfo()) self.logger.info(f('signaling start executing scenarios on agent at %s:%s succeeded', agent.options.argv.host, agent.options.argv.port));
        }

        // Set the start time
        self.startTimeMS = new Date().getTime();
        // Finish up
        resolve();
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
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
    // Set the logger
    this.logger = new Logger('EndPoint');
  }

  start() {
    var self = this;
    var left = self.number;

    return new Promise(function(resolve, reject) {
      co(function*() {
        if(self.logger.isInfo()) self.logger.info(f('monitor endPoint starting on port [%s]', self.port));

        // Destroy level db
        rimraf.sync(f('%s/db', self.output));
        if(self.logger.isInfo()) self.logger.info(f('destroying level db at [%s/db]', self.output));
        self.db = levelup(f('%s/db', self.output));
        if(self.logger.isInfo()) self.logger.info(f('created new level db file at [%s/db]', self.output));

        // Set up dnode endpoint
        self.server = dnode({
          register: function(agent, callback) {
            co(function*() {
              if(self.logger.isInfo()) self.logger.info(f('agent registered at [%s]', JSON.stringify(agent)));
              // Save the agent information
              self.agents.push(new Agent(agent));
              // Callback
              callback();
              // We have enough agents, execute
              if(self.number == self.agents.length) {
                if(self.logger.isInfo()) self.logger.info(f('schema execution starting'));
                yield self.monitor.execute(self.agents);
              }
            });
          },

          status: function(ops, callback) {
            self.monitor.emit('status', ops);
            callback();
          },

          log: function(measurements, callback) {
            var ops = measurements.map(function(x) {
              return {type: 'put', key: self.levelUpId++, value: JSON.stringify(x)};
            });

            self.db.batch(ops, callback);
          },

          tick: function(ticks, agent, callback) {
            // Emit the measurements
            self.monitor.emit('tick', ticks);
            // Callback
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
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        if(self.logger.isInfo()) self.logger.info(f('stopping monitor server'));
        // Flush levelup db
        self.db.close(function() {
          // Stop the server
          self.server.destroy();
          if(self.logger.isInfo()) self.logger.info(f('stopping topology monitoring'));
          resolve();
        });
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
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
    // Set the logger
    this.logger = new Logger('Agent');
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
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
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
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
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
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Clear the intervalId
        clearInterval(self.intervalId);
        // Kill the remote connection
        if(self.logger.isInfo()) self.logger.info(f('stopping connection to agent at %s:%s', self.host, self.port));
        self.connection.destroy();
        if(self.logger.isInfo()) self.logger.info(f('connection stopped to agent at %s:%s', self.host, self.port));
        resolve();
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    });
  }
}

module.exports = Monitor;
