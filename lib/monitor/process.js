var cp = require('child_process')
  , f = require('util').format
  , dnode = require('dnode')
  , fs = require('fs')
  , ejs = require('ejs')
  , inherits = require('util').inherits
  , LocalAgentProcess = require('./local_agent')
  , ServerMonitor = require('./server_monitor')
  , MongoClient = require('mongodb').MongoClient
  , EventEmitter = require('events').EventEmitter
  , RunningStats = require('./gnuplot/running_stats')
  , JSONStream = require('JSONStream')
  , BasicReport = require('./reports/basic_report')
  , gnuplot = require('./gnuplot/gnuplot');

/*
 * Monitor that coordinates all the child processes
 */
var Process = function(argv, manager, clients) {
  this.argv = argv;
  this.manager = manager;
  this.clients = clients;
  this.children = [];

  // Execution state
  this.registeredChildrenCount = 0;
  this.processesDoneCount = 0;
  this.results = [];
  this.errors = [];

  // Services
  this.services = {};

  // The scenario file
  var file = f('%s/%s', process.cwd(), this.argv.s);

  // Load the passed in scenario
  this.scenario = require(file);

  // Create the Server Monitor instance
  this.serverProcess = new ServerMonitor(this.scenario.url, 1000);

  // Contains the output data streams
  this.outputStreams = {};

  // Output data files
  this.ouputDataFiles = {};
}

inherits(Process, EventEmitter);

/*
 * Start the monitor
 */
Process.prototype.start = function(callback) {
  EventEmitter.call(this);
  var self = this;
  // Not running in local mode
  if(!this.argv.l) return callback();
  // Default child port
  var port = this.argv['local-process-port'];
  var url = this.argv['local-process-url'];

  // Load the scenario file
  var file = require(f('%s/%s', process.cwd(), this.argv.s));
  var numberOfProcesses = this.argv.n;

  // Calculate the total number of executions
  var totalExecutions = 0;

  // For each schema calculate the total
  for(var i = 0; i < file.schemas.length; i++) {
    var dist = file.schemas[i].execution.distribution;
    totalExecutions += (dist.iterations * dist.numberOfUsers * numberOfProcesses);
  }

  // Start the server monitor
  this.serverProcess.start(function(err) {
    if(err) return callback(err);

    // Kick off the processes
    for(var i = 0; i < self.argv.n; i++) {
      var child = new LocalAgentProcess(f('child_%s', i), url, self.argv.p, port++);
      // Save the child to the list of children
      self.children.push(child);
      // Start the child
      child.start();
    }

    // Return
    callback(null, {totalExecutions: totalExecutions});
  });

  // Add listener to server Process
  this.serverProcess.on('data', function(result) {
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
    self.outputStreams[result.name].stream.write([result.timestamp, result]);
  });
}

Process.prototype.totalExecutions = function() {

}

Process.prototype.error = function(err) {
  console.log(f('[MONITOR] client signaled error %s', JSON.stringify(err)));
  this.emit('error', err);
}

Process.prototype.done = function(results) {
  console.log(f('[MONITOR] client signaled done from child process %s:%s', results.host, results.port));
  // Unpack the results
  var host = results.host;
  var port = results.port;
  // var logEntries = results.logEntries;
  var self = this;

  // Get the scenario file
  var scenarioFile = self.argv.s.split('/').pop();

  // Create a file and write it out
  var filename = f('%s/%s.json', self.argv.o, f('%s_%s_%s', scenarioFile, results.host, results.port));

  // Add to output files
  this.ouputDataFiles[filename] = true;

  // Write to disk
  fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf8');

  // Update number of processes done
  this.processesDoneCount = this.processesDoneCount + 1;

  // Are we done ?
  if(this.processesDoneCount == this.children.length) {

    // Generate a basic report
    new BasicReport(self, f('%s/%s', self.argv.o, 'report.json')).execute(function() {
      self.emit('complete', self.logEntries);
    });
  }
}

Process.prototype.report = function(callback) {
  new BasicReport(this, f('%s/%s', this.argv.o, 'report.json')).execute(function() {
    callback();
  });  
}

Process.prototype.stop = function(signal, callback) {
  var self = this;
  if(typeof signal == 'function') callback = signal, signal = 'SIGTERM';
  var left = this.children.length;

  for (var i = this.children.length - 1; i >= 0; i--) {
    this.children[i].stop(signal, function() {
      left = left - 1;

      if(left == 0) {
        // Stop the server monitor
        self.serverProcess.stop(function() {
          // Filenames
          var filenames = {}

          // Close all write streams
          for(var name in self.outputStreams) {
            self.outputStreams[name].stream.end();
            self.ouputDataFiles[self.outputStreams[name].filename] = true;
          }

          // Need to write all the data out
          fs.writeFileSync(f('%s/%s', self.argv.o, 'report.json'), JSON.stringify(self.ouputDataFiles, null, 2), 'utf8');

          // Finished
          callback();
        });
      }
    });
  };
}

Process.prototype.register = function(client) {
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

  // Registered another child
  this.registeredChildrenCount = this.registeredChildrenCount + 1;
  // Do we have enough workers execute them
  if(this.registeredChildrenCount == this.argv.n) return this.execute();
}

var scenarioSetup = function(self, scenario, callback) {
  // Connect to mongodb
  MongoClient.connect(scenario.url, {
      server: { poolSize: 1 }
    , replSet: { poolSize: 1 }
    , mongos: { poolSize: 1 }
  }, function(err, db) {
    if(err) return callback(err);

    // How many schemas are left
    var left = scenario.schemas.length;
    var errors = [];

    // Execute the global schema setup
    var setupSchema = function(schema, callback) {
      console.log(f('[MONITOR] execute global scenarios setup for scenario %s %s', schema.schema.name, JSON.stringify(schema.schema.params)));
      // Fetch the scenario class
      var object = self.manager.find(schema.schema.name);
      // No scenario found return an error
      if(!object) return callback(new Error(f('could not find scenario instance for %s', schema.schema.name)));

      // Validate that all paramters are valid
      for(var name in schema.schema.params) {
        if(!object.params[name]) return callback(new Error(f('scenario %s does not support the parameter %s', schema.schema.name, name)));
      }

      if(typeof schema.setup == 'function') {
        schema.setup(db, function(err, r) {
          if(err) return callback(err);
          // Initiate an instance and call it
          object.create(self.services, scenario, schema).globalSetup(callback);
        });
      } else {
        // Initiate an instance and call it
        object.create(self.services, scenario, schema).globalSetup(callback);
      }
    }

    // Iterate over all the schemas
    for(var i = 0; i < scenario.schemas.length; i++) {
      setupSchema(scenario.schemas[i], function(err) {
        left = left - 1;
        if(err) errors.push(err);

        if(left == 0) {
          callback(errors.length > 0 ? errors : null);
        }
      });
    }
  });
}

Process.prototype.execute = function(callback) {
  console.log(f("[MONITOR] starting execution of provided scenario %s", this.argv.s));
  var file = f('%s/%s', process.cwd(), this.argv.s);
  var self = this;

  // Load the passed in scenario
  var scenario = self.scenario;
  var errors = [];
  var results = null;
  var left = this.children.length;

  // Perform scenario setup
  scenarioSetup(self, scenario, function(err) {
    if(err) throw err;

    // Call each child with the executor
    for(var i = 0; i < self.children.length; i++) {

      // Execute the scenario on the child process
      self.children[i].execute(scenario, {}, function(err, results) {
        left = left - 1;

        if(left == 0) {
          callback(errors.length > 0 ? errors : null, results);
        }
      });
    }
  });
}

module.exports = Process;
