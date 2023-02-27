"use strict";

describe("serializer", () => {
    var BufferReader, BufferWriter, serializer;

    beforeEach(() => {
        var BufferSerializer;

        BufferSerializer = require("../");
        serializer = new BufferSerializer();
        BufferReader = require("../lib/buffer-reader")();
        BufferWriter = require("../lib/buffer-writer")();
    });
    [
        {
            bufferHex: "2B3E",
            name: "0x2B + positive 8-bit integer",
            raw: 62
        },
        {
            bufferHex: "2D3C",
            name: "0x2D - negative 8-bit integer",
            raw: -60
        },
        {
            // Difficult to test because Object.keys() does not have an order
            //          A s 4 p r o p s 3 v a l !
            bufferHex: "41730470726F70730376616C21",
            name: "0x41 A Array, property",
            raw: (() => {
                var a;

                a = []
                a.prop = "val";

                return a;
            })()
        },
        {
            // Difficult to test because Object.keys() does not have an order
            //          A + 2 s 3 t w o !
            bufferHex: "412B02730374776F21",
            name: "0x41 A Array, sparse",
            raw: (() => {
                var a;

                a = []
                a[2] = "two";

                return a;
            })()
        },
        {
            bufferHex: "420474657374",
            name: "0x42 B Buffer object",
            raw: Buffer.from("test")
        },
        {
            bufferHex: "44568672700001",
            name: "0x44 D Date object with milliseconds",
            raw: new Date("2016-01-01T12:34:56.001Z")
        },
        {
            bufferHex: "4900031920",
            name: "0x49 I negative 32-bit integer",
            raw: -203040
        },
        {
            //          O s 3 o b j t !
            bufferHex: "4F73036F626A7421",
            name: "0x4F O object, generic",
            raw: {
                obj: true
            }
        },
        {
            bufferHex: "5000031920",
            name: "0x50 P positive 32-bit integer",
            raw: 203040
        },
        {
            bufferHex: "52047061747405",
            name: "0x52 R RegExp object",
            raw: new RegExp("patt", "gm")
        },
        {
            bufferHex: "5456867270",
            name: "0x54 T Date object without milliseconds",
            raw: new Date("2016-01-01T12:34:56Z")
        },
        {
            //          a + 1 t !
            bufferHex: "612B017421",
            name: "0x61 a Array, dense",
            raw: [ 1, true ]
        },
        {
            bufferHex: "643FF4000000000000",
            name: "0x64 d 8-byte double",
            raw: 1.25
        },
        {
            bufferHex: "66",
            name: "0x66 f false",
            raw: false
        },
        {
            bufferHex: "69012C",
            name: "0x69 i negative 16-bit integer",
            raw: -300
        },
        {
            bufferHex: "6E",
            name: "0x6E n null",
            raw: null
        },
        {
            bufferHex: "70012C",
            name: "0x70 p positive 16-bit integer",
            raw: 300
        },
        {
            bufferHex: "7303616263",
            name: "0x73 s string",
            raw: "abc"
        },
        {
            bufferHex: "74",
            name: "0x74 t true",
            raw: true
        }
    ].forEach((scenario) => {
        it("serializes: " + scenario.name, () => {
            var buff;

            buff = serializer.toBuffer(scenario.raw);
            expect(buff).toEqual(jasmine.any(Buffer));
            expect(buff.toString("hex").toUpperCase()).toBe("00" + scenario.bufferHex);
        });
        it("serializes internally: " + scenario.name, () => {
            var buff, bw;

            bw = new BufferWriter();
            serializer.toBufferInternal(scenario.raw, bw);
            buff = bw.toBuffer();
            expect(buff).toEqual(jasmine.any(Buffer));
            expect(buff.toString("hex").toUpperCase()).toBe(scenario.bufferHex);
        });
        it("deserializes: " + scenario.name, () => {
            var buff, result;

            buff = Buffer.from("00" + scenario.bufferHex, "hex");
            result = serializer.fromBuffer(buff);

            if (Buffer.isBuffer(scenario.raw)) {
                expect(result.toString("hex")).toEqual(scenario.raw.toString("hex"));
            } else {
                expect(result).toEqual(scenario.raw);
            }
        });
        it("deserializes internally: " + scenario.name, () => {
            var br, buff, result;

            buff = Buffer.from(scenario.bufferHex, "hex");
            br = new BufferReader(buff);
            result = serializer.fromBufferInternal(br);

            if (Buffer.isBuffer(scenario.raw)) {
                expect(result.toString("hex")).toEqual(scenario.raw.toString("hex"));
            } else {
                expect(result).toEqual(scenario.raw);
            }
        });
    });
    describe("with bad input", () => {
        it("fails with non-zero version identifier", () => {
            expect(() => {
                serializer.fromBuffer(Buffer.from("0174", "hex"));
            }).toThrow();
        });
        it("errors when encountering an invalid code", () => {
            expect(() => {
                serializer.fromBufferInternal(Buffer.from("00", "hex"));
            }).toThrow();
        });
        it("errors when a helper is not found", () => {
            expect(() => {
                var buffReader;

                // Looks for a helper named "x"
                buffReader = new BufferReader(Buffer.from("5A0178", "hex"));
                serializer.fromBufferInternal(buffReader);
            }).toThrow();
        });
        it("fails with Symbols", () => {
            expect(() => {
                /*global Symbol*/
                serializer.toBuffer(Symbol());
            }).toThrow();
        });
        it("fails with undefined", () => {
            expect(() => {
                serializer.toBuffer(undefined);
            }).toThrow();
        });
    });
    describe("custom objects", () => {
        var Klass;

        beforeEach(() => {
            Klass = function testClass(val) {
                this.val = val;
            };
            Klass.prototype.getVal = function () {
                return this.val;
            };
            serializer.register("Klass", (thing) => {
                return thing instanceof Klass;
            }, (thing, bufferWriter) => {
                bufferWriter.size(thing.getVal());
            }, (bufferReader) => {
                return new Klass(bufferReader.size());
            });
        });
        it("serializes a custom class", () => {
            var buff, k;

            k = new Klass(2);
            buff = serializer.toBuffer(k);
            expect(buff).toEqual(jasmine.any(Buffer));
            expect(buff.toString("hex").toUpperCase()).toEqual("005A054B6C61737302");
        });
        it("deserializes a custom class", () => {
            var k;

            k = serializer.fromBuffer(Buffer.from("005A054B6C61737302", "hex"));
            expect(k).toEqual(jasmine.any(Klass));
            expect(k.getVal()).toEqual(2);
        });
    });
});
