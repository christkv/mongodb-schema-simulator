var ChildProcess = function(module, args) {
  this.module = module;
  this.args = args;

  // Get test function
  var func = require(module.module);
  // Instantiate an instance of the test
  this.instance = new func(module, args);  
}

ChildProcess.prototype.setup = function(callback) {
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
  console.log("-------------------------------------------------------------")
  console.dir(this.module)
  console.dir(this.args)

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
        callback(null);
      }
    });
  }
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
  }
})

// Export the process module
module.export = ChildProcess;