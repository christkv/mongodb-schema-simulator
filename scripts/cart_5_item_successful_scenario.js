// Definition of the fields to execute
module.exports = {
  // The schema's we plan to exercise
  schemas: [{
    cart_reservation: {
        numberOfItems: 5
      , numberOfProducts: 1000
      , sizeOfProductsInBytes: 1024
    }
  }],
  
  // Total number of iterations to perform for each schema
  iterations: [10000]
}