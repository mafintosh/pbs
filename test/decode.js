var pbs = require('../')
var protobuf = require('protocol-buffers')
var tape = require('tape')
var fs = require('fs')

var schema = fs.readFileSync(__dirname + '/test.proto')
var messages = pbs(schema)
var pbMessages = protobuf(schema)

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

tape('decoder allows missing optional message', function (t) {
  t.plan(1)

  var decoder = messages.TestOptional.decode()

  decoder.on('finish', function () {
    t.ok(true, 'everthing is fine')
    t.end()
  })

  decoder.end()
})
