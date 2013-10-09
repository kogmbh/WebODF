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
/*global runtime, core, odf, NodeFilter*/
runtime.loadClass("odf.OdfUtils");
/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
odf.OdfUtilsTests = function OdfUtilsTests(runner) {
    "use strict";
    var t,
        r = runner,
        namespace = {
            "text":"urn:oasis:names:tc:opendocument:xmlns:text:1.0",
            "office":"urn:oasis:names:tc:opendocument:xmlns:office:1.0",
            "style":"urn:oasis:names:tc:opendocument:xmlns:style:1.0",
            "fo":"urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
            "draw":"urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
            "svg":"urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0",
            "dr3d":"urn:oasis:names:tc:opendocument:xmlns:dr3d:1.0"
        };

    this.setUp = function () {
        t = {
            testArea : core.UnitTest.provideTestAreaDiv(),
            ns: namespace
        };
        t.odfUtils = new odf.OdfUtils();
    };
    this.tearDown = function () {
        t.range.detach();
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };
    function createDocument(dom) {
        var fragment;

        fragment = core.UnitTest.createOdtDocument("<office:text>" + dom + "</office:text>", namespace);
        t.testArea.appendChild(fragment.documentElement);
        t.range = t.testArea.ownerDocument.createRange();
        return t.testArea.firstChild.firstChild.childNodes.length === 1
            ? t.testArea.firstChild.firstChild.firstChild
            : t.testArea.firstChild.firstChild;
    }
    function getTextElements_EncompassedWithinParagraph() {
        t.doc = createDocument("<text:p>AB<text:s> </text:s>CD</text:p>");
        t.range.setStart(t.doc.childNodes[0], 0);
        t.range.setEnd(t.doc.childNodes[2], 0);

        t.paragraphs = t.odfUtils.getParagraphElements(t.range);
        t.textElements = t.odfUtils.getTextElements(t.range, false);

        r.shouldBe(t, "t.paragraphs.length", "1");
        r.shouldBe(t, "t.paragraphs.shift()", "t.doc");

        r.shouldBe(t, "t.textElements.length", "2");
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0]"); // "AB"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[1]"); // text:s
    }
    function getTextElements_EncompassedWithinSpan_And_Paragraph() {
        t.doc = createDocument("<text:p><text:span>A</text:span>B<text:s/>CD</text:p>");
        t.range.setStart(t.doc.childNodes[0], 0);
        t.range.setEnd(t.doc.childNodes[2], 0);

        t.paragraphs = t.odfUtils.getParagraphElements(t.range);
        t.textElements = t.odfUtils.getTextElements(t.range, false);

        r.shouldBe(t, "t.paragraphs.length", "1");
        r.shouldBe(t, "t.paragraphs.shift()", "t.doc");

        r.shouldBe(t, "t.textElements.length", "3");
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[0]"); // "A"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[1]"); // "B"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[2]"); // text:s
    }
    function getTextElements_IgnoresEditInfo() {
        t.doc = createDocument("<text:p>AB<editinfo>HI</editinfo><text:s/>CD</text:p>");
        t.range.setStart(t.doc.childNodes[0], 0);
        t.range.setEnd(t.doc.childNodes[2], 0);

        t.paragraphs = t.odfUtils.getParagraphElements(t.range);
        t.textElements = t.odfUtils.getTextElements(t.range, false);

        r.shouldBe(t, "t.paragraphs.length", "1");
        r.shouldBe(t, "t.paragraphs.shift()", "t.doc");

        r.shouldBe(t, "t.textElements.length", "2");
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0]"); // "AB"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[2]"); // text:s
    }
    function getTextElements_SpansMultipleParagraphs() {
        t.doc = createDocument("<text:p>AB<text:s/>CD</text:p><text:p>EF<text:s/>GH</text:p>");
        t.range.setStart(t.doc.childNodes[0].childNodes[0], 0);
        t.range.setEnd(t.doc.childNodes[1].childNodes[1], 0);

        t.paragraphs = t.odfUtils.getParagraphElements(t.range);
        t.textElements = t.odfUtils.getTextElements(t.range, false);

        r.shouldBe(t, "t.paragraphs.length", "2");
        r.shouldBe(t, "t.paragraphs.shift()", "t.doc.childNodes[0]");
        r.shouldBe(t, "t.paragraphs.shift()", "t.doc.childNodes[1]");

        r.shouldBe(t, "t.textElements.length", "5");
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[0]"); // "AB"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[1]"); // text:s
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[2]"); // "CD"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[1].childNodes[0]"); // "EF"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[1].childNodes[1]"); // text:s
    }
    function getTextElements_IncludesInsignificantWhitespace() {
        t.doc = createDocument("<text:p>AB<text:s> </text:s>CD</text:p>\n<text:p>EF<text:s/>GH</text:p>");
        t.range.setStart(t.doc.childNodes[0].childNodes[0], 0);
        t.range.setEnd(t.doc.childNodes[2].childNodes[1], 0);

        t.paragraphs = t.odfUtils.getParagraphElements(t.range);
        t.textElements = t.odfUtils.getTextElements(t.range, true);

        r.shouldBe(t, "t.paragraphs.length", "2");
        r.shouldBe(t, "t.paragraphs.shift()", "t.doc.childNodes[0]");
        r.shouldBe(t, "t.paragraphs.shift()", "t.doc.childNodes[2]");

        r.shouldBe(t, "t.textElements.length", "6");
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[0]"); // "AB"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[1]"); // text:s
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[2]"); // "CD"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[1]"); // "\n"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[2].childNodes[0]"); // "EF"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[2].childNodes[1]"); // text:s
    }
    function getTextElements_ExcludesInsignificantWhitespace() {
        t.doc = createDocument("<text:p>AB<text:s> </text:s>CD</text:p>\n<text:p>EF<text:s/>GH</text:p>");
        t.range.setStart(t.doc.childNodes[0].childNodes[0], 0);
        t.range.setEnd(t.doc.childNodes[2].childNodes[1], 0);

        t.paragraphs = t.odfUtils.getParagraphElements(t.range);
        t.textElements = t.odfUtils.getTextElements(t.range, false);

        r.shouldBe(t, "t.paragraphs.length", "2");
        r.shouldBe(t, "t.paragraphs.shift()", "t.doc.childNodes[0]");
        r.shouldBe(t, "t.paragraphs.shift()", "t.doc.childNodes[2]");

        r.shouldBe(t, "t.textElements.length", "5");
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[0]"); // "AB"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[1]"); // text:s
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0].childNodes[2]"); // "CD"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[2].childNodes[0]"); // "EF"
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[2].childNodes[1]"); // text:s
    }
    function getTextElements_CharacterElements() {
        t.doc = createDocument("<text:p><text:s> </text:s><text:tab>	</text:tab><text:line-break>\n</text:line-break><draw:frame text:anchor-type='as-char'><draw:image/></draw:frame></text:p>");
        t.range.selectNode(t.doc);

        t.textElements = t.odfUtils.getTextElements(t.range, true);

        r.shouldBe(t, "t.textElements.length", "4");
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[0]"); // text:s
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[1]"); // text:tab
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[2]"); // text:line-break
        r.shouldBe(t, "t.textElements.shift()", "t.doc.childNodes[3]"); // draw:frame
    }
    this.tests = function () {
        return [
            getTextElements_EncompassedWithinParagraph,
            getTextElements_EncompassedWithinSpan_And_Paragraph,
            getTextElements_IgnoresEditInfo,
            getTextElements_SpansMultipleParagraphs,
            getTextElements_IncludesInsignificantWhitespace,
            getTextElements_ExcludesInsignificantWhitespace,
            getTextElements_CharacterElements
        ];
    };
    this.asyncTests = function () {
        return [];
    };
};
odf.OdfUtilsTests.prototype.description = function () {
    "use strict";
    return "Test the OdfUtilsTests class.";
};
(function () {
    "use strict";
    return odf.OdfUtilsTests;
}());
