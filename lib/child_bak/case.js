var MongoClient = require('mongodb').MongoClient;

var Case = function(module, args) {  
  this.module = module;
  this.args = args;
}

Case.prototype.connect = function(callback) {
  MongoClient.connect(this.args.u, function(err, db) {
    if(err) return callback(err);
    callback(null, db);
  });
};

module.exports = Case;