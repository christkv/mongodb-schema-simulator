exports.module = { scenarios:[] };

/*
 * Simple fixed items in cart simulation
 */
scenarios.push({
    name: 'fixed number of cart items with reservation'
  , description: 'simulates successful carts with a fixed number of items in the cart with reservation'
  , params: {
    // Number of items in the cart
    numberOfItems: {
        name: 'number of items in the cart'
      , type: 'number'
      , default: 5
    }
    // Size of catalog
    , numberOfProducts: {
        name: 'number of products available'
      , type: 'number'
      , default: 100
    }
    // Size of products in bytes
    , sizeOfProductsInBytes: {
        name: 'size of products in bytes'
      , type: 'number'
      , default: 1024
    }
  }
  , create: function(services, parameters) {
    // Get all the schemas
    var Cart = require('../schemas/cart_reservation/cart')
      , Inventory = require('../schemas/cart_reservation/inventory')
      , Order = require('../schemas/cart_reservation/order')
      , Product = require('../schemas/cart_reservation/product');

    // Contains the cart scenario
    var CartScenario = function() {}
    
    /*
     * Runs only once when starting up on the monitor
     */
    CartScenario.prototype.globalSetup = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      // Create a random product setup based on the passed in parameters
      createRandomProducts(parameters, callback);
    }

    /*
     * Runs only once when starting up on the monitor
     */
    CartScenario.prototype.globalTeardown = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    CartScenario.prototype.setup = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * Runs for each executing process
     */
    CartScenario.prototype.teardown = function(options, callback) {      
      if(typeof options == 'function') callback = options, options = {};
      callback();
    }

    /*
     * The actual scenario running
     */
    CartScenario.prototype.execute = function(options, callback) {
      if(typeof options == 'function') callback = options, options = {};
      callback();      
    }

    return CartScenario;
  }
})