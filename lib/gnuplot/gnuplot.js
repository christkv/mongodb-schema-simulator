var inherits = require('util').inherits
  , f = require('util').format
  , ejs = require('ejs')
  , spawn = require('child_process').spawn
  , fs = require('fs');

// set style data linespoints

//
// Set values
var plotSetValues = [{
  name: 'output', type: 'string'
}, {
  name: 'terminal'
}, {
  name: 'style'
}];

/*
 * Plot shared functionality
 */
var Plot = function(options) {  
  this.debug = typeof options.debug == 'boolean' ? options.debug : false;
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
  var self = this;
  // Render the actual template
  var result = ejs.render(this.template, this);

  // Running the script
  if(this.debug) {
    console.log("--------------------------------------------------------");
    console.log("Running script");
    console.log("--------------------------------------------------------")
    console.log(result)    
  }

  // Create an instance of gnuplot and pipe the commands to it
  var gnuplot = spawn('gnuplot', ['-p'])
  gnuplot.stdout.on('data', function (data) {
    if(self.debug) console.log('stdout: ' + data);
  });

  gnuplot.stderr.on('data', function (data) {
    if(self.debug) console.log('stderr: ' + data);
  });

  gnuplot.on('close', function (code) {
    if(self.debug) console.log('child process exited with code ' + code);
    callback();
  });  

  // Write the result to the gnuplot processes
  gnuplot.stdin.write(result);
  // End the pipe to ensure the process exits
  gnuplot.stdin.destroy();
}

Plot.prototype.plotFile = function(files) {
  this.plot = f('plot %s', files.join('\\,\n'))
}

var plotMatrix = function(data) {
  var strings = [];
  var rows = data[0].length;
  var row = [];

  // Process all the rows
  for(var i = 0; i < rows; i++) {
    for(var j = 0; j < data.length; j++) {
      row.push(data[j][i]);
    }

    strings.push(f('%s\n', row.join(' ')));
    row = [];
  }

  return strings.join('');
}

Plot.prototype.plotData = function(files) {
  this.plot = f('plot %s\n', files.join(',\\\n'));

  for(var i = 0; i < files.length; i++) {
    this.plot = f('%s\n%sEOF\n', this.plot, plotMatrix(this.rows))
  }
}

/*
 * A Line graph
 */
var Line = function(options) {
  if(!(this instanceof Line)) return new Line(options);
  Plot.apply(this, Array.prototype.slice.call(arguments, 0));
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

Line.prototype.matrix = function(value) {
  this.rows = value;
}

// Export the module
module.exports = {
  Line: Line
}
