var Case = require('../../lib/child/case')
  , f = require('util').format
  , ObjectId = require('mongodb').ObjectID
  , crypto = require('crypto')
  , inherits = require('util').inherits;

var Metadata = function(module, args) {
  if(!(this instanceof Metadata)) return new Metadata();
  Case.call(this, Array.prototype.slice.call(arguments, 0));
  this.args = args;
  this.module = module;
  this.collection = null;

  // Iterate
  this.read = 0;
  this.ratio = 3;
  // Pick a random counter
  this.counter = Math.round(Math.random() * 100000);
  this.originalStart = this.counter;
}

// Inherit from Case
inherits(Metadata, Case);

function makeString(number) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < number; i++ ) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));    
  }

  return text;
}

// Generate random metadata
var generateMetadata = function(number) {
  var object = {};

  // Generate random metadata
  for(var i = 0; i < number; i++) {
    var item = (Math.round((Math.random() * 3)) + 1) % 5;

    if(item == 0) {
      object[makeString(Math.round(Math.random() * 100))] = Math.round(Math.random() * 1000000);
    } else if(item == 1) {
      object[makeString(Math.round(Math.random() * 100))] = makeString(Math.round(Math.random() * 100));
    } else if(item == 2) {
      object[makeString(Math.round(Math.random() * 100))] = Math.random() * 1000000;
    }
  }

  return object;
}

/*
 * Setup and tear down methods for the Metadata class
 */
Metadata.prototype.setup = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var self = this;

  // Connect to the server
  this.connect(function(err, db) {
    if(err) return callback(err);
    // Set our collection
    self.collection = db.collection('metadata');

    // Return if trying with no index
    if(self.args.m == 'read_write_no_index') return callback();

    // Create the metadata index
    self.collection.ensureIndex({'metadata.key': 1, 'metadata.value': 1}, {}, function(err, r) {
      if(err) return callback(err);
      // Return after setup
      callback();
    });
  });
}

Metadata.prototype.teardown = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  callback();
}

/*
 * Write new random metadata documents to disk
 */
Metadata.prototype.write = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  this.collection.insertOne({
    metadata: generateMetadata(250)
  }, function(err, result) {
    if(err) return callback(err);
    callback();
  });
}

/*
 * Mix read and writes of documents to disk 50/50, single document fetch by metadata key
 */
Metadata.prototype.readWrite = function(options, callback) {  
  if(typeof options == 'function') callback = options, options = {};
  var self = this;
  if(this.read > 0) {
    var id = process.pid + (this.counter++);
    // Add id as metadata field
    var obj = generateMetadata(250);
    obj.id = id;
    // Insert object
    this.collection.insertOne({
        _id: id
      , metadata: obj
    }, function(err, result) {
      if(err) return callback(err);
      self.read = (self.read + 1) % self.ratio;
      callback();
    });    
  } else {
    var id = process.pid + Math.round(Math.random() * (this.counter - this.originalStart)) + this.originalStart;
    // Locate by metadata field id
    this.collection.findOne({
      metadata: {
        $elemMatch: {key: "id", value: id}
      }
    }, function(err, doc) {
      if(err) return callback(err);
      self.read = (self.read + 1) % self.ratio;
      callback();
    });
  }
}

// Export schema
module.exports = {
    abr: 'metadata'
  , description: 'Show case metadata pattern'
  , chapter: 2
  , module: f('%s', __filename)
  , entry: 'start'
  , class: Metadata
  , methods: [{
      name: 'write'
    , method: 'write'
    , description: 'Write new random metadata documents to disk'
  }, {
      name: 'read_write'
    , method: 'readWrite'
    , description: 'Mix read and writes of documents to disk 50/50, single document fetch'
    , variables: {
        reads: {type: 'number', value: 50, description: 'The percentage of writes'}
      , writes: {type: 'number', valye: 50, description: 'The percentage of reads'}
    }
  }, {
      name: 'read_write_no_index'
    , method: 'readWrite'
    , description: 'Mix read and writes of documents to disk 50/50, single document fetch, no index'
    , variables: {
        reads: {type: 'number', value: 50, description: 'The percentage of writes'}
      , writes: {type: 'number', valye: 50, description: 'The percentage of reads'}
    }
  }]  
}