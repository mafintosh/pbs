var protobuf = require('protocol-buffers')
var encoder = require('./encoder')
var decoder = require('./decoder')

module.exports = function (schema) {
  var pb = protobuf(schema)

  var result = {}

  pb.toJSON().messages.forEach(function (m) {
    result[m.name] = {
      name: m.name,
      encode: encoder(m, pb),
      decode: decoder(m, pb)
    }
  })

  return result
}
