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

tape('decodes', function (t) {
  t.plan(1)

  var decoder = messages.Test.decode()

  decoder.hello(function (hello, cb) {
    t.same(hello, 'world', 'got hello world')
  })

  decoder.on('finish', function () {
    t.end()
  })

  var buf = pbMessages.Test.encode({
    hello: 'world'
  })

  decoder.end(buf)
})

tape('decodes required field only once', function (t) {
  t.plan(1)

  var decoder = messages.Test.decode()

  decoder.hello(function (hello, cb) {
    t.same(hello, 'world', 'got hello world')
    cb()
  })

  decoder.on('finish', function () {
    t.end()
  })

  var buf = pbMessages.TestRepeated.encode({
    hello: ['world', 'world2']
  })

  decoder.end(buf)
})

tape('decodes repeated', function (t) {
  t.plan(3)

  var decoder = messages.TestRepeated.decode()
  var expected = ['a', 'b', 'c']

  decoder.hello(function (hello, cb) {
    t.same(hello, expected.shift())
    cb()
  })

  decoder.on('finish', function () {
    t.end()
  })

  var buf = pbMessages.TestRepeated.encode({
    hello: expected
  })

  decoder.end(buf)
})

tape('decoder fails if missing required message', function (t) {
  t.plan(1)

  var decoder = messages.Test.decode()

  decoder.on('error', function (err) {
    t.ok(err, 'had error')
    t.end()
  })

  decoder.end()
})
