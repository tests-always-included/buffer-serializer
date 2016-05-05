"use strict";
/**
 * Helper to assist with reading a buffer.  Contains methods that will
 * read specific types that mirror BufferWriter.
 */

module.exports = function () {
    class BufferReader {
        /**
         * Loads an existing buffer into the BufferReader.  Optionally, you
         * may specify the byte that indicates the starting point of the
         * buffer.
         *
         * @param {Buffer} buff
         * @param {number} [offset=0]
         */
        constructor(buff, offset) {
            this.readBuffer = buff;
            this.offset = +offset || 0;
        }


        /**
         * Reads a buffer of a given length.
         *
         * Typically the length is stored before the buffer, so one can
         * use code similar to this:
         *
         *   buff = bufferReader.buffer(bufferReader.size());
         *
         * @param {number} length
         * @return {Buffer}
         */
        buffer(length) {
            var buff;

            buff = this.readBuffer.slice(this.offset, this.offset + length);
            this.offset += length;

            return buff;
        }


        /**
         * Reads an 8-byte big-endian double.
         *
         * @return {number}
         */
        double() {
            var val;

            val = this.readBuffer.readDoubleBE(this.offset);
            this.offset += 8;

            return val;
        }


        /**
         * Look at the current byte but do not increment the offset.  This
         * lets us investigate what we should do in order to decode the
         * next chunk that's in the buffer.
         *
         * @return {number}
         * @throws {Error} when reading beyond the end of the buffer
         */
        peek() {
            var val;

            val = this.readBuffer[this.offset];

            if (val === undefined) {
                throw new Error("Unexpected end of stream");
            }

            return val;
        }


        /**
         * Read an encoded size.  This can only read sizes up to
         * 0x1FFFFFFF.  The size is encoded using something akin to
         * how lengths are stored in LZ77.
         *
         * Peeks at the first byte.  It's high bits determine the
         * length of the integer to read.
         *
         *   0xxx xxxx = 8 bits
         *   10xx xxxx = 16 bits
         *   110x xxxx = 32 bits
         *
         * This can be extended when necessary.
         *
         * @return {number}
         * @throws {Error} when initial byte doesn't match an expected pattern
         */
        size() {
            var b;

            b = this.peek();

            if (! (b & 0x80)) {
                return this.uint8();
            }

            if (! (b & 0x40)) {
                return this.uint16() & 0x3FFF;
            }

            if (! (b & 0x20)) {
                return this.uint32() & 0x1FFFFFFF;
            }

            throw new Error("Invalid size encountered: " + b);
        }


        /**
         * Moves the offset forward without having to read any bytes.
         * Used primarily when one has used peek to scan ahead or when the
         * next byte is already known in advance.
         */
        skip() {
            this.offset += 1;
        }


        /**
         * Reads a string of a given length.  Normally this is written to
         * the buffer with the size preceeding it, and the following code
         * would be seen for decoding the string.
         *
         *   str = bufferReader.string(bufferReader.size());
         *
         * @param {number} length
         * @return {string}
         */
        string(length) {
            var buff;

            buff = this.readBuffer.slice(this.offset, this.offset + length);
            this.offset += length;

            return buff.toString("binary");
        }


        /**
         * Reads an 8-bit unsigned integer.
         *
         * @return {number}
         */
        uint8() {
            var v;

            v = this.readBuffer.readUInt8(this.offset);
            this.offset += 1;

            return v;
        }


        /**
         * Reads a 16-bit big-endian unsigned integer.
         *
         * @return {number}
         */
        uint16() {
            var v;

            v = this.readBuffer.readUInt16BE(this.offset);
            this.offset += 2;

            return v;
        }


        /**
         * Reads a 32-bit big-endian unsigned integer.
         *
         * @return {number}
         */
        uint32() {
            var v;

            v = this.readBuffer.readUInt32BE(this.offset);
            this.offset += 4;

            return v;
        }
    }

    return BufferReader;
}
