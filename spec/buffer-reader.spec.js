"use strict";

describe("BufferReader", () => {
    var BufferReader;

    beforeEach(() => {
        BufferReader = require("../lib/buffer-reader")();
    });
    it("exports a class", () => {
        expect(BufferReader).toEqual(jasmine.any(Function));
    });
    [
        "buffer",
        "double",
        "peek",
        "size",
        "skip",
        "string",
        "uint8",
        "uint16",
        "uint32"
    ].forEach((methodName) => {
        it("exposes the method: " + methodName, () => {
            var br;

            expect(() => {
                br = new BufferReader(Buffer.alloc(1), 0);
            }).not.toThrow();
            expect(br[methodName]).toEqual(jasmine.any(Function));
        });
    });
    it("reads a buffer", () => {
        var br, buff;

        br = new BufferReader(Buffer.from("abcdefg"), 3);
        buff = br.buffer(2);
        expect(buff.length).toBe(2);
        expect(buff.toString("binary")).toBe("de");
        buff = br.buffer(1);
        expect(buff.length).toBe(1);
        expect(buff.toString("binary")).toBe("f");
    });
    it("reads a double", () => {
        var br, buff;

        buff = Buffer.alloc(16);
        buff.fill(0x42);
        buff[0] = 0x3F;
        buff[1] = 0;
        buff[2] = 1;
        buff[3] = 0;
        buff[4] = 0;
        buff[5] = 0;
        buff[6] = 0;
        buff[7] = 0;
        br = new BufferReader(buff, 0);
        expect(br.double()).toBe(0.000030525028705596924);
        expect(br.double()).toBe(156842099844.51764);
    });
    it("peeks and skips", () => {
        var br;

        br = new BufferReader(Buffer.from("abcd"), 2);
        expect(br.peek()).toBe("c".charCodeAt(0));

        // Pointer does not advance with this method
        expect(br.peek()).toBe("c".charCodeAt(0));

        // Advance pointer
        br.skip();
        expect(br.peek()).toBe("d".charCodeAt(0));

        // Advance pointer beyond end
        br.skip();
        expect(() => {
            br.peek()
        }).toThrow();
    });
    it("reads different sized sizes", () => {
        var br, buff;

        buff = Buffer.alloc(7);
        buff[0] = 0x01;  // 1 byte
        buff[1] = 0x80;
        buff[2] = 0x02;  // 2 bytes
        buff[3] = 0xC0;
        buff[4] = 0x00;
        buff[5] = 0x00;
        buff[6] = 0x04;  // 4 bytes
        br = new BufferReader(buff, 0);
        expect(br.size()).toBe(1);
        expect(br.size()).toBe(2);
        expect(br.size()).toBe(4);
    });
    it("reads a string", () => {
        var br;

        br = new BufferReader(Buffer.from("abcdefghijklm"), 4);
        expect(br.string(5)).toBe("efghi");
        expect(br.string(3)).toBe("jkl");
    });
    it("reads different sized integers", () => {
        var br, buff;

        buff = Buffer.alloc(7);
        buff[0] = 0x01;  // 1 byte
        buff[1] = 0x80;
        buff[2] = 0x02;  // 2 bytes
        buff[3] = 0xC0;
        buff[4] = 0x00;
        buff[5] = 0x00;
        buff[6] = 0x04;  // 4 bytes
        br = new BufferReader(buff, 0);
        expect(br.uint8()).toBe(1);
        expect(br.uint16()).toBe(0x8002);
        expect(br.uint32()).toBe(0xC0000004);
    });
});
