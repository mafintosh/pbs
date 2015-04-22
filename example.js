var pbs = require('./')
var fs = require('fs')

var messages = pbs(fs.readFileSync('example.proto'))

// create a streaming decoder
var decoder = messages.Company.decode()

decoder.name(function (name, cb) {
  console.log('message has name:', name)
  cb() // done processing
})

decoder.employees(function (employee, cb) {
  console.log('employee array member:', employee)
  cb() // done processing
})

decoder.country(function (country, cb) {
  console.log('message has country:', country)
  cb()
})

decoder.on('finish', function () {
  console.log('(no more data)')
})

// create a streaming encoder
var encoder = messages.Company.encode()

// encoder is a readable stream containing the protobuf message.
// you can pipe it anywhere!
encoder.pipe(decoder)

// write a name to the stream
encoder.name('my-company')

// write an employee to the stream
encoder.employees({
  name: 'mathias',
  age: 28
})

// write another one
encoder.employees({
  name: 'jane doe',
  age: 32
})

// no more data -  will end the readable stream
encoder.finalize()
