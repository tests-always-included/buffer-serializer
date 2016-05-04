/**
 * Buffer serializer
 *
 * This just includes the other libraries.  It's performing dependency
 * injection for the other files.  The whole set is written this way to
 * facilitate far easier testing.
 */

var BufferReader, BufferWriter, serializer;

BufferReader = require("./buffer-reader")();
BufferWriter = require("./buffer-writer")();
serializer = require("./serializer")(BufferReader, BufferWriter);

module.exports = serializer;
