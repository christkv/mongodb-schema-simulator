var f = require('util').format;

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

  // Do any setup for the db
  this.instance.setup(function(err) {
    if(err) return callback(err);
    callback();
  });
}

// Execute in series
var executeInParallel = function(module, args, runs, instance, callback) {
  if(runs == 0) return callback(null);
  var methodName = args.m;
  // Locate the method
  for(var i = 0; i < module.methods.length; i++) {
    if(module.methods[i].name == methodName) {
      methodName = module.methods[i].method;
    }
  }

  // Execute the method
  instance[methodName](function(err) {
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