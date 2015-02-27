/*
 * Create a new receipt instance
 */
var Receipt = function(collections, reservations, total) {  
  this.reservations = reservations;
  this.total = total
  this.receipts = collections['receipts'];
}

/*
 * Create a new receipt mongod document
 */
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

/*
 * Create the optimal indexes for the queries
 */
Receipt.createOptimalIndexes = function(collections, callback) {
  callback();
}

module.exports = Receipt;