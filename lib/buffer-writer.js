"use strict";
/**
 * Helper to assist with reading a buffer.  Contains methods that will
 * read specific types that mirror BufferReader.
 */

module.exports = function () {
    class BufferWriter {
        /**
         * Creates a new BufferWriter, which is essentially an array of
         * Buffers and a few methods to help you add to the list of buffers.
         */
        constructor() {
            this.bufferList = [];
        }


        /**
         * Adds a buffer to the list.  This does not encode the length.
         * You will typically want to write code like this:
         *
         *   bufferWriter.size(buff.length);
         *   bufferWriter.buffer(buff);
         *
         * @param {Buffer} buff
         */
        buffer(buff) {
            this.bufferList.push(buff);
        }


        /**
         * Adds an 8-byte big-endian double.
         *
         * @param {number} val
         */
        double(val) {
            var buff;

            buff = Buffer.alloc(8);
            buff.writeDoubleBE(val);
            this.bufferList.push(buff);
        }


        /**
         * Encodes a size using a mechanism like LZ77 distances.  This uses
         * a method to consume fewer bytes than just storing doubles or
         * uint32.  It's limited to a range of 0 to 0x1FFFFFFF.
         *
         * @param {number} s
         * @throws {Error} when negative
         * @throws {Error} when excessively large
         */
        size(s) {
            if (s < 0) {
                throw new Error("Sizes must be positive");
            }

            if (s < 0x7F) {
                return this.uint8(s);
            }

            if (s < 0x3FFF) {
                return this.uint16(s | 0x8000);
            }

            if (s < 0x1FFFFFFF) {
                // Note: using s | 0xC0000000 results in a signed integer
                return this.uint32(s + 0xC0000000);
            }

            throw new Error("Can not encode size; too large: " + s);
        }


        /**
         * Adds a string to the buffer.  Does not add the length of the
         * string, which is necessary for decoding.  Normally you would use
         * the method like this example:
         *
         *   bufferWriter.size(str.length);
         *   bufferWriter.string(str);
         *
         * @param {string} str
         */
        string(str) {
            this.bufferList.push(Buffer.from(str, "binary"));
        }


        /**
         * Converts the internal array of buffers into a single Buffer.
         *
         * @return {Buffer}
         */
        toBuffer() {
            return Buffer.concat(this.bufferList);
        }


        /**
         * Writes an unsigned 8-bit integer.
         *
         * @param {number} val
         */
        uint8(val) {
            var buff;

            buff = Buffer.alloc(1);
            buff.writeUInt8(val);
            this.bufferList.push(buff);
        }


        /**
         * Writes an unsigned big-endian 16-bit integer.
         *
         * @param {number} val
         */
        uint16(val) {
            var buff;

            buff = Buffer.alloc(2);
            buff.writeUInt16BE(val);
            this.bufferList.push(buff);
        }


        /**
         * Writes an unsigned big-endian 32-bit integer.
         *
         * @param {number} val
         */
        uint32(val) {
            var buff;

            buff = Buffer.alloc(4);
            buff.writeUInt32BE(val);
            this.bufferList.push(buff);
        }
    }

    return BufferWriter;
}
