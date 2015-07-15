/**
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global core, runtime, Runtime, ArrayBuffer, Uint8Array*/

/*jslint bitwise: true*/

/**
 * @constructor
 * @param runner {UnitTestRunner}
 * @implements {core.UnitTest}
 */
core.RuntimeTests = function RuntimeTests(runner) {
    "use strict";
    var t, r = runner;

    function testRead(callback) {
        var pre = r.resourcePrefix();
        runtime.read(pre + "utf8.txt", 9, 5, function (err, data) {
            t.err = err;
            r.shouldBeNull(t, "t.err");
            if (data) {
                t.data = runtime.byteArrayToString(data, "utf8");
            }
            r.shouldBe(t, "t.data", "'world'");
            callback();
        });
    }

    /**
     * Test writing a binary file, reading it back and deleting it.
     */
    function testWrite(callback) {
        var i, max = 1024, filename,
            pre = r.resourcePrefix(),
            content = [],
            clean = [];
        for (i = 0; i < max; i += 1) {
            content.push([i]);
        }
        for (i = 0; i < max; i += 1) {
            clean.push(content[i] & 0xff);
        }

        filename = pre + "tmp" + Math.random();
        // now content has content different from what is on the server
        runtime.writeFile(filename, new Uint8Array(content), function (err) {
            t.err = err;
            r.shouldBeNull(t, "t.err");
            runtime.readFile(filename, "binary", function (err, data) {
                t.err = err;
                r.shouldBeNull(t, "t.err");
                t.data = data;
                t.clean = clean;
                r.shouldBe(t, "t.data.length", "t.clean.length");
                i = 0;
                while (i < max && data[i] === clean[i]) {
                    i += 1;
                }
                if (i !== max) {
                    runtime.log("at " + String(i) + " " + data[i] + " vs " +
                            clean[i]);
                }
                t.i = i;
                t.max = max;
                r.shouldBe(t, "t.i", "t.max");
                // cleanup
                runtime.deleteFile(filename, function (err) {
                    t.err = err;
                    r.shouldBeNull(t, "t.err");
                    runtime.readFile(filename, "binary", function (err, data) {
                        t.err = err;
                        t.data = data || null;
                        r.shouldBeNonNull(t, "t.err");
                        r.shouldBeNull(t, "t.data");
                        callback();
                    });
                });
            });
        });
    }

    function testUtf8ByteArrayToString_hello_withBOM() {
        var bytearray = new Uint8Array(new ArrayBuffer(8));

        bytearray[0] = 0xef;
        bytearray[1] = 0xbb;
        bytearray[2] = 0xbf;
        bytearray[3] = 0x68;
        bytearray[4] = 0x65;
        bytearray[5] = 0x6C;
        bytearray[6] = 0x6C;
        bytearray[7] = 0x6F;

        // we want to test the actual Runtime implementation rather than the nodejs runtime
        t.data = Runtime.byteArrayToString(bytearray, "utf8");

        r.shouldBe(t, "t.data.charCodeAt(0)", "0x68");
        r.shouldBe(t, "t.data.charCodeAt(1)", "0x65");
        r.shouldBe(t, "t.data.charCodeAt(2)", "0x6C");
        r.shouldBe(t, "t.data.charCodeAt(3)", "0x6C");
        r.shouldBe(t, "t.data.charCodeAt(4)", "0x6F");
    }

    function testUtf8ByteArrayToString_hello_noBOM() {
        var bytearray = new Uint8Array(new ArrayBuffer(5));

        bytearray[0] = 0x68;
        bytearray[1] = 0x65;
        bytearray[2] = 0x6C;
        bytearray[3] = 0x6C;
        bytearray[4] = 0x6F;

        // we want to test the actual Runtime implementation rather than the nodejs runtime
        t.data = Runtime.byteArrayToString(bytearray, "utf8");

        r.shouldBe(t, "t.data.charCodeAt(0)", "0x68");
        r.shouldBe(t, "t.data.charCodeAt(1)", "0x65");
        r.shouldBe(t, "t.data.charCodeAt(2)", "0x6C");
        r.shouldBe(t, "t.data.charCodeAt(3)", "0x6C");
        r.shouldBe(t, "t.data.charCodeAt(4)", "0x6F");
    }

    function testUtf8ByteArrayToString_surrogates_withBOM() {
        var bytearray = new Uint8Array(new ArrayBuffer(7));

        bytearray[0] = 0xef;
        bytearray[1] = 0xbb;
        bytearray[2] = 0xbf;
        bytearray[3] = 0xf0;
        bytearray[4] = 0xa4;
        bytearray[5] = 0xad;
        bytearray[6] = 0xa2;

        // we want to test the actual Runtime implementation rather than the nodejs runtime
        t.data = Runtime.byteArrayToString(bytearray, "utf8");

        r.shouldBe(t, "t.data.charCodeAt(0)", "55378");
        r.shouldBe(t, "t.data.charCodeAt(1)", "57186");
    }

    function testUtf8ByteArrayToString_surrogates_noBOM() {
        var bytearray = new Uint8Array(new ArrayBuffer(4));

        bytearray[0] = 0xf0;
        bytearray[1] = 0xa4;
        bytearray[2] = 0xad;
        bytearray[3] = 0xa2;

        // we want to test the actual Runtime implementation rather than the nodejs runtime
        t.data = Runtime.byteArrayToString(bytearray, "utf8");

        r.shouldBe(t, "t.data.charCodeAt(0)", "55378");
        r.shouldBe(t, "t.data.charCodeAt(1)", "57186");
    }

    function testLoadXML(callback) {
        var pre = r.resourcePrefix();
        runtime.loadXML(pre + "tests.html", function (err, xml) {
            t.err = err || null;
            t.xml = xml || null;
            r.shouldBeNull(t, "t.err");
            r.shouldBeNonNull(t, "t.xml");
            callback();
        });
    }

    this.setUp = function () {
        t = {};
    };
    this.tearDown = function () {
        t = {};
    };
    this.tests = function () {
        return r.name([
            testUtf8ByteArrayToString_hello_withBOM,
            testUtf8ByteArrayToString_hello_noBOM,
            testUtf8ByteArrayToString_surrogates_withBOM,
            testUtf8ByteArrayToString_surrogates_noBOM
        ]);
    };
    this.asyncTests = function () {
        return r.name([
            testRead,
            testWrite,
            testLoadXML
        ]);
    };
    this.description = function () {
        return "Test the runtime.";
    };
};
