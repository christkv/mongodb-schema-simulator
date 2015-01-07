var f = require('util').format
  , dnode = require('dnode')
  , Monitor = require('./lib/monitor/monitor');

// Parse the passed in parameters
var yargs = require('yargs')
  .usage('Start a the main process.\nUsage: $0')
  .example('$0 -p 5100', 'Run client on port 5100')
  .describe('p', 'Port process is running on')
  .default('p', 5100)
  .describe('n', 'Number of processes running')
  .default('n', 2)
  .describe('l', 'Run all client processes locally')
  .default('l', true)
  .describe('local-process-port', 'Local process start port')
  .default('local-process-port', 5200)
  .describe('local-process-url', 'Local process MongoDB url')
  .default('local-process-url', 'mongodb://localhost:27017/schema')
  .describe('s', 'Path to scenario file to execute')
  .require('s')

// Get parsed arguments
var argv = yargs.argv

// List help
if(argv.h) return console.log(yargs.help())

// Var clients
var clients = [];
// Monitor instance
var monitor = new Monitor(argv, clients);

// The actual server (handles clients reporting back)
var server = dnode({
  // Registration call from the client process
  register: function(client, callback) {
    monitor.register(client)
    callback();
  },
  // Error from the client process
  error: function(err, callback) {
    monitor.error(err);
    callback();
  },
  // Results from a client process
  done: function(results, callback) {
    monitor.done(results);
    callback();
  }
});

// Wait for all children to be setup
monitor.on('registrationComplete', function() {
  monitor.execute();
});

// Wait for the scenario to finish executing
monitor.on('complete', function() {
  console.log("[MONITOR] Executon finished, stopping child processes");
  // Stop the monitor
  monitor.stop(function() {
    console.log("[MONITOR] Executon finished, stopping dnode server endpoint");
    // Stop the dnode server
    server.end();
    // Stop the process
    process.exit(0);
  });
});

// In case the scenario failed to execute
monitor.on('error', function() {

});

// Run the monitor listening point
server.listen(argv.p, function() {
  // Start the monitor
  monitor.start(function(err) {
    if(err) throw err;
  });
});

