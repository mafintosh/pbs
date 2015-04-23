# pbs

Streaming [protocol buffers](https://developers.google.com/protocol-buffers/) encoder/decoder

```
npm install pbs
```

[![build status](http://img.shields.io/travis/mafintosh/pbs.svg?style=flat)](http://travis-ci.org/mafintosh/pbs)

## Usage

``` js
var pbs = require('pbs')

var messages = pbs(`
  message Company {
    required string name = 1;
    repeated Employee employees = 2;
    optional string country = 3;

    message Employee {
      required string name = 1;
      required uint32 age = 2;
    }
  }
`)

// create a streaming encoder
var encoder = message.Company.encode()

// create a streaming decoder
var decoder = message.Company.decode()
```

## Encoding

Use pbs to encode a protocol buffers message (no matter how large!) to a stream.

The encoder stream will expose all properties of the protobuf message as methods on the
stream that you can pass the value you want to write to.

``` js
encoder.someProperty(aValue, [callback])
```

The callback is called when the stream has been flushed.

Here is an example using the above protobuf schema:

``` js
// all the properties of Company are exposed as methods
var encoder = messages.Company.encode()

// encoder is a readable stream containing the protobuf message.
// you can pipe it anywhere!
encoder.pipe(fs.createWriteStream('my-protobuf-message.pb'))

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
```

The encoder stream produces a valid protobuf message that can be decoded with any
other parser that follows the protobuf spec.

## Decoding

Similar to encoding you can use pbs to decode a protobuf message.

The decoder stream also exposes the properties as methods, but instead of passing a value
you pass a function that is called then that property is found in the stream.

``` js
decoder.someProperty(fn)
```

Here is an example using the above schema:

``` js
// all the properties of Company are exposes as methods
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

fs.createReadStream('my-protobuf-message.pb').pipe(decoder)
```

## Use cases

You can use this to parse large protobuf messages that might not fit in memory.

Another use case is to use this to implement a streaming binary protocol encoder/decoder.
Let's say I wanted to implement a chat protocol. I could describe it using the following proto schema:

```proto
message ChatProtocol {
  repeated Message messages = 1;
  repeated string online = 2;

  message Message {
    required string from = 1;
    required string text = 2;
  }
}
```

and then just use pbs to parse it:

``` js
var fs = require('fs')
var pbs = require('pbs')

var messages = pbs(fs.readFileSync('schema.proto'))
var decoder = messages.ChatProtocol.decode()

// read messages

decoder.online(function (username, cb) {
  console.log(username + ' is online!')
  cb()
})

decoder.messages(function (message, cb) {
  console.log(message.from + ' says: ' + message.text)
})

// write messages

var encoder = messages.ChatProtocol.encode()

encoder.online('mafintosh')
encoder.messages({
  from: 'mafintosh',
  text: 'hello world!'
})

// setup the pipeline
encoder.pipe(someTransportStream).pipe(decoder)
```

Since the entire stream is valid protobuf, you could even save it to a file
and parse it using another protobuf parser to debug an application.

## License

MIT
