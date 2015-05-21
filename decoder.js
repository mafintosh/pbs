var stream = require('readable-stream')
var util = require('util')
var encodings = require('protocol-buffers/encodings')
var varint = require('varint')
var genfun = require('generate-function')

var SIGNAL_FLUSH = new Buffer([0])

var prefixedEncodings = {
  bytes: function (data, offset, end) {
    if (!offset && data.length === end) return data
    return data.slice(offset, end)
  },
  string: function (data, offset, end) {
    return data.toString('utf-8', offset, end)
  }
}

module.exports = function (message, protobuf) {
  var encoders = []

  var dummy = function (data, cb) {
    cb()
  }

  var Decoder = function () {
    if (!(this instanceof Decoder)) return new Decoder()
    stream.Writable.call(this)

    this._tag = -1
    this._type = -1
    this._prefix = -1
    this._missing = 0
    this._message = null
    this._buffer = new Buffer(100)
    this._ptr = 0
    this._resultPtr = 0

    this._received = []
    for (var i = 0; i < message.fields.length; i++) this._received[i] = false
    this._handlers = new Array(encoders.length)
    for (var j = 0; j < this._handlers.length; j++) this._handlers[j] = dummy
  }

  util.inherits(Decoder, stream.Writable)

  var decode = genfun()('function (packet, start, end, cb) {')

  decode('switch (this._tag) {')

  message.fields.forEach(function (field, i) {
    encoders.push(prefixedEncodings[field.type] || (encodings[field.type] || protobuf[field.type] || protobuf[message.name][field.type]).decode)
    decode('case %d:', field.tag)
    if (!field.repeated) {
      decode('if (this._received[%d]) return cb()', i)
      decode('this._received[%d] = true', i)
    }
    decode('try {')
    decode('var p%d = encoders[%d](packet, start, end)', i, i)
    decode('} catch (err) {')
    decode('return cb(err)')
    decode('}')
    decode('this._handlers[%d](p%d, cb)', i, i)
    decode('break\n')
  })

  decode('default:')
  decode('cb()')
  decode('break')

  decode('}')
  decode('}')

  Decoder.prototype._decode = decode.toFunction({encoders: encoders})

  Decoder.prototype._parseVarint = function (data, offset, cb) {
    for (offset; offset < data.length; offset++) {
      this._buffer[this._ptr++] = data[offset]
      if (!(data[offset] & 0x80)) {
        this._resultPtr = this._ptr
        this._ptr = 0
        return offset + 1
      }
      if (this._ptr === this._buffer.length) {
        cb(new Error('Incoming varint is to large (>100 bytes)'))
        return -1
      }
    }
    return data.length
  }

  Decoder.prototype._parseMissing = function (data, offset, cb) {
    var free = data.length - offset
    var missing = this._missing
    var message = this._message

    if (!message) {
      if (missing <= free) { // fast track - no copy
        this._missing = 0
        this._ptr = 0
        this._message = null
        if (!this._pushMessage(data, offset, offset + missing, data, offset + missing, cb)) return -1
        return offset + missing
      }
      message = this._message = new Buffer(missing)
    }

    data.copy(message, this._ptr, offset, offset + missing)

    if (missing <= free) {
      this._missing = 0
      this._ptr = 0
      this._message = null
      if (!this._pushMessage(message, 0, message.length, data, offset + missing, cb)) return -1
      return offset + missing
    }

    this._missing -= free
    this._ptr += free

    return data.length
  }

  Decoder.prototype._pushMessage = function (packet, start, end, data, offset, cb) {
    var tick = true
    var called = false
    var self = this

    // TODO: any speedup in not declaring this function all the time?
    this._decode(packet, start, end, function (err) {
      if (err) return cb(err)
      called = true
      if (!tick && !self._destroyed) self._parse(data, offset, cb)
    })

    tick = false
    return called && !self._destroyed
  }

  Decoder.prototype._parse = function (data, offset, cb) {
    while (offset < data.length) {
      if (this._missing) {
        offset = this._parseMissing(data, offset, cb)
        if (offset < 0) return
        continue
      }

      offset = this._parseVarint(data, offset, cb)
      if (offset < 0) return
      if (!this._resultPtr) continue

      var ptr = this._resultPtr
      this._resultPtr = 0
      this._ptr = 0

      if (this._prefix === -1) {
        this._prefix = varint.decode(this._buffer)
        this._tag = this._prefix >> 3
        this._type = this._prefix & 7

        switch (this._type) {
          case 1:
          this._missing = 8
          this._prefix = -1
          break

          case 3:
          case 4:
          return cb(new Error('Groups are not supported'))

          case 5:
          this._missing = 4
          this._prefix = -1
          break
        }
      } else {
        if (this._type === 0) {
          if (!this._pushMessage(this._buffer, 0, ptr, data, offset, cb)) return
        } else {
          this._missing = varint.decode(this._buffer)
        }

        this._prefix = -1
      }
    }

    cb()
  }

  Decoder.prototype._write = function (data, enc, cb) {
    if (this._destroyed) return cb()
    if (data === SIGNAL_FLUSH) return this._finish(cb)
    this._parse(data, 0, cb)
  }

  Decoder.prototype._finish = function (cb) {
    for (var i = 0; i < message.fields.length; i++) {
      var f = message.fields[i]
      if (f.required && !this._received[i]) return this.destroy(new Error('Did not receive required field: ' + f.name))
    }
    cb()
  }

  Decoder.prototype.destroy = function (err) {
    if (this._destroyed) return
    this._destroyed = true
    if (err) this.emit('error', err)
    this.emit('close')
  }

  Decoder.prototype.end = function (data, enc, cb) {
    if (typeof data === 'function') return this.end(null, null, data)
    if (typeof enc === 'function') return this.end(data, null, enc)

    if (data) this.write(data)
    if (!this._writableState.ending) this.write(SIGNAL_FLUSH)
    stream.Writable.prototype.end.call(this, cb)
  }

  message.fields.forEach(function (field, i) {
    if (Decoder.prototype[field.name]) throw new Error('Invalid field name: ' + field.name)
    Decoder.prototype[field.name] = function (fn) {
      this._handlers[i] = fn
      return this
    }
  })

  return Decoder
}
