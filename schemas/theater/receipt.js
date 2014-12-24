var Receipt = function(db, reservations, total) {  
  this.db = db;
  this.reservations = reservations;
  this.total = total
  this.receipts = db.collection('receipts');
}

Receipt.prototype.create = function(callback) {
  var self = this;
  this.receipts.insertOne({
      createdOn: new Date()
    , reservations: this.reservations
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  })
}

module.exports = Receipt;