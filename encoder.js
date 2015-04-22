var stream = require('readable-stream')
var util = require('util')
var encodings = require('protocol-buffers/encodings')
var varint = require('varint')

var noop = function () {}

module.exports = function (message, protobuf) {
  var Encoder = function () {
    if (!(this instanceof Encoder)) return new Encoder()
    stream.Readable.call(this)
    this._destroyed = false
    this._drain = null
    this._sent = []
    for (var i = 0; i < message.fields.length; i++) this._sent[i] = false
  }

  util.inherits(Encoder, stream.Readable)

  Encoder.prototype.destroy = function (err) {
    if (this._destroyed) return
    this._destroyed = true
    if (err) this.emit('error', err)
    this.emit('close')
  }

  Encoder.prototype._read = function () {
    if (!this._drain) return
    var drain = this._drain
    this._drain = null
    drain()
  }

  Encoder.prototype.finalize = function () {
    for (var i = 0; i < message.fields.length; i++) {
      var f = message.fields[i]
      if (f.required && !this._sent[i]) return this.destroy(new Error('Did not send required field: ' + f.name))
    }
    this.push(null)
  }

  message.fields.forEach(function (field, i) {
    var e = encodings[field.type] || protobuf[field.type] || protobuf[message.name][field.type]
    var prefix = field.tag << 3 | e.type
    var prefixLen = varint.encodingLength(prefix)
    var repeated = field.repeated

    if (Encoder.prototype[field.name]) throw new Error('Invalid field name: ' + field.name)

    Encoder.prototype[field.name] = function (data, cb) {
      if (!cb) cb = noop
      if (this._destroyed) return cb()
      if (!repeated && this._sent[i]) return cb()
      this._sent[i] = true

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

  return Encoder
}
