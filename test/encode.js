var pbs = require('../')
var protobuf = require('protocol-buffers')
var tape = require('tape')
var concat = require('concat-stream')
var fs = require('fs')

var schema = fs.readFileSync(__dirname + '/test.proto')
var messages = pbs(schema)
var pbMessages = protobuf(schema)

tape('encodes', function (t) {
  var encoder = messages.Test.encode()

  encoder.hello('world')
  encoder.finalize()

  encoder.pipe(concat(function (data) {
    data = pbMessages.Test.decode(data)
    t.same(data, {hello: 'world'}, 'encoded valid protobuf')
    t.end()
  }))
})

tape('encodes required field only once', function (t) {
  var encoder = messages.Test.encode()

  encoder.hello('world')
  encoder.hello('world2')
  encoder.finalize()

  encoder.pipe(concat(function (data) {
    data = pbMessages.Test.decode(data)
    t.same(data, {hello: 'world'}, 'encoded valid protobuf')
    t.end()
  }))
})

tape('encodes repeated', function (t) {
  var encoder = messages.TestRepeated.encode()

  encoder.hello('a')
  encoder.hello('b')
  encoder.hello('c')

  encoder.finalize()

  encoder.pipe(concat(function (data) {
    data = pbMessages.TestRepeated.decode(data)
    t.same(data, {hello: ['a', 'b', 'c']}, 'encoded valid protobuf arrays')
    t.end()
  }))
})

tape('encoder fails if missing required message', function (t) {
  t.plan(1)

  var encoder = messages.Test.encode()

  encoder.on('error', function (err) {
    t.ok(err, 'had error')
    t.end()
  })

  encoder.finalize()
})

tape('encoder allows missing optional message', function (t) {
  t.plan(1)

  var encoder = messages.TestOptional.encode()

  encoder.on('end', function (err) {
    t.ok(true, 'everthing is fine')
    t.end()
  })

  encoder.finalize()
})
