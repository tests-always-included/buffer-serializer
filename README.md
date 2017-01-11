Buffer Serializer
=================

Convert nearly anything into a buffer, and then convert it back into the original object.

Does not handle values that are or contain the following:

* `Function`: It is impossible to recreate the scope properly for the function.
* `Symbol`: Because one can not get a name for a symbol that's the same between two runs of the code, this can not be supported.
* `undefined`: If it is undefined, it is assumed you do not want to write this value to the buffer.

You may implement your own serialization routines to override this behavior if you require a `Symbol` or `Function` to be encoded in the buffer.

This is presented as an alternative to [js-binary](https://github.com/sitegui/js-binary).  That one requires a schema where as this one acts more like JSON.

[![npm version][npm-badge]][npm-link]
[![Build Status][travis-badge]][travis-link]
[![Dependencies][dependencies-badge]][dependencies-link]
[![Dev Dependencies][devdependencies-badge]][devdependencies-link]


Usage
-----

First, include `buffer-serializer` in your list of dependencies in your `package.json` file.  You can do this with one command.

    npm install --save buffer-serializer

Next, you write some code.

    var aBuffer, BufferSerializer, myThing, result, serializer;

    BufferSerializer = require("buffer-serializer");
    serializer = new BufferSerializer();

    myThing = {
        key: "value",
        number: 123.456,
        date: new Date(),
        buffer: new Buffer(10)
    }

    console.log("before serialization", myThing);
    aBuffer = serializer.toBuffer(myThing);
    console.log("serialized", aBuffer.toString("hex"));
    result = serializer.fromBuffer(aBuffer);
    console.log("buffer bytes consumed", result.bufferBytes);
    console.log("after serialization", result.data);


Learning about Other Objects
----------------------------

You can teach the serializer about other object types as well.  To do that you need to register custom handlers to convert the data into a buffer and a second function that converts the buffer back into your object.  Here's an example for a Date object.

    // This example is NOT used inside the serializer.
    // This code is provided only for illustrative purposes.
    serializer.register("Date", function checkFn(value) {
        return value instanceof Date;
    }, function toBufferFn(value, bufferWriter) {
        // Convert to just a Unix timestamp and call the serializer to
        // change this number into a Buffer.  You can, if you wish,
        // return a Buffer object yourself or an array of Buffer
        // objects.
        serializer.toBufferInternal(value.getTime(), bufferWriter);
    }, function fromBufferFn(bufferReader) {
        var date, time;

        // The Buffer stores a number.  Convert it into a usable number.
        // Then create a new Date object and set it to the Unix timestamp
        // returned by `serializer.fromBuffer()`.
        time = serializer.fromBufferInternal(bufferReader);
        date = new Date();
        date.setTime(time);

        return date;
    });


Structure of Buffer
-------------------

The returned buffer has a structure like this:

    Version Record

* Version: 0x00 (there is only one version of this data to date)
* Record: TypeCode TypePayload

Each data type is encoded differently.  Here's a rundown of the types:

* array (dense): "a" "[" value ... "]"
    * Indices start at 0 and continue without interruption to the last index.
    * No other properties are on the object.  * value: serialized form of the value
* array (sparse or additional properties): "a" "{" property value ... "}"
    * property: serialized form of the array index or property
    * value: serialized form of the value
* double: "d" DoubleBE
    * DoubleBE: 8 bytes representing the number
* false: "f"
* negative integer (8-bit): "-" UInt8
    * Only used if Math.abs(number) >= 0 and < 2^6 (256)
    * UInt8: 1 byte representing Math.abs(number)
* negative integer (16-bit): "i" UInt32BE
    * Only used if Math.abs(number) >= 0 and < 2^16 (65,536)
    * UInt16BE: 2 bytes representing Math.abs(number)
* negative integer (32-bit): "I" Int32BE
    * Only used if Math.abs(number) >= 0 and < 2^32 (4,294,967,296)
    * UInt32BE: 4 bytes representing Math.abs(number)
* null: "n"
* object: "o" "{" property value ... "}"
    * property: serialized form of the array index or property
    * value: serialized form of the value
* positive integer (8-bit): "+" UInt8
    * Only used if the number >= 0 and < 2^6 (256)
    * UInt8: 1 byte representing the number
* positive integer (16-bit): "p" UInt16BE
    * Only used if the number >= 0 and < 2^16 (65,536)
    * UInt16BE: 2 bytes representing the number
* positive integer (32-bit): "P" UInt32BE
    * Only used if the number >= 0 and < 2^32 (4,294,967,296)
    * UInt32BE: 4 bytes representing the number
* string: "s" size StringValue
    * size: size of string (see below)
    * StringValue: a buffer representing the value of the string
* true: "t"

There's built in support for these objects:

* Buffer: "B" size BufferValue
    * size: size of the buffer (see below)
    * BufferValue: Contents of the Buffer
* Date with milliseconds: "D" UInt32BE UInt16BE
    * UInt32BE: Unix time from the Date object (seconds)
    * UInt16BE: Unix time from the Date object (milliseconds)
* RegExp: "R" size Pattern UInt8
    * size: length of the pattern (see below)
    * Pattern: The pattern string
    * UInt8: flags bitmask
        * 0x01: "g"
        * 0x02: "i"
        * 0x04: "m"
* Date without milliseconds: "T" UInt32BE UInt16BE
    * UInt32BE: Unix time from the Date object (seconds)

Custom objects are encoded slightly differently.

* Custom object: "z" size name data
    * size: size of the name string (see below)
    * name: Name under which this custom object was registered.
    * data: The resulting buffer after the custom handler encoded it.

Sizes are encoded in a way to try to conserve bytes.  This does mean that there's a limit on the size of the data that's being encoded, but the limit is currently 2^29 bytes (500mb).  The format allows for expansion at a later time.

* 0-128 (0-0x7F): 0xxx xxxx
    * Value is encoded as UInt8BE
* 128-16,383 (0x80-0x3FFF): 10xx xxxx  xxxx xxxx
    * Value + 0x8000 is encoded as UInt16BE
* 16,384-536,870,911 (0x4000-0x1FFFFFFF): 110x xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx
    * Value + 0xC0000000 is encoded as UInt32BE


Full API
--------


### `serializer = new BufferSerializer()`

Create a new instance of the serializer.


### `serializer.register(name, checkFn, toBufferFn, fromBufferFn)`

The following objects are already supported by the library using more efficient functions.  Registering any of these will not use the native serializer for the objects.

* `Buffer`
* `Date`

Will throw an `Error` when there are invalid parameters.


### `result = serializer.fromBuffer(buffer)`

Converts the `Buffer` that's passed in back into the original object.

The `result` object contains the following properties:

* `bufferBytes`: how many bytes in the buffer were used.
* `data`: the deserialized value.

When an object was registered with a custom handler when `toBuffer()` was called, but it is not registered with that same custom handler when `fromBuffer()` is invoked, this will throw an `Error`.


### `result = serializer.fromBufferInternal(bufferReader)`

Returns the deserialized version of the data.  Meant to be used by the library and registered object handlers.  This does not use the version number that's encoded in the record.  The buffer reader object is a helper to consume bytes and track the position inside the buffer.


### `buffer = serializer.toBuffer(anything)`

Converts `anything` into a `Buffer`.  May use registered helpers for objects.

If an object is found and is not registered, it will be converted into a plain object.  That means when converting back from a Buffer, the `fromBuffer()` method will not return it to the original state.

Throws an `Error` if a custom handler does not return a `Buffer`.


### `arrayOrBuffer = serializer.toBufferInternal(anything, bufferWriter)`

Returns an array of buffers or a single buffer.  Used internally and can be used for custom object handlers.  These buffers do not have the version number at the beginning of the record.

The buffer writer object is available to help make writing to the buffer easier.


License
-------

This project is placed under an [MIT License][LICENSE].


[dependencies-badge]: https://img.shields.io/david/tests-always-included/buffer-serializer.svg
[dependencies-link]: https://david-dm.org/tests-always-included/buffer-serializer
[devdependencies-badge]: https://img.shields.io/david/dev/tests-always-included/buffer-serializer.svg
[devdependencies-link]: https://david-dm.org/tests-always-included/buffer-serializer#info=devDependencies
[LICENSE]: LICENSE.md
[npm-badge]: https://img.shields.io/npm/v/buffer-serializer.svg
[npm-link]: https://npmjs.org/package/buffer-serializer
[travis-badge]: https://img.shields.io/travis/tests-always-included/buffer-serializer/master.svg
[travis-link]: http://travis-ci.org/tests-always-included/buffer-serializer
