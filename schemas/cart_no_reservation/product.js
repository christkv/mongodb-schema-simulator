"use strict";

var Product = function(db, id) {
  this.db = db;
  this.id = id;
  this.products = db.collection('products');  
}

/*
 * Reload the product information
 */
Product.prototype.reload = function(callback) {
  var self = this;

  this.products.findOne({_id: this.id}, function(err, doc) {
    console.dir(err)
    console.dir(doc)
    if(err) return callback(err);
    self.name = doc.name;
    self.price = doc.price;
    callback(null, self);
  });
}

module.exports = Product;