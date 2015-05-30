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

/*global Node, NodeFilter, runtime, core, gui, xmldom, ops*/

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
            if (node.nodeType === Node.TEXT_NODE && node.data === "xxxx") {
                return NodeFilter.FILTER_REJECT;
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
    /**
     * @param {!string} xml
     * @return {!Document}
     */
    function parseXML(xml) {
        // Workaround:
        // libxml2 or something else used by QtWebKit on the CI system (Ubuntu 10.04)
        // during execution of DOMParser.parseFromString seems to append
        // things to the passed xml string if it does not have a certain length,
        // resulting in the error "Extra content at the end of the document"
        // So prefixing with <?xml?> to reach past the critical length
        // Remove once CI is updated to something more recent than 2010
        return /** @type {!Document}*/(runtime.parseXML("<?xml version='1.0'      encoding='UTF-8'?>" + xml));
    }
    /**
     * @param {!string} xml
     * @return {undefined}
     */
    function createWalker(xml) {
        t.doc = parseXML(xml);
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
            t.doc = parseXML(xml.x);
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
            t.doc = parseXML(xml.x);
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
    function testSetUnfilteredPosition_ImmediatelyMovesToNextValidPosition_FirstChildIsText() {
        createWalker('<p>xxxx<b id="b1"/><a id="a1"/><b id="b2"/><b id="b3"/><a id="a2"/><b id="b4"/><a id="a3"/></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.childNodes[0], 0);
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "2");

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
    function testSetUnfilteredPosition_TextChildOfInvalidNode_ImmediatelyMovesToNextValidPosition() {
        createWalker('<p><b id="b1">TEXT</b><a id="a1"/></p>');
        t.iterator.setUnfilteredPosition(t.doc.documentElement.childNodes[0].childNodes[0], 0); // #text "TEXT"
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
        createWalker('<p><b id="b1"><b id="b1.1"><a id="a0"/></b>AAA</b><a id="a1"/></p>');
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
    function testSetUnfilteredPosition_FirstStepInRejectedRootNode() {
        createWalker('<p><b id="b1"><a id="a1"/><b id="b2"/><b id="b3"/><a id="a2"/></b></p>');
        t.iterator = new core.PositionIterator(t.doc.documentElement.firstChild, 0,
            filter);
        t.iterator.setUnfilteredPosition(t.doc.documentElement, 0);
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement.firstChild");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "4");

        t.hasNextStep = t.iterator.nextPosition();
        r.shouldBe(t, "t.hasNextStep", "false");
    }

    function setPositionBeforeElement_ChildOfNestedInvalidNodes_ImmediatelyMovesToNextValidPosition() {
        createWalker('<p><b id="b1"><b id="b1.1"><a id="a0"/></b>AAA</b><a id="a1"/></p>');
        t.iterator.setPositionBeforeElement(t.doc.documentElement.childNodes[0].childNodes[0].childNodes[0]); // a0
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "1");

        t.iterator.nextPosition();
        r.shouldBe(t, "t.iterator.container().getAttribute('id')", "'a1'");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "0");
    }

    function setPositionBeforeElement_FirstStepInFilteredRootNode() {
        createWalker('<b id="b1"><a id="a1"/><b id="b2"/><b id="b3"/><a id="a2"/></b>');
        t.iterator.setPositionBeforeElement(t.doc.documentElement);
        r.shouldBe(t, "t.iterator.container()", "t.doc.documentElement");
        r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "4");

        t.hasNextStep = t.iterator.nextPosition();
        r.shouldBe(t, "t.hasNextStep", "false");
    }

    /**
     * Verify the next N iterator positions match the supplied array
     *
     * @param {!Array.<!{container: !Node, offset: !number}>} expectedPositions
     * @return undefined
     */
    function verifyPositions(expectedPositions) {
        expectedPositions.forEach(function(expected) {
            t.expected = expected;
            r.shouldBe(t, "t.iterator.container()", "t.expected.container");
            r.shouldBe(t, "t.iterator.unfilteredDomOffset()", "t.expected.offset");
            t.iterator.nextPosition();
        });
    }

    function testSetPositionFunctionsEquivalence_StartAtRejectedNode() {
        var p,
            expectedPositions;

        createWalker('<p><b id="b1"/><a id="a1"/><b id="b2"/><b id="b3"/><a id="a2"/><b id="b4"/><a id="a3"/></p>');
        p = t.doc.documentElement;
        expectedPositions = [
            { container: p, offset: 1 },
            { container: p.childNodes[1], offset: 0 }
        ];

        t.iterator.setUnfilteredPosition(p, 0);
        verifyPositions(expectedPositions);

        t.iterator.setPositionBeforeElement(p.firstChild);
        verifyPositions(expectedPositions);
    }

    function testSetPositionFunctionsEquivalence_StartAtAcceptedNode() {
        var p,
            expectedPositions;

        createWalker('<p><b id="b1"/><a id="a1"/><b id="b2"/><b id="b3"/><a id="a2"/><b id="b4"/><a id="a3"/></p>');
        p = t.doc.documentElement;
        expectedPositions = [
            { container: p, offset: 1 },
            { container: p.childNodes[1], offset: 0 }
        ];

        t.iterator.setUnfilteredPosition(p, 1);
        verifyPositions(expectedPositions);

        t.iterator.setPositionBeforeElement(p.childNodes[1]);
        verifyPositions(expectedPositions);
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
            testSetUnfilteredPosition_ImmediatelyMovesToNextValidPosition_FirstChildIsText,
            testSetUnfilteredPosition_ChildOfInvalidNode_ImmediatelyMovesToNextValidPosition,
            testSetUnfilteredPosition_TextChildOfInvalidNode_ImmediatelyMovesToNextValidPosition,
            testSetUnfilteredPosition_GrandChildOfInvalidNode_ImmediatelyMovesToNextValidPosition,
            testSetUnfilteredPosition_ChildOfNestedInvalidNodes_ImmediatelyMovesToNextValidPosition,
            testSetUnfilteredPosition_HandlesChildNodesCorrectly,
            testSetUnfilteredPosition_ChildOfNonVisibleNode,
            testSetUnfilteredPosition_ChildOfSkippedNode,
            testSetUnfilteredPosition_NestedChildOfSkippedNode,
            testSetUnfilteredPosition_RoundTripStability,
            testSetUnfilteredPosition_FirstStepInRejectedRootNode,

            setPositionBeforeElement_ChildOfNestedInvalidNodes_ImmediatelyMovesToNextValidPosition,
            setPositionBeforeElement_FirstStepInFilteredRootNode,

            testSetPositionFunctionsEquivalence_StartAtRejectedNode,
            testSetPositionFunctionsEquivalence_StartAtAcceptedNode,

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
