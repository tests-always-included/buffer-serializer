"use strict";

describe("BufferWriter", () => {
    var BufferWriter;

    beforeEach(() => {
        BufferWriter = require("../lib/buffer-writer")();
    });
    it("makes an object", () => {
        expect(() => {
            new BufferWriter();
        }).not.toThrow();
    });
    [
        "buffer",
        "double",
        "size",
        "string",
        "toBuffer",
        "uint8",
        "uint16",
        "uint32"
    ].forEach((methodName) => {
        it("exposes the method " + methodName, () => {
            var bw;

            bw = new BufferWriter();
            expect(bw[methodName]).toEqual(jasmine.any(Function));
        });
    });
    it("writes a buffer", () => {
        var buff, bw;

        bw = new BufferWriter();
        bw.buffer(Buffer.from("abc"));
        bw.buffer(Buffer.from("defghi"));
        buff = bw.toBuffer();
        expect(buff).toEqual(jasmine.any(Buffer));
        expect(buff.toString("binary")).toEqual("abcdefghi");
    });
    it("writes a double", () => {
        var buff, bw;

        bw = new BufferWriter();
        bw.double(0.000030525028705596924);
        bw.double(156842099844.51764);
        buff = bw.toBuffer();
        expect(buff).toEqual(jasmine.any(Buffer));
        expect(buff.toString("hex").toUpperCase()).toEqual("3F000100000000004242424242424242");
    });
    it("encodes sizes as different lengths", () => {
        var buff, bw;

        bw = new BufferWriter();
        bw.size(1);
        bw.size(128);  // Lowest number for the next size
        bw.size(16384);  // Lowest number for the next size
        buff = bw.toBuffer();
        expect(buff).toEqual(jasmine.any(Buffer));
        expect(buff.toString("hex").toUpperCase()).toEqual("018080C0004000");
    });
    it("errors if the size is negative", () => {
        var bw;

        bw = new BufferWriter();
        expect(() => {
            bw.size(-1);
        }).toThrow();
    });
    it("errors if the size is too large", () => {
        var bw;

        bw = new BufferWriter();
        expect(() => {
            bw.size(0x20000000);
        }).toThrow();
    });
    it("writes strings", () => {
        var buff, bw;

        bw = new BufferWriter();
        bw.string("abcd");
        bw.string("ef");
        buff = bw.toBuffer();
        expect(buff).toEqual(jasmine.any(Buffer));
        expect(buff.toString("binary")).toBe("abcdef");
    });
    it("writes integers", () => {
        var buff, bw;

        bw = new BufferWriter();
        bw.uint8(0x01);
        bw.uint16(0x2345);
        bw.uint32(0x6789ABCD);
        buff = bw.toBuffer();
        expect(buff).toEqual(jasmine.any(Buffer));
        expect(buff.toString("hex").toUpperCase()).toBe("0123456789ABCD");
    });
});
