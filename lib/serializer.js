"use strict";

/**
 * Serializer - turn things into Buffers
 */

/**
 * @typedef {Object} BufferSerializer~helper
 * @property {Function} checkFn Determines if a value is of this type
 * @property {Function} fromBufferFn
 * @property {string} name Name as it appears in the serialized buffer
 * @property {Function} toBufferFn
 */

module.exports = function (BufferReader, BufferWriter) {
    /**
     * Converts a buffer to a dense array.  This is a list of values
     * and is terminated by "!".
     *
     * @param {BufferSerializer} serializer
     * @param {BufferReader} buffReader
     * @return {Array}
     */
    function fromBufferInternalArrayDense(serializer, buffReader) {
        var result;

        result = [];

        // Read until "!"
        while (buffReader.peek() !== 0x21) {
            result.push(serializer.fromBufferInternal(buffReader));
        }

        // Consume the "!"
        buffReader.skip();

        return result;
    }


    /**
     * Converts a buffer to a sparse array.  This is a list of keys and
     * values, terminated by "!".
     *
     * @param {BufferSerializer} serializer
     * @param {BufferReader} buffReader
     * @return {Array}
     */
    function fromBufferInternalArraySparse(serializer, buffReader) {
        var key, result;

        result = [];

        // Read until "!"
        while (buffReader.peek() !== 0x21) {
            key = serializer.fromBufferInternal(buffReader);
            result[key] = serializer.fromBufferInternal(buffReader);
        }

        // Consume the "!"
        buffReader.skip();

        return result;
    }


    /**
     * Convert a buffer into a Date with milliseconds.
     *
     * @param {BufferReader} buffReader
     * @return {Date}
     */
    function fromBufferInternalObjectDateD(buffReader) {
        var date, seconds;

        date = new Date();
        seconds = buffReader.uint32() * 1000;
        date.setTime(seconds + buffReader.uint16());

        return date;
    }


    /**
     * Convert a buffer into a Date without milliseconds.
     *
     * @param {BufferReader} buffReader
     * @return {Date}
     */
    function fromBufferInternalObjectDateT(buffReader) {
        var date;

        date = new Date();
        date.setTime(buffReader.uint32() * 1000);

        return date;
    }


    /**
     * Convert a buffer into an object.  The buffer will have property
     * names and values, repeating, until "!".
     *
     * @param {BufferSerializer} serializer
     * @param {BufferReader} buffReader
     * @return {Object}
     */
    function fromBufferInternalObjectGeneric(serializer, buffReader) {
        var key, result;

        result = {};

        // Continue until "!"
        while (buffReader.peek() !== 0x21) {
            key = serializer.fromBufferInternal(buffReader);
            result[key] = serializer.fromBufferInternal(buffReader);
        }

        // Consume the "!"
        buffReader.skip();

        return result;
    }


    /**
     * Convert a buffer into a custom registered helper object.
     *
     * @param {BufferSerializer} serializer
     * @param {BufferReader} buffReader
     * @return {*}
     * @throws {Error} can not find helper to decode the object.
     */
    function fromBufferInternalObjectHelper(serializer, buffReader) {
        var i, name;

        name = buffReader.string(buffReader.size());

        for (i = 0; i < serializer.helpers.length; i += 1) {
            if (serializer.helpers[i].name == name) {
                return serializer.helpers[i].fromBufferFn(buffReader);
            }
        }

        throw new Error("Serialized data uses custom helper but it is not defined: " + name);
    }


    /**
     * Convert a buffer into a RegExp.  The pattern is stored as a string
     * and the flags are stored as bit flags.
     *
     * @param {BufferReader} buffReader
     * @return {RegExp}
     */
    function fromBufferInternalObjectRegExp(buffReader) {
        var flags, pattern, patternFlags;

        pattern = buffReader.string(buffReader.size());
        flags = buffReader.uint8();
        patternFlags = "";

        if (flags & 0x01) {
            patternFlags += "g";
        }

        if (flags & 0x02) {
            patternFlags += "i";
        }

        if (flags & 0x04) {
            patternFlags += "m";
        }

        return new RegExp(pattern, patternFlags);
    }


    /**
     * Convert an Array into a buffer.  Detects if the array is dense.
     * If dense, use "a" and encode just the values.  If sparse, encode
     * as "A" and encode each key/value.
     *
     * @param {BufferSerializer} serializer
     * @param {Array} thing
     * @param {BufferWriter} buffWriter
     */
    function toBufferInternalArray(serializer, thing, buffWriter) {
        var i, keys, undefCount;

        keys = Object.keys(thing);

        // Quick check for additional properties
        if (keys.length == thing.length) {
            // Check if any values are undefined
            undefCount = 0;

            for (i = 0; i < thing.length; i += 1) {
                if (thing[i] === undefined) {
                    undefCount += 1;
                    i = thing.length;
                }
            }

            if (undefCount == 0) {
                buffWriter.string("a")

                for (i = 0; i < thing.length; i += 1) {
                    serializer.toBufferInternal(thing[i], buffWriter);
                }

                buffWriter.string("!");

                return;
            }
        }

        // sparse array or additional properties
        buffWriter.string("A");

        for (i = 0; i < keys.length; i += 1) {
            toBufferInternalKey(serializer, keys[i], buffWriter);
            serializer.toBufferInternal(thing[keys[i]], buffWriter);
        }

        buffWriter.string("!");
    }


    /**
     * Write a boolean to the buffer.
     *
     * @param {boolean} thing
     * @param {BufferWriter} buffWriter
     */
    function toBufferInternalBoolean(thing, buffWriter) {
        if (thing) {
            buffWriter.uint8(0x74); // t
        } else {
            buffWriter.uint8(0x66); // f
        }
    }


    /**
     * Write a key to the buffer.  Keys may be strings or numbers (as in
     * the case of sparse arrays).  Since objects change all properties to
     * strings internally, we can encode ones that look like numbers into
     * just plain numbers, saving bytes.
     *
     * @param {BufferSerializer} serializer
     * @param {string} thing
     * @param {BufferWriter} buffWriter
     */
    function toBufferInternalKey(serializer, thing, buffWriter) {
        if (/^(0|[1-9][0-9]*)$/.test(thing)) {
            thing = +thing;
        }

        return serializer.toBufferInternal(thing, buffWriter);
    }


    /**
     * Write a number to a buffer.  Tries to be smart about it and detects
     * all of the following, using the specified prefix:
     *
     *   - negative 8-bit integer
     *   i negative 16-bit integer
     *   I negative 32-bit integer
     *   + positive 8-bit integer
     *   p positive 16-bit integer
     *   P positive 32-bit integer
     *   d double
     *
     * @param {number} thing
     * @param {BufferWriter} buffWriter
     */
    function toBufferInternalNumber(thing, buffWriter) {
        var abs;

        if (Math.floor(thing) == thing) {
            // an integer
            if (thing < 0) {
                // negative integer
                abs = Math.abs(thing);

                if (abs <= 0xFF) {
                    buffWriter.uint8(0x2D); // -
                    buffWriter.uint8(abs);

                    return;
                }

                if (abs <= 0xFFFF) {
                    buffWriter.uint8(0x69);  // i
                    buffWriter.uint16(abs);

                    return;
                }

                if (abs <= 0xFFFFFFFF) {
                    buffWriter.uint8(0x49);  // I
                    buffWriter.uint32(abs);

                    return;
                }
            } else {
                // positive integer
                if (thing <= 0xFF) {
                    buffWriter.uint8(0x2B); // +
                    buffWriter.uint8(thing);

                    return;
                }

                if (thing <= 0xFFFF) {
                    buffWriter.uint8(0x70); // p
                    buffWriter.uint16(thing);

                    return;
                }

                if (thing <= 0xFFFFFFFF) {
                    buffWriter.uint8(0x50); // P
                    buffWriter.uint32(thing);

                    return;
                }
            }
        }

        // Either this is not an integer or it is outside of a 32-bit integer.
        // Store as a double.
        buffWriter.uint8(0x64); // d
        buffWriter.double(thing);
    }


    /**
     * Write an object to a buffer.  This does the detection of object
     * type and chooses the appropriate encoder, passing off the real
     * encoding work to another toBufferInternalObject* function.
     *
     * @param {BufferSerializer} serializer
     * @param {Object} thing
     * @param {BufferWriter} buffWriter
     * @return {Buffer}
     */
    function toBufferInternalObject(serializer, thing, buffWriter) {
        var helper, i;

        for (i = 0; i < serializer.helpers.length; i += 1) {
            helper = serializer.helpers[i];

            if (helper.checkFn(thing)) {
                buffWriter.uint8(0x5A); // Z
                buffWriter.size(helper.name.length);
                buffWriter.string(helper.name);
                helper.toBufferFn(thing, buffWriter);

                return;
            }
        }

        if (thing instanceof Buffer) {
            return toBufferInternalObjectBuffer(thing, buffWriter);
        }

        if (thing instanceof Date) {
            return toBufferInternalObjectDate(thing, buffWriter);
        }

        if (thing instanceof RegExp) {
            return toBufferInternalObjectRegExp(thing, buffWriter);
        }

        return toBufferInternalObjectGeneric(serializer, thing, buffWriter);
    }


    /**
     * Writes a Buffer object to the buffer.
     *
     * @param {Buffer} thing
     * @param {BufferWriter} buffWriter
     */
    function toBufferInternalObjectBuffer(thing, buffWriter) {
        buffWriter.uint8(0x42); // B
        buffWriter.size(thing.length);
        buffWriter.buffer(thing);
    }


    /**
     * Writes a Date object to the buffer.  Attempts to be smart and
     * decides to use "D" if there are milliseconds and "T" if there
     * are not.
     *
     * @param {Buffer} thing
     * @param {BufferWriter} buffWriter
     */
    function toBufferInternalObjectDate(thing, buffWriter) {
        var ms, seconds;

        seconds = thing.getTime();
        ms = seconds % 1000;
        seconds = Math.floor(seconds / 1000);

        if (ms) {
            buffWriter.uint8(0x44); // D
            buffWriter.uint32(seconds);
            buffWriter.uint16(ms);
        } else {
            buffWriter.uint8(0x54); // T
            buffWriter.uint32(seconds);
        }
    }


    /**
     * Writes a plain object to the buffer.  Writes keys and values,
     * then "!" to signify the end.
     *
     * @param {BufferSerializer} serializer
     * @param {Buffer} thing
     * @param {BufferWriter} buffWriter
     */
    function toBufferInternalObjectGeneric(serializer, thing, buffWriter) {
        var i, keys;

        buffWriter.string("O");
        keys = Object.keys(thing);

        for (i = 0; i < keys.length; i += 1) {
            toBufferInternalKey(serializer, keys[i], buffWriter);
            serializer.toBufferInternal(thing[keys[i]], buffWriter);
        }

        buffWriter.string("!");
    }


    /**
     * Writes a RegExp object to the buffer.  Stores the pattern as a
     * string and the modifiers as bit flags.
     *
     * @param {Buffer} thing
     * @param {BufferWriter} buffWriter
     */
    function toBufferInternalObjectRegExp(thing, buffWriter) {
        var flags;

        buffWriter.uint8(0x52); // R
        buffWriter.size(thing.source.length);
        buffWriter.string(thing.source);
        flags = 0;

        if (thing.global) {
            flags += 0x01;
        }

        if (thing.ignoreCase) {
            flags += 0x02;
        }

        if (thing.multiline) {
            flags += 0x04;
        }

        buffWriter.uint8(flags);
    }


    /**
     * Writes a string to the buffer.
     *
     * @param {Buffer} thing
     * @param {BufferWriter} buffWriter
     */
    function toBufferInternalString(thing, buffWriter) {
        buffWriter.uint8(0x73); // s
        buffWriter.size(thing.length);
        buffWriter.string(thing);
    }

    class BufferSerializer {
        /**
         * Creates a new buffer serializer instance.
         */
        constructor() {
            this.helpers = [];
        }


        /**
         * Deserialize a buffer.  Double checks the version before calling
         * the fromBufferInternal* methods.
         *
         * @param {Buffer} buff
         * @param {number} [offset=0]
         * @return {*}
         * @throws {Error} invalid version stored in the buffer
         */
        fromBuffer(buff, offset) {
            var buffReader;

            offset = offset || 0;

            // Only version 0 is supported
            if (buff[offset] !== 0x00) {
                throw new Error("Invalid version identifier");
            }

            buffReader = new BufferReader(buff, offset + 1);

            return this.fromBufferInternal(buffReader);
        }


        /**
         * Deserialize a buffer after the version checks were performed.
         * Reads the stored type code (single byte).  From there it either
         * decodes the information directly or else it passes control to
         * another function.
         *
         * @param {BufferReader} buffReader
         * @return {*}
         * @throws {Error} invalid type code
         */
        fromBufferInternal(buffReader) {
            var code;

            code = buffReader.uint8();

            switch (code) {
            // 0x21 is a marker for ending objects and arrays

            case 0x2B: // + = positive 8-bit integer
                return buffReader.uint8();

            case 0x2D: // - = negative 8-bit integer
                return - buffReader.uint8();

            case 0x41: // A = Array object, sparse
                return fromBufferInternalArraySparse(this, buffReader);

            case 0x42: // B = Buffer object
                return buffReader.buffer(buffReader.size());

            case 0x44: // D = Date object with milliseconds
                return fromBufferInternalObjectDateD(buffReader);

            case 0x49: // I = negative 32-bit integer
                return - buffReader.uint32();

            case 0x4f: // O = object, generic
                return fromBufferInternalObjectGeneric(this, buffReader);

            case 0x50: // P = positive 32-bit integer
                return buffReader.uint32();

            case 0x52: // R = RegExp
                return fromBufferInternalObjectRegExp(buffReader);

            case 0x54: // T = Date object without milliseconds
                return fromBufferInternalObjectDateT(buffReader);

            case 0x5A: // Z = custom object
                return fromBufferInternalObjectHelper(this, buffReader);

            case 0x61: // a = Array, dense
                return fromBufferInternalArrayDense(this, buffReader);

            case 0x64: // d = 8-byte double
                return buffReader.double();

            case 0x66: // f = false
                return false;

            case 0x69: // i = negative 16-bit integer
                return - buffReader.uint16();

            case 0x6e: // n = null
                return null;

            case 0x70: // p = positive 16-bit integer
                return buffReader.uint16();

            case 0x73: // s = string
                return buffReader.string(buffReader.size());

            case 0x74: // t = true
                return true;
            }

            throw new Error("Unable to deserialize string, unknown code: " + code);
        }


        /**
         * Register a custom object type for serialization.
         *
         * @param {string} name Shorter names mean smaller serialized buffers.
         * @param {Function(obj)} checkFn Returns true if obj is the one you want.
         * @param {Function(obj,BufferWriter)} toBufferFn Write to the BufferWriter
         * @param {Function(BufferReader)} fromBufferFn Change buffer back to object
         */
        register(name, checkFn, toBufferFn, fromBufferFn) {
            this.helpers.push({
                checkFn: checkFn,
                fromBufferFn: fromBufferFn,
                name: name,
                toBufferFn: toBufferFn
            });
        }


        /**
         * Convert something to a buffer.  Creates the new BufferWriter and
         * kicks off the internal functions.
         *
         * @param {*} thing
         * @return {Buffer}
         */
        toBuffer(thing) {
            var buffWriter;

            buffWriter = new BufferWriter();
            buffWriter.uint8(0);
            this.toBufferInternal(thing, buffWriter);

            return buffWriter.toBuffer();
        }


        /**
         * Convert something to a buffer, writing it using the passed
         * BufferWriter instance.
         *
         * @param {*} thing
         * @param {BufferWriter} buffWriter
         * @throws {Error} when encountering an invalid type
         */
        toBufferInternal(thing, buffWriter) {
            var type;

            type = typeof thing;

            if (type === "object") {
                if (!thing) {
                    // thing is a null
                    return buffWriter.uint8(0x6e); // n
                }

                if (Array.isArray(thing)) {
                    return toBufferInternalArray(this, thing, buffWriter);
                }

                return toBufferInternalObject(this, thing, buffWriter);
            }

            if (type === "string") {
                // Does not need the serializer
                return toBufferInternalString(thing, buffWriter);
            }

            if (type === "number") {
                // Does not need the serializer
                return toBufferInternalNumber(thing, buffWriter);
            }

            if (type === "boolean") {
                // Does not need the serializer
                return toBufferInternalBoolean(thing, buffWriter);
            }

            throw new Error("Invalid type: " + type)
        }
    }

    return BufferSerializer;
}
