var cp = require('child_process')
  , f = require('util').format
  , fs = require('fs')
  , co = require('co')
  , inherits = require('util').inherits
  , LocalAgentProcess = require('./local_agent')
  , RemoteAgentProcess = require('./remote_agent')
  , ServerMonitor = require('./server_monitor')
  , MongoClient = require('mongodb').MongoClient
  , EventEmitter = require('events').EventEmitter
  , JSONStream = require('JSONStream')
  , BasicReport = require('./reports/basic_report');

var timeoutPromise = function(timeout) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve();
    }, timeout);
  }).catch(function(err) {
    reject(err);
  });
}

/*
 * Monitor that coordinates all the child processes
 */
class Process extends EventEmitter {
  constructor() {
    super();

    this.argv = argv;
    this.manager = manager;
    this.children = [];

    // Execution state
    this.registeredChildrenCount = 0;
    this.processesDoneCount = 0;
    this.results = [];
    this.errors = [];

    // Start and end
    this.startTime = null;
    this.endTime = null;

    // Services
    this.services = {};

    // The scenario file
    var file = f('%s/%s', process.cwd(), this.argv.s);

    // Load the passed in scenario
    this.scenario = require(file);

    // Create the Server Monitor instance
    this.serverProcess = new ServerMonitor(argv.url, 1000);

    // Contains the output data streams
    this.outputStreams = {};

    // Output data files
    this.ouputDataFiles = {};
  }

  /*
   * Reset process monitor runstate
   */
  reset() {
    this.processesDoneCount = 0;
  }

  /*
   * Start the monitor
   */
  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Default child port
        var port = self.argv['local-process-port'];
        var url = self.argv['local-process-url'];

        // Db url
        var dataUrl = self.argv['d'];

        // Load the scenario file
        var schemas = require(f('%s/%s', process.cwd(), self.argv.s));
        var numberOfProcesses = self.argv.n;

        // Calculate the total number of executions
        var totalExecutions = 0;
        var id = 0;

        // For each schema calculate the total
        for(var i = 0; i < schemas.length; i++) {
          var dist = schemas[i].execution;

          // Override with default values if not provided
          dist.iterations = dist.iterations || 25;
          dist.resolution = dist.resolution || 1000;
          dist.numberOfUsers = dist.numberOfUsers || 100;
          dist.delay = dist.delay || 0;
          dist.type = dist.type || 'linear';
          dist.tickExecutionStrategy = dist.tickExecutionStrategy || 'slicetime';

          // Calculate total number of executions needed
          totalExecutions += (dist.iterations * dist.numberOfUsers * numberOfProcesses);
        }

        // Not running in local mode
        if(self.argv.r) return resolve({totalExecutions:totalExecutions});

        // Add listener to server Process
        self.serverProcess.on('data', function(result) {
          if(self.outputStreams[result.name] == null) {
            var stream = JSONStream.stringifyObject('{\n', '\n,\n', '\n}\n');
            // Output file name
            var filename = f('%s/%s.json', self.argv.o, result.name);
            // Create writeable stream
            var file = fs.createWriteStream(filename);
            stream.pipe(file);

            // Save the stream
            self.outputStreams[result.name] = {
                filename: filename
              , stream: stream
            }
          }

          // Write to the file
          self.outputStreams[result.name].stream.write([(id++).toString(), result]);
        });

        // Start the server monitor
        yield self.serverProcess.start();

        // If we are running local processes, start all local child processes
        if(self.argv.r == false) {
          // Kick off the processes
          for(var i = 0; i < self.argv.n; i++) {
            // Create a new controlling wrapper
            var child = new LocalAgentProcess(f('child_%s', i), url, self.argv.p, port++);
            // Save the child to the list of children
            self.children.push(child);
            // Start the child
            yield child.start();
          }
        }

        // Return
        resolve({totalExecutions: totalExecutions});
      }).catch(function(err) { reject(err); });
    });
  }

  error(errs) {
    var self = this;
    var finalErrors = {};

    for(var j = 0; j < errs.length; j++) {
      var errors = errs[j];
      // De duplicate errors
      for(var i = 0; i < errors.length; i++) {
        if(finalErrors[errors[i].errmsg] == null) {
          finalErrors[errors[i].errmsg] = errors[i]
        }
      }
    }

    // Create final array
    var doneErrors = [];
    for(var name in finalErrors) {
      doneErrors.push(finalErrors[name]);
    }

    // Print out error
    console.log(f('[MONITOR] client signaled error %s', JSON.stringify(doneErrors)));
    this.emit('error', doneErrors);

    // Update number of processes done
    this.processesDoneCount = this.processesDoneCount + 1;

    // Are we done ?
    if(this.processesDoneCount == this.children.length) {
      self.endTime = new Date();
      self.emit('complete', self.logEntries);
    }
  }

  done(results) {
    console.log(f('[MONITOR] client signaled done from child process %s:%s', results.host, results.port));
    // Unpack the results
    var host = results.host;
    var port = results.port;
    var self = this;

    // Get the scenario file
    var scenarioFile = self.argv.s.split('/').pop();

    // Create a file and write it out
    var filename = f('%s/%s.json', self.argv.o, f('%s_%s_%s', scenarioFile, results.host, results.port));

    // Add to output files
    this.ouputDataFiles[filename] = {
        type: 'scenario'
      , schemas: results.schemas
    }

    // Write to disk
    fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf8');

    // Update number of processes done
    this.processesDoneCount = this.processesDoneCount + 1;

    // Are we done ?
    if(this.processesDoneCount == this.children.length) {
      self.endTime = new Date();
      self.emit('complete', self.logEntries);
    }
  }

  report() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        yield new BasicReport(self, f('%s/%s', self.argv.o, 'report.json')).execute();
        resolve();
      }).catch(function(err) { reject(err); });
    });
  }

  stop(signal) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        if(typeof signal == 'function') callback = signal, signal = 'SIGTERM';
        var left = self.children.length;

        // No children return
        if(self.children.length == 0) return resolve();

        // Stop all the children
        for (var i = self.children.length - 1; i >= 0; i--) {
          yield self.children[i].stop(signal);
        };

        // Stop the server monitor
        yield self.serverProcess.stop();
        // Filenames
        var filenames = {}

        // Close all write streams
        for(var name in self.outputStreams) {
          self.outputStreams[name].stream.end();
          self.ouputDataFiles[self.outputStreams[name].filename] = {
            type: 'topology'
          };
        }

        // Report object
        var reportObject = {
            report: self.ouputDataFiles
          , startTimeMS: self.startTime.getTime()
          , endTimeMS: self.endTime.getTime()
        }

        // Wait for 5000 miliseconds
        yield timeoutPromise(5000);
        // Need to write all the data out
        fs.writeFileSync(f('%s/%s', self.argv.o, 'report.json'), JSON.stringify(reportObject, null, 2), 'utf8');
        // Return
        resolve();
      }).catch(function(err) { reject(err); });
    });
  }

  register(client) {
    var found = false
    // We have enough children ignore any more incoming clients
    if(this.registeredChildrenCount == this.argv.n) return;
    console.log(f('[MONITOR] register execution process node %s:%s', client.hostname, client.argv.p));

    // Locate the matching child (if we have one)
    for(var i = 0; i < this.children.length; i++) {
      var child = this.children[i];

      if(child.tag == client.argv.t) {
        child.registerInfo = client;
        found = true;
        break;
      }
    }

    // If not found register a remote child
    if(!found) {
      var remoteProcess = new RemoteAgentProcess();
      remoteProcess.registerInfo = client;
      this.children.push(remoteProcess);
    }

    // Registered another child
    this.registeredChildrenCount = this.registeredChildrenCount + 1;
    // Do we have enough workers execute them
    if(this.registeredChildrenCount == this.argv.n) return this.execute();
  }

  execute() {
    console.log(f("[MONITOR] starting execution of provided scenario %s", this.argv.s));
    var file = f('%s/%s', process.cwd(), this.argv.s);
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Load the passed in scenario
        var scenario = self.scenario;
        var errors = [];
        var results = null;
        var left = self.children.length;

        // Save the start time
        self.startTime = new Date();

        // Perform scenario setup
        yield scenarioSetup(self, scenario);

        // Call each child with the executor
        // Execute the scenario on the child process
        for(var i = 0; i < self.children.length; i++) {
          results = yield self.children[i].execute(scenario, {});
        }

        resolve(results);
      }).catch(function(err) { reject(err); });
    });
  }
}

var scenarioSetup = function(self, schemas) {
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Connect to mongodb
      var db = yield MongoClient.connect(self.argv.url, {
          server: { poolSize: 1 }
        , replSet: { poolSize: 1 }
        , mongos: { poolSize: 1 }
      });

      // How many schemas are left
      var left = schemas.length;
      var errors = [];

      // Execute the global schema setup
      var setupSchema = function(schema) {
        return new Promise(function(resolve, reject) {
          co(function())
            console.log(f('[MONITOR] execute global scenarios setup for scenario %s %s', schema.name, JSON.stringify(schema.params)));
            // Fetch the scenario class
            var object = self.manager.find(schema.name);
            // No scenario found return an error
            if(!object) return callback(new Error(f('could not find scenario instance for %s', schema.name)));

            // Validate that all paramters are valid
            for(var name in schema.params) {
              if(!object.params[name]) return callback(new Error(f('scenario %s does not support the parameter %s', schema.name, name)));
            }

            // Ensure we run against the right db
            if(schema.db) db = db.db(schema.db);

            // Add the url to the schema
            schema.url = self.argv.url;

            // Execute setup
            if(typeof schema.setup == 'function') {
              yield schema.setup(db);
              // Initiate an instance and call it
              yield object.create(self.services, schemas, schema).globalSetup();
            } else {
              // Initiate an instance and call it
              yield object.create(self.services, schemas, schema).globalSetup();
            }
          }).catch(function(err) { reject(err); });
        });
      }

      // Iterate over all the schemas
      for(var i = 0; i < schemas.length; i++) {
        yield = setupSchema(schemas[i]);
      }

      resolve();
    }).catch(function(err) { reject(err); });
  });
}

module.exports = Process;
