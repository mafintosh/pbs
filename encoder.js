var stream = require('readable-stream')
var util = require('util')
var encodings = require('protocol-buffers/encodings')
var varint = require('varint')

var noop = function () {}

module.exports = function (message, protobuf) {
  var Encoder = function () {
    if (!(this instanceof Encoder)) return new Encoder()
    stream.Readable.call(this)
    this._drain = null
  }

  util.inherits(Encoder, stream.Readable)

  message.fields.forEach(function (field) {
    var e = encodings[field.type] || protobuf[field.type] || protobuf[message.name][field.type]
    var prefix = field.tag << 3 | e.type
    var prefixLen = varint.encodingLength(prefix)

    Encoder.prototype[field.name] = function (data, cb) {
      if (!cb) cb = noop

      var offset = 0
      var len = e.encodingLength(data)
      var buf = new Buffer(prefixLen + (e.message ? varint.encodingLength(len) : 0) + len)

      varint.encode(prefix, buf, offset)
      offset += varint.encode.bytes
      if (e.message) {
        varint.encode(len, buf, offset)
        offset += varint.encode.bytes
      }
      e.encode(data, buf, offset)

      if (this.push(buf)) return cb()
      this._drain = cb
    }
  })

  Encoder.prototype._read = function () {
    if (!this._drain) return
    var drain = this._drain
    this._drain = null
    drain()
  }

  Encoder.prototype.finalize = function () {
    this.push(null)
  }

  return Encoder
}
