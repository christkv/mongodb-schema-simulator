var f = require('util').format
  , MongoClient = require('mongodb').MongoClient
  , mkdirp = require('mkdirp')
  , levelup = require('levelup')
  , microtime = require('microtime');

var ChildProcess = function(module, args) {
  // Save the arguments
  this.module = module;
  this.args = args;
  // The ping resolution
  this.resolution = args.t || 1000;
  // The connection url
  this.url = args.u || 'mongodb://localhost:27017/admin?maxPoolSize=1';
}

ChildProcess.prototype.setup = function(callback) {
  var self = this;
  var dbpath = f("%s/monitor-%s", this.args.d || './tmp', process.pid);
  
  // Create the path
  try {
    mkdirp.sync(dbpath);    
  } catch(err) {}

  // Set up the level db instance
  this.db = levelup(f('%s/db', dbpath));

  // Connect
  MongoClient.connect(this.url, function(err, client) {
    if(err) return callback(err);
    self.client = client;
    callback();
  });
}

ChildProcess.prototype.execute = function(callback) {
  var self = this;
  var interval = setInterval(function() {
    // Execute command
    self.client.command({serverStatus:true}, function(err, r) {
      if(!err) {
        self.db.put(new Date().getTime().toString(), JSON.stringify(r));
      }
    });
  }, this.resolution);
}

ChildProcess.prototype.stop = function() {
  this.db.close();
}

// Process instance
var child = null;
process.on('message', function(m) {
  // Initialize our structure
  if(m.type == 'init') {
    child = new ChildProcess(m.module, m.args);
    
    // Setup the child teardown
    child.setup(function(err) {
      if(err) process.exit(0);
      process.send({type: 'ready'});
    });
  } else if(m.type == 'execute') {
    // Start executing the process
    child.execute(function(err) {
      if(err) process.exit(0);
      process.send({type: 'done'});
    });
  } else if(m.type == 'stop') {
    child.stop();
    process.exit(0);
  }
})

// Export the process module
module.export = ChildProcess;