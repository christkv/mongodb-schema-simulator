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
  register: function(client, callback) {
    // Save the client information
    clients.push(client);

    // Return the result
    callback(null, true);

    // Do we have enough clients ?
    if(clients.length == argv.n) monitor.execute();
  }
});

// Run the monitor listening point
server.listen(argv.p, function() {
  // Start the monitor
  monitor.start(function(err) {
    if(err) throw err;
  });
});

