var protobuf = require('protocol-buffers')
var encoder = require('./encoder')
var decoder = require('./decoder')

module.exports = function (schema) {
  var pb = protobuf(schema)

  // to not make toString,toJSON enumarable we make a fire-and-forget prototype
  var Messages = function () {
    var self = this

    pb.toJSON().enums.forEach(function (e) {
      self[e.name] = e.values
    })

    pb.toJSON().messages.forEach(function (m) {
      var message = {}
      m.enums.forEach(function (e) {
        message[e.name] = e
      })
      message.name = m.name
      message.encode = encoder(m, pb)
      message.decode = decoder(m, pb)
      self[m.name] = message
    })
  }

  Messages.prototype.toString = function () {
    return pb.toString()
  }

  Messages.prototype.toJSON = function () {
    return pb.toJSON()
  }

  return new Messages()
}
