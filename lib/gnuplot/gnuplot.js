var inherits = require('util').inherits
  , f = require('util').format
  , ejs = require('ejs')
  , spawn = require('child_process').spawn
  , fs = require('fs');

//
// Set values
var plotSetValues = [{
  name: 'output', type: 'string'
}, {
  name: 'terminal'
}];

/*
 * Plot shared functionality
 */
var Plot = function() {  
  // Set the values
  this.sets = {    
  }
}

// Add prototype methods
plotSetValues.forEach(function(x) {
  Plot.prototype[x.name] = function(value) {
    if(x.type == 'string') value = f('"%s"', value); 
    this.sets[x.name] = value;
  }
});

Plot.prototype.execute = function(callback) {
  // Render the actual template
  var result = ejs.render(this.template, this);

  // Running the script
  console.log("--------------------------------------------------------");
  console.log("Running script");
  console.log("--------------------------------------------------------")
  console.log(result)

  // Create an instance of gnuplot and pipe the commands to it
  var gnuplot = spawn('gnuplot', [])
  gnuplot.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
  });

  gnuplot.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  gnuplot.on('close', function (code) {
    console.log('child process exited with code ' + code);
  });  

  // Write the result to the gnuplot processes
  gnuplot.stdin.write(result);
  // End the pipe to ensure the process exits
  gnuplot.stdin.destroy();
}

Plot.prototype.plotFile = function(files) {
  this.plot = f('plot %s', files.join(',\n\\'))
}

/*
 * A Line graph
 */
var Line = function() {
  if(!(this instanceof Line)) return new Line();
  Plot.call(this, Array.prototype.slice.call(arguments, 0));

  // Load the actual template
  this.template = fs.readFileSync(__dirname + "/line_graph_template.ejs", 'utf8');
  // Contains the rows of data  
  this.rows = [];
}

// Inherit from Case
inherits(Line, Plot);

//
// Set values
var plotSetValues = [{
  name: 'xlabel', type: 'string'
}, {
  name: 'ylabel', type: 'string'
}];

// Add prototype methods
plotSetValues.forEach(function(x) {
  Line.prototype[x.name] = function(value) {
    if(x.type == 'string') value = f('"%s"', value); 
    this.sets[x.name] = value;
  }
});

Line.prototype.addData = function(value) {
  this.rows.push(value);
}

// Export the module
module.exports = {
  Line: Line
}
