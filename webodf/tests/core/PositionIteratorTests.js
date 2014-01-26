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
 * You should have received a copy of the GNU Affero General Public License
 * along with this code.  If not, see <http://www.gnu.org/licenses/>.
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
 * @source: https://github.com/kogmbh/WebODF/
 */
/*global Node, NodeFilter, runtime, core, gui, xmldom, ops*/
runtime.loadClass("core.PositionIterator");
runtime.loadClass("xmldom.LSSerializer");

/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
core.PositionIteratorTests = function PositionIteratorTests(runner) {
    "use strict";
    /**
     * @constructor
     * @implements NodeFilter
     */
    function TestFilter() {
        this.acceptNode = function (node) {
            if (node.localName === "b") {
                return NodeFilter.FILTER_REJECT;
            }
            if (node.localName === "c") {
                return NodeFilter.FILTER_SKIP;
            }
            return NodeFilter.FILTER_ACCEPT;
        };
    }
    var r = runner, t, filter = new TestFilter(),
        testXMLs = [
            { x: "<a/>", n: 1 },
            { x: "<a><b/></a>", n: 1 },
            { x: "<a>a</a>", n: 2 },
            { x: "<a>a<b/></a>", n: 2 },
            { x: "<a><b/>a</a>", n: 2 },
            { x: "<a>hello</a>", n: 6 },
            { x: "<a>hel<b/>lo</a>", n: 6 },
            { x: "<a><c><b>a</b>a</c></a>", n: 2 },
            { x: "<a><c/>abc<b/>de</a>", n: 6 },
            { x: "<a><a><a>ab</a>a<a></a></a></a>", n: 10 }
        ];

    this.setUp = function () {
        t = {};
    };
    this.tearDown = function () {
        t = {};
    };
    function createWalker(xml) {
        t.doc = runtime.parseXML(xml);
        t.iterator = new core.PositionIterator(t.doc.documentElement, 0,
            filter);
    }
    function create() {
        createWalker("<a/>");
        r.shouldBeNonNull(t, "t.iterator");
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }
    function forwardInEmptyDoc() {
        createWalker("<a/>");
        r.shouldBe(t, "t.iterator.nextPosition()", "false");
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }
    function backwardInEmptyDoc() {
        createWalker("<a/>");
        r.shouldBe(t, "t.iterator.previousPosition()", "false");
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }
    function forwardInSimpleDoc() {
        var i;
        createWalker("<a>hello</a>");
        t.textNode = t.doc.documentElement.firstChild;
        r.shouldBe(t, "t.iterator.container()", "t.textNode");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
        for (i = 1; i <= 4; i += 1) {
            r.shouldBe(t, "t.iterator.nextPosition()", "true");
            r.shouldBe(t, "t.iterator.container()", "t.textNode");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", i.toString());
        }
        r.shouldBe(t, "t.iterator.nextPosition()", "true");
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");
        r.shouldBe(t, "t.iterator.nextPosition()", "false");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");
    }
    function backwardInSimpleDoc() {
        var i;
        createWalker("<a>hello</a>");
        t.iterator.moveToEnd();
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");
        t.textNode = t.doc.documentElement.firstChild;
        for (i = 4; i >= 0; i -= 1) {
            r.shouldBe(t, "t.iterator.previousPosition()", "true");
            r.shouldBe(t, "t.iterator.container()", "t.textNode");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", i.toString());
        }
        r.shouldBe(t, "t.iterator.previousPosition()", "false");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }
    function forwardInDoc() {
        var i;
        createWalker("<a>abc<a>abc</a>abc</a>");
        t.node = t.doc.documentElement.firstChild;
        for (i = 1; i < 3; i += 1) {
            r.shouldBe(t, "t.iterator.nextPosition()", "true");
            r.shouldBe(t, "t.iterator.container()", "t.node");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", i.toString());
        }
        r.shouldBe(t, "t.iterator.nextPosition()", "true");
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");
        t.node = t.node.nextSibling;
        t.node = t.node.firstChild;
        for (i = 0; i < 3; i += 1) {
            r.shouldBe(t, "t.iterator.nextPosition()", "true");
            r.shouldBe(t, "t.iterator.container()", "t.node");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", i.toString());
        }
        t.node = t.node.parentNode;
        r.shouldBe(t, "t.iterator.nextPosition()", "true");
        r.shouldBe(t, "t.iterator.container()", "t.node");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");
        t.node = t.node.nextSibling;
        for (i = 0; i < 3; i += 1) {
            r.shouldBe(t, "t.iterator.nextPosition()", "true");
            r.shouldBe(t, "t.iterator.container()", "t.node");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", i.toString());
        }
        r.shouldBe(t, "t.iterator.nextPosition()", "true");
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "3");
        r.shouldBe(t, "t.iterator.nextPosition()", "false");
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "3");
    }
    function backwardInDoc() {
        createWalker("<a>abc<a>abc</a>1bc</a>");
        t.iterator.moveToEnd();
        t.node = t.doc.documentElement.lastChild;
        var i;
        for (i = 2; i >= 0; i -= 1) {
            r.shouldBe(t, "t.iterator.previousPosition()", "true");
            r.shouldBe(t, "t.iterator.container()", "t.node");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", i.toString());
        }
        t.node = t.node.previousSibling;
        r.shouldBe(t, "t.iterator.previousPosition()", "true");
        r.shouldBe(t, "t.iterator.container()", "t.node");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");
        t.node = t.node.firstChild;
        for (i = 2; i >= 0; i -= 1) {
            r.shouldBe(t, "t.iterator.previousPosition()", "true");
            r.shouldBe(t, "t.iterator.container()", "t.node");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", i.toString());
        }
        r.shouldBe(t, "t.iterator.previousPosition()", "true");
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");
        t.node = t.doc.documentElement.firstChild;
        for (i = 2; i >= 0; i -= 1) {
            r.shouldBe(t, "t.iterator.previousPosition()", "true");
            r.shouldBe(t, "t.iterator.container()", "t.node");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", i.toString());
        }
        r.shouldBe(t, "t.iterator.previousPosition()", "false");
        r.shouldBe(t, "t.iterator.container()", "t.node");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }
    function countPositions(xml) {
        var n = 1;
        createWalker(xml);
        while (t.iterator.nextPosition()) {
            n += 1;
        }
        return n;
    }
    function countPositionsBackwards(xml) {
        var n = 1;
        createWalker(xml);
        t.iterator.moveToEnd();
        while (t.iterator.previousPosition()) {
            n += 1;
        }
        return n;
    }
    function testPositions(count) {
        var n = 0, i, it = t.iterator, ok = true;
        while (it.nextPosition() && n <= count) {
            t.c1 = it.container();
            t.o1 = it.unfilteredDomOffset();
            it.setUnfilteredPosition(t.c1, t.o1);
            t.c2 = it.container();
            t.o2 = it.unfilteredDomOffset();
            r.shouldBe(t, "t.c2", "t.c1");
            r.shouldBe(t, "t.o2", "t.o1");
            for (i = 0; i <= n; i += 1) {
                ok = ok && it.previousPosition();
            }
            for (i = 1; i < count; i += 1) {
                ok = ok && it.nextPosition();
            }
            for (i = n + 2; i < count; i += 1) {
                ok = ok && it.previousPosition();
            }
            t.c2 = it.container();
            t.o2 = it.unfilteredDomOffset();
            r.shouldBe(t, "t.c2", "t.c1");
            r.shouldBe(t, "t.o2", "t.o1");
            n += 1;
        }
        r.shouldBe(t, ok.toString(), "true");
        r.shouldBe(t, (n + 1).toString(), count.toString());
    }
    function rejectedNodes() {
        var i, xml;
        for (i = 0; i < testXMLs.length; i += 1) {
            xml = testXMLs[i];
            t.positions = countPositions(xml.x);
            r.shouldBe(t, "t.positions", xml.n.toString());
            t.positions = countPositionsBackwards(xml.x);
            r.shouldBe(t, "t.positions", xml.n.toString());
            createWalker(xml.x);
            testPositions(xml.n);
        }
    }
    function insertEmptyTextNodes(doc) {
        var root = doc.documentElement,
            iterator = doc.createNodeIterator(root, NodeFilter.SHOW_ALL, null, false),
            n = iterator.nextNode();
        while (n !== null) {
            if (n !== root) {
                n.parentNode.insertBefore(doc.createTextNode(''), n);
            }
            n = iterator.nextNode();
        }
    }
    function splitTextNodes(doc) {
        var root = doc.documentElement,
            iterator = doc.createNodeIterator(root, NodeFilter.SHOW_ALL, null, false),
            n = iterator.nextNode();
        while (n !== null) {
            if (n.nodeType === Node.TEXT_NODE && n.data.length > 1) {
                n.splitText(1);
            }
            n = iterator.nextNode();
        }
    }
    function emptyTextNodes() {
        var i, xml, n;
        for (i = 0; i < testXMLs.length; i += 1) {
            xml = testXMLs[i];
            t.doc = runtime.parseXML(xml.x);
            insertEmptyTextNodes(t.doc);
            t.iterator = new core.PositionIterator(t.doc.documentElement, 0,
                    filter);
            n = 1;
            while (t.iterator.nextPosition()) {
                n += 1;
            }
            r.shouldBe(t, n.toString(), xml.n.toString());
            n = 1;
            while (t.iterator.previousPosition()) {
                n += 1;
            }
            r.shouldBe(t, n.toString(), xml.n.toString());
            testPositions(xml.n);
        }
    }
    function testSplitTextNodes() {
        var i, xml, n;
        for (i = 0; i < testXMLs.length; i += 1) {
            xml = testXMLs[i];
            t.doc = runtime.parseXML(xml.x);
            splitTextNodes(t.doc);
            t.iterator = new core.PositionIterator(t.doc.documentElement, 0,
                    filter);
            n = 1;
            while (t.iterator.nextPosition()) {
                n += 1;
            }
            r.shouldBe(t, n.toString(), xml.n.toString());
            n = 1;
            while (t.iterator.previousPosition()) {
                n += 1;
            }
            r.shouldBe(t, n.toString(), xml.n.toString());
            testPositions(xml.n);
        }
    }
    function testRoundTripStability() {
        createWalker('<p><b id="b1"/><a id="a1"/><b id="b2"/><b id="b3"/><a id="a2"/><b id="b4"/><a id="a3"/></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement, 0);
        t.forwardPositions = [];
        do {
            t.forwardPositions.push({node: t.iterator.container(), offset: t.iterator.unfilteredDomOffset()});
        } while (t.iterator.nextPosition());

        t.backwardPositions = [];
        do {
            t.backwardPositions.unshift({node: t.iterator.container(), offset: t.iterator.unfilteredDomOffset()});
        } while (t.iterator.previousPosition());

        t.backwardPositions.forEach(function (pos, index) {
            t.expected = t.forwardPositions[index];
            t.actual = pos;
            r.shouldBe(t, "t.actual.node", "t.expected.node");
            r.shouldBe(t, "t.actual.offset", "t.expected.offset");
        });
    }
    function testSetUnfilteredPosition_UsesUnfilteredOffsets() {
        createWalker('<p><b id="b1"/><a id="a1"/><b id="b2"/><b id="b3"/><a id="a2"/><b id="b4"/><a id="a3"/></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement, 4);
        r.shouldBe(t, "t.iterator.leftNode() && t.iterator.leftNode().getAttribute('id')", "'a1'");
        r.shouldBe(t, "t.iterator.rightNode() && t.iterator.rightNode().getAttribute('id')", "'a2'");
    }
    function testSetUnfilteredPosition_RoundTripStability() {
        createWalker('<p><b id="b1"/><a id="a1">ABC</a><b id="b2">DEF</b>HIJ<b id="b3"/>KLM<a id="a2"/><b id="b4"/><a id="a3"/></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement, 0);
        t.forwardPositions = [];
        do {
            t.forwardPositions.push({node: t.iterator.container(), offset: t.iterator.unfilteredDomOffset()});
        } while (t.iterator.nextPosition());

        t.resultPositions = [];
        t.forwardPositions.forEach(function (pos, index) {
            t.iterator.setUnfilteredPosition(pos.node, pos.offset);
            t.expected = pos;
            t.resultPositions.push({node: t.iterator.container(), offset: t.iterator.unfilteredDomOffset()});
            r.shouldBe(t, "t.iterator.container()", "t.expected.node");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "t.expected.offset");

            if (t.forwardPositions[index + 1]) {
                t.expected = t.forwardPositions[index + 1];
                t.hasNext = t.iterator.nextPosition();
                r.shouldBe(t, "t.hasNext", "true");
                r.shouldBe(t, "t.iterator.container()", "t.expected.node");
                r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "t.expected.offset");
            }
        });
    }
    function testSetUnfilteredPosition_ImmediatelyMovesToNextValidPosition() {
        createWalker('<p><b id="b1"/><a id="a1"/><b id="b2"/><b id="b3"/><a id="a2"/><b id="b4"/><a id="a3"/></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.childNodes[0], 0);
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");

        t.iterator.nextPosition();
        r.shouldBe(t, "t.iterator.container().getAttribute('id')", "'a1'");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }
    function testSetUnfilteredPosition_ChildOfInvalidNode_ImmediatelyMovesToNextValidPosition() {
        createWalker('<p><b id="b1"><a id="a0"/></b><a id="a1"/></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.childNodes[0].childNodes[0], 0); // a0
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");

        t.iterator.nextPosition();
        r.shouldBe(t, "t.iterator.container().getAttribute('id')", "'a1'");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }
    function testSetUnfilteredPosition_GrandChildOfInvalidNode_ImmediatelyMovesToNextValidPosition() {
        createWalker('<p><b id="b1"><a id="a0"><a id="a0.0"/></a></b><a id="a1"/></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.childNodes[0].childNodes[0].childNodes[0], 0); // a0.0
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");

        t.iterator.nextPosition();
        r.shouldBe(t, "t.iterator.container().getAttribute('id')", "'a1'");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }
    function testSetUnfilteredPosition_ChildOfNestedInvalidNodes_ImmediatelyMovesToNextValidPosition() {
        createWalker('<p><b id="b1"><b id="b1.1"><a id="a0"/></b></b><a id="a1"/></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.childNodes[0].childNodes[0].childNodes[0], 0); // a0
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");

        t.iterator.nextPosition();
        r.shouldBe(t, "t.iterator.container().getAttribute('id')", "'a1'");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }
    function testSetUnfilteredPosition_HandlesChildNodesCorrectly() {
        createWalker('<p><a id="a1"><b id="b1"/></a></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.firstChild, 0);
        r.shouldBe(t, "t.iterator.getCurrentNode() && t.iterator.getCurrentNode().getAttribute('id')", "'a1'");
    }
    function testSetUnfilteredPosition_ChildOfNonVisibleNode() {
        createWalker('<p id="p1"><b id="b1"><a id="a1"/></b></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.firstChild, 0);
        r.shouldBe(t, "t.iterator.getCurrentNode() && t.iterator.getCurrentNode().getAttribute('id')", "'p1'");
    }
    function testSetUnfilteredPosition_ChildOfSkippedNode() {
        createWalker('<p id="p1"><c id="c1"><a id="a1"/></c></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.firstChild, 0);
        r.shouldBe(t, "t.iterator.getCurrentNode() && t.iterator.getCurrentNode().getAttribute('id')", "'a1'");
    }
    function testSetUnfilteredPosition_NestedChildOfSkippedNode() {
        createWalker('<p id="p1"><c id="c1"><c id="c2"><a id="a1"/></c></c></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.firstChild, 0);
        r.shouldBe(t, "t.iterator.getCurrentNode() && t.iterator.getCurrentNode().getAttribute('id')", "'a1'");
    }
    function iterateOverNode_NextPosition_EventuallyStops() {
        var fragment;
        createWalker('<p id="p1"><c id="c1"><c id="c2"><a id="a1"/></c></c></p>');
        fragment = t.doc.documentElement.firstChild;
        t.iterator.setUnfilteredPosition(fragment, 0);
        t.loopCount = 0;

        while (t.iterator.nextPosition() && t.loopCount < 100) {
            t.loopCount += 1;
        }

        r.shouldBe(t, "t.loopCount", "2");
    }
    function iterateOverDisconnectedNode_NextPosition_EventuallyStops() {
        var fragment;
        createWalker('<p id="p1"><c id="c1"><c id="c2"><a id="a1"/></c></c></p>');
        fragment = t.doc.documentElement.firstChild;
        t.doc.documentElement.removeChild(fragment);
        t.iterator.setUnfilteredPosition(fragment, 0);
        t.loopCount = 0;

        while (t.iterator.nextPosition() && t.loopCount < 100) {
            t.loopCount += 1;
        }

        r.shouldBe(t, "t.loopCount", "1");
    }
    function iterateOverDisconnectedNode_PreviousPosition_EventuallyStops() {
        var fragment;
        createWalker('<p id="p1"><c id="c1"><c id="c2"><a id="a1"/></c></c></p>');
        fragment = t.doc.documentElement.firstChild;
        t.doc.documentElement.removeChild(fragment);
        t.iterator.setUnfilteredPosition(fragment, 0);
        t.loopCount = 0;

        while (t.iterator.previousPosition() && t.loopCount < 100) {
            t.loopCount += 1;
        }

        r.shouldBe(t, "t.loopCount", "0");
    }
    this.tests = function () {
        return r.name([
            create,
            forwardInEmptyDoc,
            backwardInEmptyDoc,
            forwardInSimpleDoc,
            backwardInSimpleDoc,
            forwardInDoc,
            backwardInDoc,
            rejectedNodes,
            emptyTextNodes,
            testSplitTextNodes,

            testRoundTripStability,

            testSetUnfilteredPosition_UsesUnfilteredOffsets,
            testSetUnfilteredPosition_ImmediatelyMovesToNextValidPosition,
            testSetUnfilteredPosition_ChildOfInvalidNode_ImmediatelyMovesToNextValidPosition,
            testSetUnfilteredPosition_GrandChildOfInvalidNode_ImmediatelyMovesToNextValidPosition,
            testSetUnfilteredPosition_ChildOfNestedInvalidNodes_ImmediatelyMovesToNextValidPosition,
            testSetUnfilteredPosition_HandlesChildNodesCorrectly,
            testSetUnfilteredPosition_ChildOfNonVisibleNode,
            testSetUnfilteredPosition_ChildOfSkippedNode,
            testSetUnfilteredPosition_NestedChildOfSkippedNode,
            testSetUnfilteredPosition_RoundTripStability,

            iterateOverNode_NextPosition_EventuallyStops,
            iterateOverDisconnectedNode_NextPosition_EventuallyStops,
            iterateOverDisconnectedNode_PreviousPosition_EventuallyStops
        ]);
    };
    this.asyncTests = function () {
        return [
        ];
    };
};
core.PositionIteratorTests.prototype.description = function () {
    "use strict";
    return "Test the PositionIterator class.";
};
(function () {
    "use strict";
    return core.PositionIteratorTests;
}());
