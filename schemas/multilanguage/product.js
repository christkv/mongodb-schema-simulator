"use strict";

var f = require('util').format;

// {
//     _id: ObjectId(""),
//     name: "MyProduct",
//     category: {
//         Catid: ObjectId(""),
//         names: {
//            en: "MyCategory",
//            es: "...",
//            fr: "..."
//         }
//     }
// }

// Product {
//   "_id" : ObjectID("..."),
//   "name" : "MyProduct",
//   "category" : ObjectID("..")
// }

// Category {
//   "_id" : ObjectID("..."),
//   "en-us" : "cheese",
//   "de-de" : "Käse",
//   "es-mx" : "queso"
// }
// Or, category could be stored with more structure to handle regional variances:

// Category {
//   "_id" : ObjectID("..."),
//   "en" : { default: "cheese" }
//   "de-de" : { default: "käse", "at": "käse2" }
//   "es" : { default: "queso" }
// }

// Keep the category as the "main" location of the translation information
// Keep the cached version in the product, invalidate the cached version when category
// is refreshed by issuing an updateMany overwriting the category with the fresh one

var Product = function(db, id, name, cost, currency, categories) {
  this.db = db;
  this.id = id;
  this.name = name;
  this.cost = cost;
  this.currency = currency;
  this.categories = categories;
  this.products = db.collection('products');  
}

/*
 * Create a new mongodb product document
 */
Product.prototype.create = function(callback) {
  var self = this;
  // Insert a new category
  this.products.insertOne({
      _id: this.id
    , name: this.name
    , cost: this.cost
    , currency: this.currency
    , categories: categories
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}