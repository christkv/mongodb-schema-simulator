var f = require('util').format
  , os = require('os')
  , dnode = require('dnode')
  , Child = require('./lib/child/child')
  , ScenarioManager = require('./lib/child/scenario_manager');

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
  .describe('u', 'MongoDB connection url')
  .default('u', 'mongodb://localhost:27017')
  .describe('t', 'Child process tag')
  .default('t', 'child')

// Get parsed arguments
var argv = yargs.argv

// List help
if(argv.h) return console.log(yargs.help())

// Create a scenario manager
var manager = new ScenarioManager();
// Load available scenarios
manager.load('./lib/scenarios');

// Create a child instance (wrapping the functionality of the process)
var child = new Child(manager, argv);

// Start the actual process handler
var server = dnode({
  execute : function(scenario, options, callback) {
    if(child.isRunning()) return callback(new Error('scenario executing'));
    console.log(f("[CHILD-%s:%s] starting execution", os.hostname(), argv.p));
    // Just finish callback
    callback(null, {});
    // Execute the child
    child.execute(scenario, options);
  }
});

// Start server and attempt to connect to monitor
server.listen(argv.p, function() {
  // Attempt to connect to the monitor
  var d = dnode.connect(argv.m, argv.s);
  d.on('remote', function(remote) {
    console.log(f("[CHILD-%s:%s] reporting for work to monitor at %s:%s", os.hostname(), argv.p, argv.s, argv.m));
    remote.register({
      // Arguments passed to the child
        argv: argv
      // Process pid
      , pid: process.pid
      // Provide the hostname
      , hostname: os.hostname()
    }, function() {
    })
  });
});