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
/*global core, runtime*/
runtime.loadClass("core.DomUtils");

/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
core.DomUtilsTests = function DomUtilsTests(runner) {
    "use strict";
    var r = runner, t = {},
        document = runtime.getWindow().document;

    this.setUp = function () {
        t = {
            doc : core.UnitTest.provideTestAreaDiv(),
            utils : new core.DomUtils(),
            range : document.createRange()
        };
    };
    this.tearDown = function () {
        t.range.detach();
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };

    function normalizeTextNodes_TextWithTextSilblings() {
        t.doc.appendChild(document.createTextNode("a"));
        t.doc.appendChild(document.createTextNode("b"));
        t.doc.appendChild(document.createTextNode("c"));

        t.utils.normalizeTextNodes(t.doc.childNodes[1]);

        r.shouldBe(t, "t.doc.childNodes.length", "1");
        r.shouldBe(t, "t.doc.childNodes[0].textContent", "'abc'");
    }

    function normalizeTextNodes_EmptyTextWithTextSilblings() {
        t.doc.appendChild(document.createTextNode("a"));
        t.doc.appendChild(document.createTextNode(""));
        t.doc.appendChild(document.createTextNode("c"));

        t.utils.normalizeTextNodes(t.doc.childNodes[1]);

        r.shouldBe(t, "t.doc.childNodes.length", "1");
        r.shouldBe(t, "t.doc.childNodes[0].textContent", "'ac'");
    }

    function normalizeTextNodes_TextWithPreviousTextSilbling() {
        t.doc.appendChild(document.createTextNode("a"));
        t.doc.appendChild(document.createTextNode("b"));
        t.doc.appendChild(document.createElement("span"));

        t.utils.normalizeTextNodes(t.doc.childNodes[1]);

        r.shouldBe(t, "t.doc.childNodes.length", "2");
        r.shouldBe(t, "t.doc.childNodes[0].textContent", "'ab'");
    }

    function normalizeTextNodes_EmptyTextWithPreviousTextSilbling() {
        t.doc.appendChild(document.createTextNode("a"));
        t.doc.appendChild(document.createTextNode(""));
        t.doc.appendChild(document.createElement("span"));

        t.utils.normalizeTextNodes(t.doc.childNodes[1]);

        r.shouldBe(t, "t.doc.childNodes.length", "2");
        r.shouldBe(t, "t.doc.childNodes[0].textContent", "'a'");
    }

    function normalizeTextNodes_TextWithNextTextSilbling() {
        t.doc.appendChild(document.createElement("span"));
        t.doc.appendChild(document.createTextNode("b"));
        t.doc.appendChild(document.createTextNode("c"));

        t.utils.normalizeTextNodes(t.doc.childNodes[1]);

        r.shouldBe(t, "t.doc.childNodes.length", "2");
        r.shouldBe(t, "t.doc.childNodes[1].textContent", "'bc'");
    }

    function normalizeTextNodes_EmptyTextWithNextTextSilbling() {
        t.doc.appendChild(document.createElement("span"));
        t.doc.appendChild(document.createTextNode(""));
        t.doc.appendChild(document.createTextNode("c"));

        t.utils.normalizeTextNodes(t.doc.childNodes[1]);

        r.shouldBe(t, "t.doc.childNodes.length", "2");
        r.shouldBe(t, "t.doc.childNodes[1].textContent", "'c'");
    }

    function normalizeTextNodes_TextWithNoTextSilblings() {
        t.doc.appendChild(document.createElement("span"));
        t.doc.appendChild(document.createTextNode("b"));
        t.doc.appendChild(document.createElement("span"));

        t.utils.normalizeTextNodes(t.doc.childNodes[1]);

        r.shouldBe(t, "t.doc.childNodes.length", "3");
        r.shouldBe(t, "t.doc.childNodes[1].textContent", "'b'");
    }

    function normalizeTextNodes_EmptyTextWithNoTextSilblings() {
        t.doc.appendChild(document.createElement("span"));
        t.doc.appendChild(document.createTextNode(""));
        t.doc.appendChild(document.createElement("span"));

        t.utils.normalizeTextNodes(t.doc.childNodes[1]);

        r.shouldBe(t, "t.doc.childNodes.length", "2");
    }

    function splitBoundaries_StartAndEnd_SameTextNodes() {
        t.doc.appendChild(document.createTextNode("abcdef"));
        t.range.setStart(t.doc.firstChild, 1);
        t.range.setEnd(t.doc.firstChild, 5);

        t.utils.splitBoundaries(t.range);

        r.shouldBe(t, "t.doc.childNodes.length", "3");
        r.shouldBe(t, "t.doc.childNodes[0].data", "'a'");
        r.shouldBe(t, "t.doc.childNodes[1].data", "'bcde'");
        r.shouldBe(t, "t.doc.childNodes[2].data", "'f'");
        r.shouldBe(t, "t.range.startContainer", "t.doc.childNodes[1]");
        r.shouldBe(t, "t.range.startOffset", "0");
        r.shouldBe(t, "t.range.endContainer", "t.doc.childNodes[1]");
        r.shouldBe(t, "t.range.endOffset", "4");
        r.shouldBe(t, "t.range.toString()", "'bcde'");
    }

    function splitBoundaries_StartAndEnd_SameTextNodes_EndAtTextNode() {
        t.doc.appendChild(document.createTextNode("abcde"));
        t.range.setStart(t.doc.firstChild, 1);
        t.range.setEnd(t.doc.firstChild, 5);

        t.utils.splitBoundaries(t.range);

        r.shouldBe(t, "t.doc.childNodes.length", "2");
        r.shouldBe(t, "t.doc.childNodes[0].data", "'a'");
        r.shouldBe(t, "t.doc.childNodes[1].data", "'bcde'");
        r.shouldBe(t, "t.range.startContainer", "t.doc.childNodes[1]");
        r.shouldBe(t, "t.range.startOffset", "0");
        r.shouldBe(t, "t.range.endContainer", "t.doc.childNodes[1]");
        r.shouldBe(t, "t.range.endOffset", "4");
        r.shouldBe(t, "t.range.toString()", "'bcde'");
    }

    function splitBoundaries_StartInTextNode_EndAtParagraph() {
        t.doc.appendChild(document.createTextNode("abcde"));
        t.range.setStart(t.doc.firstChild, 1);
        t.range.setEnd(t.doc, 1);

        t.utils.splitBoundaries(t.range);

        r.shouldBe(t, "t.doc.childNodes.length", "2");
        r.shouldBe(t, "t.doc.childNodes[0].data", "'a'");
        r.shouldBe(t, "t.doc.childNodes[1].data", "'bcde'");
        r.shouldBe(t, "t.range.startContainer", "t.doc.childNodes[1]");
        r.shouldBe(t, "t.range.startOffset", "0");
        r.shouldBe(t, "t.range.endContainer", "t.doc.childNodes[1]");
        r.shouldBe(t, "t.range.endOffset", "4");
        r.shouldBe(t, "t.range.toString()", "'bcde'");
    }

    function splitBoundaries_StartAndEnd_AlreadySplit() {
        t.doc.appendChild(document.createElement("span"));
        t.doc.appendChild(document.createElement("span"));
        t.doc.appendChild(document.createElement("span"));
        t.doc.childNodes[1].appendChild(document.createTextNode("bcde"));
        t.range.setStart(t.doc, 1);
        t.range.setEnd(t.doc, 2);

        t.utils.splitBoundaries(t.range);

        r.shouldBe(t, "t.doc.childNodes.length", "3");
        r.shouldBe(t, "t.range.startContainer", "t.doc");
        r.shouldBe(t, "t.range.startOffset", "1");
        r.shouldBe(t, "t.range.endContainer", "t.doc");
        r.shouldBe(t, "t.range.endOffset", "2");
        r.shouldBe(t, "t.range.toString()", "'bcde'");
    }

    function splitBoundaries_StartRequiresSplitting_EndAlreadySplit() {
        t.doc.appendChild(document.createTextNode("ab"));
        t.doc.appendChild(document.createElement("span"));
        t.doc.childNodes[1].appendChild(document.createTextNode("cde"));
        t.range.setStart(t.doc.firstChild, 1);
        t.range.setEnd(t.doc, 2);

        t.utils.splitBoundaries(t.range);

        r.shouldBe(t, "t.doc.childNodes.length", "3");
        r.shouldBe(t, "t.doc.childNodes[0].data", "'a'");
        r.shouldBe(t, "t.doc.childNodes[1].data", "'b'");
        r.shouldBe(t, "t.range.startContainer", "t.doc.childNodes[1]");
        r.shouldBe(t, "t.range.startOffset", "0");
        r.shouldBe(t, "t.range.endContainer", "t.doc.childNodes[2].firstChild");
        r.shouldBe(t, "t.range.endOffset", "3");
        r.shouldBe(t, "t.range.toString()", "'bcde'");
    }

    function splitBoundaries_StartAlreadySplit_EndRequiresSplitting() {
        t.doc.appendChild(document.createElement("span"));
        t.doc.appendChild(document.createElement("span"));
        t.doc.appendChild(document.createTextNode("cde"));
        t.doc.childNodes[0].appendChild(document.createTextNode("a"));
        t.doc.childNodes[1].appendChild(document.createTextNode("b"));
        t.range.setStart(t.doc, 1);
        t.range.setEnd(t.doc.lastChild, 2);

        t.utils.splitBoundaries(t.range);

        r.shouldBe(t, "t.doc.childNodes.length", "4");
        r.shouldBe(t, "t.doc.childNodes[0].textContent", "'a'");
        r.shouldBe(t, "t.doc.childNodes[1].textContent", "'b'");
        r.shouldBe(t, "t.doc.childNodes[2].textContent", "'cd'");
        r.shouldBe(t, "t.doc.childNodes[3].textContent", "'e'");
        r.shouldBe(t, "t.range.startContainer", "t.doc");
        r.shouldBe(t, "t.range.startOffset", "1");
        r.shouldBe(t, "t.range.endContainer", "t.doc.childNodes[2]");
        r.shouldBe(t, "t.range.endOffset", "2");
        r.shouldBe(t, "t.range.toString()", "'bcd'");
    }

    function rangeContainsNode_ForFullyBracketedSpan_ReturnsTrue() {
        var start = document.createTextNode("before"),
            target = document.createElement("span"),
            end = document.createTextNode("after");
        t.doc.appendChild(start);
        t.doc.appendChild(target);
        t.doc.appendChild(end);

        t.result = t.utils.rangeContainsNode({startContainer: start, startOffset: 0, endContainer: end, endOffset: 0}, target);

        r.shouldBe(t, "t.result", "true");
    }

    function rangeContainsNode_ForDifferentDepths_ReturnsTrue() {
        var start = document.createTextNode("before"),
            startContainer = document.createElement("span"),
            target = document.createElement("span"),
            end = document.createTextNode("after");
        startContainer.appendChild(start);
        t.doc.appendChild(startContainer);
        t.doc.appendChild(target);
        t.doc.appendChild(end);

        t.result = t.utils.rangeContainsNode({startContainer: start, startOffset: 0, endContainer: end, endOffset: 0}, target);

        r.shouldBe(t, "t.result", "true");
    }

    function rangeContainsNode_ForAdjacentSpan_ReturnsFalse() {
        var start = document.createTextNode("before"),
            target = document.createElement("span"),
            end = document.createTextNode("after");
        t.doc.appendChild(start);
        t.doc.appendChild(end);
        t.doc.appendChild(target);

        t.result = t.utils.rangeContainsNode({startContainer: start, startOffset: 0, endContainer: end, endOffset: 0}, target);

        r.shouldBe(t, "t.result", "false");
    }

    function removeUnwantedNodes_DiscardAll() {
        var p = document.createElement("p"),
            span1 = document.createElement("span"),
            span2 = document.createElement("span"),
            span3 = document.createElement("span"),
            b = document.createElement("b");
        b.textContent = "test";
        span1.textContent = "hello";
        span2.textContent = "world";
        span3.appendChild(b);
        p.appendChild(span1);
        p.appendChild(span2);
        p.appendChild(span3);
        t.doc.appendChild(p);
        t.parent = t.utils.removeUnwantedNodes(p, function (node) {
            return node !== null;
        });
        r.shouldBe(t, "t.parent", "t.doc");
        r.shouldBe(t, "t.parent.childNodes.length", "0");
    }

    function removeUnwantedNodes_DiscardSpanOnly() {
        var p = document.createElement("p"),
            span1 = document.createElement("span"),
            span2 = document.createElement("span"),
            span3 = document.createElement("span"),
            b = document.createElement("b");
        b.textContent = "test";
        span1.textContent = "hello";
        span2.textContent = "world";
        span3.appendChild(b);
        p.appendChild(span1);
        p.appendChild(span2);
        p.appendChild(span3);
        t.doc.appendChild(p);
        t.parent = t.utils.removeUnwantedNodes(p, function (node) {
            return node.localName === 'span';
        });
        r.shouldBe(t, "t.parent", "t.doc");
        r.shouldBe(t, "t.parent.firstChild.localName", "'p'");
        r.shouldBe(t, "t.parent.firstChild.childNodes[0].textContent", "'hello'");
        r.shouldBe(t, "t.parent.firstChild.childNodes[1].textContent", "'world'");
        r.shouldBe(t, "t.parent.firstChild.childNodes[2].localName", "'b'");
        r.shouldBe(t, "t.parent.firstChild.childNodes[2].firstChild.textContent", "'test'");
    }

    this.tests = function () {
        return [
            normalizeTextNodes_TextWithTextSilblings,
            normalizeTextNodes_EmptyTextWithTextSilblings,
            normalizeTextNodes_TextWithPreviousTextSilbling,
            normalizeTextNodes_EmptyTextWithPreviousTextSilbling,
            normalizeTextNodes_TextWithNextTextSilbling,
            normalizeTextNodes_EmptyTextWithNextTextSilbling,
            normalizeTextNodes_TextWithNoTextSilblings,
            normalizeTextNodes_EmptyTextWithNoTextSilblings,
            splitBoundaries_StartAndEnd_SameTextNodes,
            splitBoundaries_StartAndEnd_SameTextNodes_EndAtTextNode,
            splitBoundaries_StartInTextNode_EndAtParagraph,
            splitBoundaries_StartAndEnd_AlreadySplit,
            splitBoundaries_StartRequiresSplitting_EndAlreadySplit,
            splitBoundaries_StartAlreadySplit_EndRequiresSplitting,

            rangeContainsNode_ForFullyBracketedSpan_ReturnsTrue,
            rangeContainsNode_ForDifferentDepths_ReturnsTrue,
            rangeContainsNode_ForAdjacentSpan_ReturnsFalse,

            removeUnwantedNodes_DiscardAll,
            removeUnwantedNodes_DiscardSpanOnly
        ];
    };
    this.asyncTests = function () {
        return [];
    };
};
core.DomUtilsTests.name = "DomUtilsTests";
core.DomUtilsTests.prototype.description = function () {
    "use strict";
    return "Test the DomUtils class.";
};
(function () {
    "use strict";
    return core.DomUtilsTests;
}());
