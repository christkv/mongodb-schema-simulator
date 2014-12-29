var f = require('util').format;

var MetaData = function(db, id, metadata) {
  this.db = db;
  this.id = id;
  this.metadatas = db.collection('metadatas');
  this.metadata = metadata;
}

MetaData.prototype.create = function(callback) {
  var self = this;
  // Insert the metadata
  this.metadatas.insertOne({
      _id: this.id
    , metadata: this.metadata
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

module.exports = MetaData;