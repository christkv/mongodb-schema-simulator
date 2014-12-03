var f = require('util').format
  , mkdirp = require('mkdirp')
  , levelup = require('levelup')
  , microtime = require('microtime');

// What methods to trace
var traceMethods = [{
  c: 'Collection', m: ['insertOne', 'insertMany', 'insert', 'update', 'remove', 'updateOne', 'updateMany', 'removeOne', 'removeMany', 'findAndModify']
}];

// Setup driver method tracing
var setupTracing = function(db, traceMethods) {
  var mongodb = require('mongodb');

  // Wrap a method
  var wrap = function(className, methodName, proto) {
    // Get the original method
    var originalMethod = proto[methodName];
    var counter = 0;
    var batchOn = 1000;
    var entries = [];
    // Batch write
    var batchWriteCounter = 0;
    
    // Wrap the method for tracing
    proto[methodName] = function() {
      var args = Array.prototype.slice.call(arguments, 0);

      // Get the callback at the end of the function
      var callback = args.pop();       

      // Current microtime
      var start = microtime.now();

      // Add out callback to the command
      args.push(function(err, r) {
        var total = microtime.now() - start;
        // Entries
        entries.push({
            type: 'put'
          , key: microtime.now().toString()
          , value: JSON.stringify({c:className, m:methodName, t: total})
        });

        // Adjust the counter
        counter = counter + 1;
        // Update batch counter
        batchWriteCounter = (batchWriteCounter + 1) % batchOn;

        // We need to write batched ops
        if(batchWriteCounter == 0) {
          db.batch(entries, function(err) {
            entries = [];
            callback(err, r)
          })
        } else {
          callback(err, r)
        }
      });

      // Execute original method
      return originalMethod.apply(this, args)
    }    
  }

  // Trace all the methods
  for(var i = 0; i < traceMethods.length; i++) {
    var c = mongodb[traceMethods[i].c];
    // Instrument all the methods
    for(var j = 0; j < traceMethods[i].m.length; j++) {
      wrap(traceMethods[i].c, traceMethods[i].m[j], c.prototype);
    }
  }
}

/*
 * Wraps a child process
 */
var ChildProcess = function(module, args, options) {
  this.module = module;
  this.args = args;
  this.options = options || {};
  // Get test function
  var func = require(module.module).class;
  // Instantiate an instance of the test
  this.instance = new func(module, args);  
}

ChildProcess.prototype.setup = function(callback) {
  if(this.options.debug) {
    console.log(f("[Child Process - %s] Setup", process.pid));
  }

  // Get the db path
  var dbpath = f("%s/%s", this.args.d || './tmp', process.pid);
  // Create the path
  try {
    mkdirp.sync(dbpath);    
  } catch(err) {}

  // Set up the level db instance
  this.db = levelup(f('%s/db', dbpath));

  // Setup drive tracing
  setupTracing(this.db, traceMethods);

  // Do any setup for the db
  this.instance.setup(function(err) {
    if(err) return callback(err);
    callback();
  });
}

// Execute in series
var executeInParallel = function(module, args, runs, instance, callback) {
  if(runs == 0) return callback(null);
  // Execute the method
  instance[args.m](function(err) {
    executeInParallel(module, args, runs - 1, instance, callback);
  });
}

ChildProcess.prototype.execute = function(callback) {
  var self = this;
  // Write out debug
  if(this.options.debug) {
    console.log(f("[Child Process - %s] Execute workload", process.pid));
  }
  // Number of runs
  var runs = this.args.r;
  // Number of concurrency
  var concurrency = this.args.c;
  // Left over
  var left = concurrency;

  // Execute x number of times in parallel
  for(var i = 0; i < concurrency; i++) {
    executeInParallel(this.module, this.args, runs, this.instance, function() {
      left = left - 1;

      if(left == 0) {        
        self.db.close();

        // Write out debug
        if(self.options.debug) {
          console.log(f("[Child Process - %s] Workload Finished", process.pid));
        }

        callback(null);
      }
    });
  }
}

// Process instance
var child = null;
// Listen for messages from the parent
process.on('message', function(m) {
  // Initialize our structure
  if(m.type == 'init') {
    child = new ChildProcess(m.module, m.args, m.options);
    
    // Setup the child teardown
    child.setup(function(err) {
      if(err) process.exit(0);
      process.send({type: 'ready'});
    });
  } 

  // Parent signals to execute workload
  if(m.type == 'execute') {
    // Start executing the process
    child.execute(function(err) {
      if(err) process.exit(0);
      process.send({type: 'done'});
    });
  }
})

// Export the process module
module.export = ChildProcess;