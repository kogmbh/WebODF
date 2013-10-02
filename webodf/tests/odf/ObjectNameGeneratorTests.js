/**
 * Copyright (C) 2012 KO GmbH <jos.van.den.oever@kogmbh.com>
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/webodf/webodf/
 */
/*global runtime, core, odf*/
runtime.loadClass("odf.ObjectNameGenerator");
/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
odf.ObjectNameGeneratorTests = function ObjectNameGeneratorTests(runner) {
    "use strict";
    var t,
        r = runner,
        namespace = {
            "text":"urn:oasis:names:tc:opendocument:xmlns:text:1.0",
            "office":"urn:oasis:names:tc:opendocument:xmlns:office:1.0",
            "style":"urn:oasis:names:tc:opendocument:xmlns:style:1.0",
            "draw":"urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
            "fo":"urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
            "xlink":"http://www.w3.org/1999/xlink"
        };

    function parseXML(data) {
        var xml = "<?xml version='1.0' encoding='UTF-8'?>";

        xml += "<office:document";
        Object.keys(namespace).forEach(function(key) {
            xml += " xmlns:" + key + '="' + namespace[key] + '"';
        });
        xml += ">";
        xml += data;
        xml += "</office:document>";
        return runtime.parseXML(xml).documentElement;
    }
    /**
     * Mocking OdfContainer allows some simplification in the testing setup
     * @param {!Node} styles
     * @param {!Node} automaticStyles
     * @param {!Node} body
     * @extends {odf.OdfContainer} Well.... we don't really, but please shut your face closure compiler :)
     * @constructor
     */
    function OdfContainerMock(styles, automaticStyles, body) {
        this.rootElement = {
            styles : styles,
            automaticStyles: automaticStyles,
            body: body
        };
    }

    this.setUp = function () {
        t = {
            testArea : core.UnitTest.provideTestAreaDiv(),
            ns : namespace
        };

        var xml = "", containerMock;

        xml += "<office:styles>";
        xml += "    <style:style style:name='P1' style:family='paragraph'>";
        xml += "        <style:text-properties fo:font-weight='bold' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='P2' style:family='text'>";
        xml += "        <style:text-properties fo:font-weight='bold' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='auto105408_0' style:family='text'>";
        xml += "        <style:text-properties style:text-underline-style='solid' />";
        xml += "    </style:style>";
        xml += "</office:styles>";

        xml += "<office:automatic-styles>";
        xml += "    <style:style style:name='auto105408_1' style:family='text'>";
        xml += "        <style:text-properties fo:font-weight='bold' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='auto105408_2' style:family='text'>";
        xml += "        <style:text-properties style:text-underline-style='solid' />";
        xml += "    </style:style>";
        xml += "</office:automatic-styles>";

        xml += "<office:text>";
        xml += "    <text:p text:style-name='auto105408_0'>";
        xml += "        <draw:frame draw:name='fr_105408_0'><draw:image xlink:href='Pictures/1.105408_0.jpg'/></draw:frame>";
        xml += "        <draw:frame draw:name='fr105408_0'><draw:image xlink:href='Pictures/img105408_0.jpg'/></draw:frame>";
        xml += "        <draw:frame draw:name='fr105408_1'><draw:image xlink:href='Pictures/img105408_3.png'/></draw:frame>";
        xml += "    </text:p>";
        xml += "</office:text>";

        t.testArea.appendChild(parseXML(xml));
        containerMock = new OdfContainerMock(
            t.testArea.firstChild.childNodes[0], t.testArea.firstChild.childNodes[1], t.testArea.firstChild.childNodes[2]);

        t.generator = new odf.ObjectNameGenerator(containerMock, 'joe');
    };
    this.tearDown = function () {
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };
    function generateStyleName_ReturnsUniqueName() {
        t.result0 = t.generator.generateStyleName();
        t.result1 = t.generator.generateStyleName();
        t.result2 = t.generator.generateStyleName();

        r.shouldBe(t, "t.result0", "'auto105408_3'");
        r.shouldBe(t, "t.result1", "'auto105408_4'");
        r.shouldBe(t, "t.result2", "'auto105408_5'");
    }
    function generateFrameName_ReturnsUniqueName() {
        t.result0 = t.generator.generateFrameName();
        t.result1 = t.generator.generateFrameName();
        t.result2 = t.generator.generateFrameName();

        r.shouldBe(t, "t.result0", "'fr105408_2'");
        r.shouldBe(t, "t.result1", "'fr105408_3'");
        r.shouldBe(t, "t.result2", "'fr105408_4'");
    }
    function generateImageName_ReturnsUniqueName() {
        t.result0 = t.generator.generateImageName();
        t.result1 = t.generator.generateImageName();
        t.result2 = t.generator.generateImageName();

        r.shouldBe(t, "t.result0", "'img105408_1'");
        r.shouldBe(t, "t.result1", "'img105408_2'");
        r.shouldBe(t, "t.result2", "'img105408_4'");
    }
    this.tests = function () {
        return [
            generateStyleName_ReturnsUniqueName,
            generateFrameName_ReturnsUniqueName,
            generateImageName_ReturnsUniqueName
        ];
    };
    this.asyncTests = function () {
        return [];
    };
};
odf.ObjectNameGeneratorTests.prototype.description = function () {
    "use strict";
    return "Test the ObjectNameGenerator class.";
};
(function () {
    "use strict";
    return odf.ObjectNameGeneratorTests;
}());
