var f = require('util').format
  , os = require('os')
  , path = require('path')
  , dnode = require('dnode')
  , Process = require('./lib/agent/process')
  , ScenarioManager = require('./lib/common/scenario_manager');

// Parse the passed in parameters
var yargs = require('yargs')
  .usage('Start a load creating process.\nUsage: $0')
  .example('$0 -p 5024 -m localhost:5100', 'Run client on port 5024 and contact coordinator at localhost on port 5100')
  .describe('p', 'Port process is running on')
  .default('p', 5024)
  .describe('s', 'Host monitor is running on')
  .default('s', 'localhost')
  .describe('m', 'Port monitor is running on')
  .default('m', 5100)

// Get parsed arguments
var argv = yargs.argv

// List help
if(argv.h) return console.log(yargs.help())
// Scenarios Directory
var scenariosDirectory = path.resolve(__dirname, f('%s', './lib/common/scenarios'));
// Create a scenario manager
var manager = new ScenarioManager().load(scenariosDirectory);

// Create a child instance (wrapping the functionality of the process)
var child = new Process(manager, argv);
var d = null;

// Start the actual process handler
var server = dnode({
  execute : function(scenario, options, callback) {
    if(child.isRunning()) return callback(new Error('scenario executing'));
    console.log(f("[AGENT-%s:%s] starting execution", os.hostname(), argv.p));
    // Just finish callback
    callback(null, {});
    // Execute the child
    child.execute(scenario, options, function() {});
  }
});

// Start server and attempt to connect to monitor
server.listen(argv.p, function() {
  // Attempt to connect to the monitor
  d = dnode.connect(argv.m, argv.s);
  d.on('remote', function(remote) {
    console.log(f("[AGENT-%s:%s] reporting for work to monitor at %s:%s", os.hostname(), argv.p, argv.s, argv.m));
    // Set the remote process on the child
    child.setMonitor(remote);
    // Register the process with the monitor
    remote.register({
      // Arguments passed to the child
        argv: argv
      // Process pid
      , pid: process.pid
      // Provide the hostname
      , hostname: os.hostname()
    }, function() {});
  });
});
