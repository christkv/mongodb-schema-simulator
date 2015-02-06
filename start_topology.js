var ReplSetManager = require('mongodb-tools').ReplSetManager
  , ServerManager = require('mongodb-tools').ServerManager
  , ShardingManager = require('mongodb-tools').ShardingManager
  , mkdirp = require('mkdirp')
  , path = require('path');

// Parse the passed in parameters
var yargs = require('yargs')
  .usage('Start a local topology.\nUsage: $0')
  .example('$0 -t replicaset', 'Run a local replicaset')
  // The Monitor process port
  .describe('t', 'Type of topology to run')
  .default('t', 'single')

// Get parsed arguments
var argv = yargs.argv
// List help
if(argv.h) return console.log(yargs.help())

// Do we have a replicaset
if(argv.t == 'replicaset') {
  // Return manager
  var manager = new ReplSetManager({
      dbpath: path.join(path.resolve('db'))
    , logpath: path.join(path.resolve('db'))
    , arbiters: 0
    , secondaries: 2
    , tags: [{loc: "ny"}, {loc: "sf"}, {loc: "sf"}]
    , replSet: 'rs', startPort: 31000
  });

  manager.start(function() {
    process.exit(0);
  });
} else if(argv.t == 'single') {
  // Create the output directory
  mkdirp.sync(path.join(path.resolve('data')));
  mkdirp.sync(path.join(path.resolve('data/data-27017')));

  // Return manager
  var manager = new ServerManager({
      host: 'localhost'
    , port: 27017
  });

  manager.start(function() {
    process.exit(0);
  });  
} else if(argv.t == 'sharded') {
  // Return manager
  var manager = new ShardingManager({
      dbpath: path.join(path.resolve('db'))
    , logpath: path.join(path.resolve('db'))
    , mongosStartPort: 50000
    , replsetStartPort: 31000
  });

  manager.start(function() {
    process.exit(0);
  });  
}