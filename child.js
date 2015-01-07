var f = require('util').format
  , dnode = require('dnode');

// Parse the passed in parameters
var yargs = require('yargs')
  .usage('Start a load creating process.\nUsage: $0')
  .example('$0 -p 5024 -m localhost:5100', 'Run client on port 5024 and contact coordinator at localhost on port 5100')
  .describe('p', 'Port process is running on')
  .default('p', 5024)
  .describe('m', 'Port monitor is running on')
  .default('m', 5100)
  .describe('u', 'MongoDB connection url')
  .default('u', 'mongodb://localhost:27017')

// Get parsed arguments
var argv = yargs.argv

// List help
if(argv.h) return console.log(yargs.help())

// Start the actual process handler
var server = dnode({
  execute : function(options, callback) {
    callback(null, {});
  }
});

console.log("================ START")
console.dir(argv)

// Start server and attempt to connect to monitor
server.listen(argv.p, function() {
  console.log("----------------- HEY")
  // Attempt to connect to the monitor
  var d = dnode.connect(argv.m);
  d.on('remote', function(remote) {
    remote.register({}, function() {
      console.log("--------------- called remote")
    })
  });
});