/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, core, gui, odf, ops, Node, NodeFilter, xmldom*/

/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
ops.OdtDocumentTests = function OdtDocumentTests(runner) {
    "use strict";
    var r = runner,
        t,
        testarea,
        inputMemberId = "Joe",
        /**@const*/
        PREVIOUS = core.StepDirection.PREVIOUS,
        prefixToNamespace = {
            fo: odf.Namespaces.namespaceMap.fo,
            text: odf.Namespaces.namespaceMap.text,
            style: odf.Namespaces.namespaceMap.style,
            office: odf.Namespaces.namespaceMap.office,
            draw: odf.Namespaces.namespaceMap.draw,
            e: "urn:webodf:names:editinfo",
            c: "urn:webodf:names:cursor",
            html: "http://www.w3.org/1999/xhtml"
        };

    /**
     * Class that filters runtime specific nodes from the DOM.
     * @constructor
     * @implements {xmldom.LSSerializerFilter}
     */
    function OdfOrCursorNodeFilter() {
        var odfFilter = new odf.OdfNodeFilter();

        /**
         * @param {!Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            if (node.namespaceURI === prefixToNamespace.c ||
                node.namespaceURI === prefixToNamespace.e ||
                node.namespaceURI === prefixToNamespace.html) {
                return NodeFilter.FILTER_ACCEPT;
            }
            return odfFilter.acceptNode(node);
        };
    }

    /**
     * Trying to avoid having to load a complete document for these tests. Mocking ODF
     * canvas allows some simplification in the testing setup
     * @param {Element} node
     * @extends {odf.OdfCanvas} Well.... we don't really, but please shut your face closure compiler :)
     * @constructor
     */
    function MockOdfCanvas(node) {
        var self = this;
        this.odfContainer = function () { return self; };
        this.getContentElement = function () { return node.getElementsByTagNameNS(odf.Namespaces.officens, 'text')[0]; };
        this.rootElement = node;
    }
    function appendCssRule(rule) {
        t.styles.insertRule(rule, t.styles.cssRules.length);
    }
    function createOdtDocument(xml) {
        var domDocument = testarea.ownerDocument,
            doc = core.UnitTest.createOdtDocument("<office:text>" + xml + "</office:text>", prefixToNamespace),
            node = /**@type{!Element}*/(domDocument.importNode(doc.documentElement, true));

        testarea.appendChild(node);

        t.root = node;
        t.odtDocument = new ops.OdtDocument(new MockOdfCanvas(t.root));
        t.cursor = new ops.OdtCursor(inputMemberId, t.odtDocument);
        t.odtDocument.addCursor(t.cursor);

        t.range = t.root.ownerDocument.createRange();
        t.filter = t.odtDocument.getPositionFilter();
        appendCssRule("text|p { font-family: monospace; }\n"); // Ensure font chars are always monospaced
        return node;
    }

    /**
     * @param {!number} stepsToAnchor Number of steps to advance the cursor
     * @param {!number=} stepsDiffToFocus
     */
    function setCursorPosition(stepsToAnchor, stepsDiffToFocus) {
        var newRangeSelection = t.odtDocument.convertCursorToDomRange(stepsToAnchor, stepsDiffToFocus);
        t.cursor.setSelectedRange(newRangeSelection, stepsDiffToFocus >= 0);
    }

    /**
     * Returns true if both the anchor and focus nodes are in a walkable step
     * @returns {!boolean}
     */
    function isCursorSelectionInWalkablePositions() {
        var iterator = t.odtDocument.createStepIterator(t.cursor.getNode(), 0, [t.filter], t.root);

        if (iterator.isStep()) {
            iterator.setPosition(t.cursor.getAnchorNode(), 0);
            if (iterator.isStep()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns true if the supplied step exists in the current document. Otherwise returns false.
     * @param {!number} step
     * @returns {!boolean}
     */
    function documentHasStep(step) {
        try {
            t.odtDocument.convertCursorToDomRange(step, 0);
            return true;
        } catch(e) {
            return false;
        }
    }

    /**
     * Test cursor iteration over a document fragment. Each supported cursor position should be indicated in
     * the fragment using the pipe character ('|'). This exercises both forwards and backwards iteration.
     * @param {!string} documentString Document fragment with cursor positions indicated using a vertical pipe '|'
     */
    /*jslint regexp:true*/
    function testCursorPositions(documentString) {
        var segments = documentString.split("|"),
            serializer = new xmldom.LSSerializer(),
            cursorSerialized = /<c:cursor[^>]*><\/c:cursor>/,
            position,
            step = 0,
            documentRoot;

        serializer.filter = new OdfOrCursorNodeFilter();
        t.segmentCount = segments.length;
        t.expectedCursorPositionsCount = segments.length - 1; // e.g., <a>|</a> has two segments, but only one cursor position
        r.shouldBe(t, "t.segmentCount > 1", "true");
        documentRoot = createOdtDocument(segments.join(""));
        t.documentLength = t.odtDocument.convertDomPointToCursorStep(documentRoot, documentRoot.childNodes.length, PREVIOUS);
        r.shouldBe(t, "t.expectedCursorPositionsCount", "(t.documentLength+1)");

        // Test iteration forward
        for (position = 1; position < segments.length; position += 1) {
            setCursorPosition(step);
            t.currentDocLength = t.odtDocument.convertDomPointToCursorStep(documentRoot, documentRoot.childNodes.length, PREVIOUS);
            r.shouldBe(t, "t.currentDocLength", "t.documentLength");
            t.lastValidStep = step;
            t.expected = "<office:text>" +
                segments.slice(0, position).join("") + "|" + segments.slice(position, segments.length).join("") +
                "</office:text>";
            t.result = serializer.writeToString(t.root.firstChild, prefixToNamespace);
            t.result = t.result.replace(cursorSerialized, "|");
            r.shouldBe(t, "t.result", "t.expected");
            step += 1;
        }
        // Ensure there are no other walkable positions in the document
        t.isLastStep = documentHasStep(step) === false;
        r.shouldBe(t, "t.isLastStep", "true");
        step = t.lastValidStep;

        // Test iteration backward
        for (position = segments.length - 1; position > 0; position -= 1) {
            setCursorPosition(step);
            t.currentDocLength = t.odtDocument.convertDomPointToCursorStep(documentRoot, documentRoot.childNodes.length, PREVIOUS);
            r.shouldBe(t, "t.currentDocLength", "t.documentLength");
            t.expected = "<office:text>" +
                segments.slice(0, position).join("") + "|" + segments.slice(position, segments.length).join("") +
                "</office:text>";
            t.result = serializer.writeToString(t.root.firstChild, prefixToNamespace);
            t.result = t.result.replace(cursorSerialized, "|");
            r.shouldBe(t, "t.result", "t.expected");
            step -= 1;
        }
        // Ensure there are no other walkable positions in the document
        t.isFirstStep = documentHasStep(step) === false;
        r.shouldBe(t, "t.isFirstStep", "true");
    }

    /**
     * Wraps the supplied node in a parent div
     * @param {!Node} node
     */
    function wrapInDiv(node) {
        var container = t.root.ownerDocument.createElement("div");
        node.parentNode.insertBefore(container, node);
        container.appendChild(node);
    }
    function testFixCursorPositions_AnchorInInvalidPlace() {
        createOdtDocument("<text:p>ABCD</text:p>");
        setCursorPosition(1, 2);
        wrapInDiv(t.cursor.getAnchorNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = isCursorSelectionInWalkablePositions();
        t.anchorInDiv = t.cursor.getAnchorNode().parentNode.localName === "div";
        t.cursorInDiv = t.cursor.getNode().parentNode.localName === "div";
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0, PREVIOUS);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0, PREVIOUS);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.anchorInDiv", "false");
        r.shouldBe(t, "t.cursorInDiv", "false");
        r.shouldBe(t, "t.rootToAnchor", "1");
        r.shouldBe(t, "t.rootToFocus", "3");
    }
    function testFixCursorPositions_Range_CursorInInvalidPlace() {
        createOdtDocument("<text:p>ABCD</text:p>");
        setCursorPosition(1, 2);
        wrapInDiv(t.cursor.getNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = isCursorSelectionInWalkablePositions();
        t.anchorInDiv = t.cursor.getAnchorNode().parentNode.localName === "div";
        t.cursorInDiv = t.cursor.getNode().parentNode.localName === "div";
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0, PREVIOUS);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0, PREVIOUS);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.anchorInDiv", "false");
        r.shouldBe(t, "t.cursorInDiv", "false");
        r.shouldBe(t, "t.rootToAnchor", "1");
        r.shouldBe(t, "t.rootToFocus", "3");
    }
    function testFixCursorPositions_Range_AnchorAndCursorInInvalidPlace() {
        createOdtDocument("<text:p>ABCD</text:p>");
        setCursorPosition(1, 2);
        wrapInDiv(t.cursor.getNode());
        wrapInDiv(t.cursor.getAnchorNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = isCursorSelectionInWalkablePositions();
        t.anchorInDiv = t.cursor.getAnchorNode().parentNode.localName === "div";
        t.cursorInDiv = t.cursor.getNode().parentNode.localName === "div";
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0, PREVIOUS);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0, PREVIOUS);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.anchorInDiv", "false");
        r.shouldBe(t, "t.cursorInDiv", "false");
        r.shouldBe(t, "t.rootToAnchor", "1");
        r.shouldBe(t, "t.rootToFocus", "3");
    }
    function testFixCursorPositions_Range_AnchorAndCursorInInvalidPlace_OverAnnotation() {
        createOdtDocument("<text:p>AB<office:annotation><text:p>#</text:p></office:annotation>CD</text:p>");
        setCursorPosition(1, 4);
        wrapInDiv(t.cursor.getNode());
        wrapInDiv(t.cursor.getAnchorNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = isCursorSelectionInWalkablePositions();
        t.anchorInDiv = t.cursor.getAnchorNode().parentNode.localName === "div";
        t.cursorInDiv = t.cursor.getNode().parentNode.localName === "div";
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0, PREVIOUS);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0, PREVIOUS);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.anchorInDiv", "false");
        r.shouldBe(t, "t.cursorInDiv", "false");
        r.shouldBe(t, "t.rootToAnchor", "1");
        r.shouldBe(t, "t.rootToFocus", "5");
    }
    function testFixCursorPositions_CursorAndAnchorNearParagraphStart() {
        createOdtDocument("<text:p>A</text:p><text:p>BC</text:p><text:p>DE</text:p>");
        setCursorPosition(2, 3);
        wrapInDiv(t.cursor.getNode());
        wrapInDiv(t.cursor.getAnchorNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = isCursorSelectionInWalkablePositions();
        t.anchorInDiv = t.cursor.getAnchorNode().parentNode.localName === "div";
        t.cursorInDiv = t.cursor.getNode().parentNode.localName === "div";
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0, PREVIOUS);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0, PREVIOUS);
        t.selectedText = t.cursor.getSelectedRange().toString();
        r.shouldBe(t, "t.selectedText", "'BC'");
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.anchorInDiv", "false");
        r.shouldBe(t, "t.cursorInDiv", "false");
        r.shouldBe(t, "t.rootToAnchor", "2");
        r.shouldBe(t, "t.rootToFocus", "5");
    }
    function testFixCursorPositions_CursorNearParagraphStart_ForwardSelection() {
        createOdtDocument("<text:p>A</text:p><text:p>BCD</text:p><text:p>E</text:p>");
        setCursorPosition(2, 3);
        wrapInDiv(t.cursor.getNode());
        wrapInDiv(t.cursor.getAnchorNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = isCursorSelectionInWalkablePositions();
        t.anchorInDiv = t.cursor.getAnchorNode().parentNode.localName === "div";
        t.cursorInDiv = t.cursor.getNode().parentNode.localName === "div";
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0, PREVIOUS);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0, PREVIOUS);
        t.selectedText = t.cursor.getSelectedRange().toString();
        r.shouldBe(t, "t.selectedText", "'BCD'");
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.anchorInDiv", "false");
        r.shouldBe(t, "t.cursorInDiv", "false");
        r.shouldBe(t, "t.rootToAnchor", "2");
        r.shouldBe(t, "t.rootToFocus", "5");
    }
    function testFixCursorPositions_CursorNearParagraphStart_ReverseSelection() {
        createOdtDocument("<text:p>A</text:p><text:p>BCD</text:p><text:p>E</text:p>");
        setCursorPosition(5, -3);
        wrapInDiv(t.cursor.getNode());
        wrapInDiv(t.cursor.getAnchorNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = isCursorSelectionInWalkablePositions();
        t.anchorInDiv = t.cursor.getAnchorNode().parentNode.localName === "div";
        t.cursorInDiv = t.cursor.getNode().parentNode.localName === "div";
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0, PREVIOUS);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0, PREVIOUS);
        t.selectedText = t.cursor.getSelectedRange().toString();
        r.shouldBe(t, "t.selectedText", "'BCD'");
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.anchorInDiv", "false");
        r.shouldBe(t, "t.cursorInDiv", "false");
        r.shouldBe(t, "t.rootToAnchor", "5");
        r.shouldBe(t, "t.rootToFocus", "2");
    }
    function testFixCursorPositions_Collapsed_CursorInInvalidPlace() {
        createOdtDocument("<text:p>ABCD</text:p>");
        setCursorPosition(1);
        wrapInDiv(t.cursor.getNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = isCursorSelectionInWalkablePositions();
        t.anchorInDiv = t.cursor.getAnchorNode().parentNode.localName === "div";
        t.cursorInDiv = t.cursor.getNode().parentNode.localName === "div";
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0, PREVIOUS);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.anchorInDiv", "false");
        r.shouldBe(t, "t.cursorInDiv", "false");
        r.shouldBe(t, "t.rootToFocus", "1");
    }

    function getTextNodeAtStep_BeginningOfTextNode() {
        var doc = createOdtDocument("<text:p>ABCD</text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.domPosition = t.odtDocument.getTextNodeAtStep(0);

        // paragraph children are: <cursor>, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[1]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "'ABCD'");
        r.shouldBe(t, "t.domPosition.offset", "0");
    }

    function getTextNodeAtStep_EndOfTextNode() {
        var doc = createOdtDocument("<text:p>ABCD</text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.domPosition = t.odtDocument.getTextNodeAtStep(4);

        // paragraph children are: <cursor>, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[1]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "'ABCD'");
        r.shouldBe(t, "t.domPosition.offset", "4");
    }

    function getTextNodeAtStep_PositionWithNoTextNode_AddsNewNode_Front() {
        var doc = createOdtDocument("<text:p><text:s> </text:s></text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.domPosition = t.odtDocument.getTextNodeAtStep(0);

        // paragraph children are: <cursor>, #text, <s>
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[1]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "''");
        r.shouldBe(t, "t.domPosition.offset", "0");
    }

    function getTextNodeAtStep_PositionWithNoTextNode_AddsNewNode_Back() {
        var doc = createOdtDocument("<text:p><text:s> </text:s></text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.domPosition = t.odtDocument.getTextNodeAtStep(1);

        // paragraph children are: <cursor>, <s>, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[2]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "''");
        r.shouldBe(t, "t.domPosition.offset", "0");
    }

    function getTextNodeAtStep_At0_PutsTargetMemberCursor_AfterTextNode() {
        var doc = createOdtDocument("<text:p>ABCD</text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        setCursorPosition(0);

        t.domPosition = t.odtDocument.getTextNodeAtStep(0, inputMemberId);

        // paragraph children are: #text, <cursor>, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[0]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "''");
        r.shouldBe(t, "t.domPosition.offset", "0");
        r.shouldBe(t, "t.cursor.getNode().previousSibling", "t.domPosition.textNode");
    }

    function getTextNodeAtStep_At1_PutsTargetMemberCursor_AfterTextNode() {
        var doc = createOdtDocument("<text:p>ABCD</text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        setCursorPosition(1);

        t.domPosition = t.odtDocument.getTextNodeAtStep(1, inputMemberId);

        // paragraph children are: #text, <cursor>, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[0]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "'A'");
        r.shouldBe(t, "t.domPosition.offset", "1");
        r.shouldBe(t, "t.cursor.getNode().previousSibling", "t.domPosition.textNode");
    }

    function getTextNodeAtStep_At4_PutsTargetMemberCursor_AfterTextNode() {
        var doc = createOdtDocument("<text:p>ABCD</text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        setCursorPosition(4);

        t.domPosition = t.odtDocument.getTextNodeAtStep(4, inputMemberId);

        // paragraph children are: #text, <cursor>
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[0]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "'ABCD'");
        r.shouldBe(t, "t.domPosition.offset", "4");
        r.shouldBe(t, "t.cursor.getNode().previousSibling", "t.domPosition.textNode");
    }

    function getTextNodeAtStep_AfterNonText_PutsTargetMemberCursor_AfterTextNode() {
        var doc = createOdtDocument("<text:p>ABC<text:s> </text:s></text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        setCursorPosition(4);

        t.domPosition = t.odtDocument.getTextNodeAtStep(4, inputMemberId);

        // paragraph children are: #text, <s>, #text, <cursor>
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[2]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "''");
        r.shouldBe(t, "t.domPosition.offset", "0");
        r.shouldBe(t, "t.cursor.getNode().previousSibling", "t.domPosition.textNode");
    }

    function getTextNodeAtStep_RearrangesExistingCursors_MovesMemberAfterTextNode() {
        var doc = createOdtDocument("<text:p/>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        t.odtDocument.addCursor(new ops.OdtCursor("new 1", t.odtDocument));
        t.odtDocument.addCursor(new ops.OdtCursor("new 2", t.odtDocument));

        t.domPosition = t.odtDocument.getTextNodeAtStep(0, inputMemberId);

        // paragraph children are: <cursor>, <cursor>, #text, <cursor member="Joe">
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[2]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "''");
        r.shouldBe(t, "t.domPosition.offset", "0");
        r.shouldBe(t, "t.cursor.getNode().previousSibling", "t.domPosition.textNode");
    }

    function getTextNodeAtStep_At0_PutsTargetMemberCursor_BeforeTextNode() {
        var doc = createOdtDocument("<text:p>ABCD</text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        setCursorPosition(0);

        t.domPosition = t.odtDocument.getTextNodeAtStep(0);

        // paragraph children are: <cursor>, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[1]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "'ABCD'");
        r.shouldBe(t, "t.domPosition.offset", "0");
        r.shouldBe(t, "t.cursor.getNode().nextSibling", "t.domPosition.textNode");
    }

    function getTextNodeAtStep_At1_PutsTargetMemberCursor_BeforeTextNode() {
        var doc = createOdtDocument("<text:p>ABCD</text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        setCursorPosition(1);

        t.domPosition = t.odtDocument.getTextNodeAtStep(1);

        // paragraph children are: #text, <cursor>, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[2]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "'BCD'");
        r.shouldBe(t, "t.domPosition.offset", "0");
        r.shouldBe(t, "t.cursor.getNode().nextSibling", "t.domPosition.textNode");
    }

    function getTextNodeAtStep_At4_PutsTargetMemberCursor_BeforeTextNode() {
        var doc = createOdtDocument("<text:p>ABCD</text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        setCursorPosition(4);

        t.domPosition = t.odtDocument.getTextNodeAtStep(4);

        // paragraph children are: #text, <cursor>, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[2]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "''");
        r.shouldBe(t, "t.domPosition.offset", "0");
        r.shouldBe(t, "t.cursor.getNode().nextSibling", "t.domPosition.textNode");
    }

    function getTextNodeAtStep_AfterNonText_PutsTargetMemberCursor_BeforeTextNode() {
        var doc = createOdtDocument("<text:p>ABC<text:s> </text:s></text:p>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        setCursorPosition(4);

        t.domPosition = t.odtDocument.getTextNodeAtStep(4);

        // paragraph children are: #text, <s>, <cursor>, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[3]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "''");
        r.shouldBe(t, "t.domPosition.offset", "0");
        r.shouldBe(t, "t.cursor.getNode().nextSibling", "t.domPosition.textNode");
    }

    function getTextNodeAtStep_EmptyP_MovesAllCursors_BeforeTextNode() {
        var doc = createOdtDocument("<text:p/>");
        t.paragraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];
        t.odtDocument.addCursor(new ops.OdtCursor("new 1", t.odtDocument));
        t.odtDocument.addCursor(new ops.OdtCursor("new 2", t.odtDocument));

        t.domPosition = t.odtDocument.getTextNodeAtStep(0);

        // paragraph children are: <cursor>, <cursor>, <cursor member="Joe">, #text
        r.shouldBe(t, "t.domPosition.textNode", "t.paragraph.childNodes[3]");
        r.shouldBe(t, "t.domPosition.textNode.textContent", "''");
        r.shouldBe(t, "t.domPosition.offset", "0");
        r.shouldBe(t, "t.domPosition.textNode.nextSibling", "null");
        r.shouldBe(t, "t.domPosition.textNode.previousSibling.localName", "'cursor'");
    }

    function emitSignals_AggregatedDuringOpExecution_MaintainsOrder() {
        createOdtDocument("<text:p/>");
        t.emitCalls = [];
        t.odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, function(args) {t.emitCalls.push(args); });

        t.odtDocument.pauseSignalEmitting();
        t.odtDocument.emit(ops.OdtDocument.signalParagraphChanged, "call1");
        t.odtDocument.emit(ops.OdtDocument.signalParagraphChanged, "call2");

        r.shouldBe(t, "t.emitCalls.length", "0");

        t.odtDocument.resumeSignalEmitting();
        r.shouldBe(t, "t.emitCalls", "['call1', 'call2']");
    }

    function emitSignals_NewEmitDuringEndOp_EmitsImmediately() {
        createOdtDocument("<text:p/>");
        t.emitCalls = [];
        t.odtDocument.subscribe(ops.OdtDocument.signalTableAdded, function(args) {
            t.emitCalls.push(args);
            t.odtDocument.emit(ops.OdtDocument.signalParagraphChanged, "callImmediate");
        });
        t.odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, function(args) { t.emitCalls.push(args); });

        t.odtDocument.pauseSignalEmitting();
        t.odtDocument.emit(ops.OdtDocument.signalParagraphChanged, "call1");
        t.odtDocument.emit(ops.OdtDocument.signalTableAdded, "call2");
        t.odtDocument.emit(ops.OdtDocument.signalParagraphChanged, "call3");

        r.shouldBe(t, "t.emitCalls.length", "0");

        t.odtDocument.resumeSignalEmitting();
        r.shouldBe(t, "t.emitCalls", "['call1', 'call2', 'callImmediate', 'call3']");
    }

    function emitSignals_WhenNotExecutingOp_EmitsImmediately() {
        createOdtDocument("<text:p/>");
        t.emitCalls = [];
        t.odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, function(args) {t.emitCalls.push(args); });

        t.odtDocument.emit(ops.OdtDocument.signalParagraphChanged, "call1");
        t.odtDocument.emit(ops.OdtDocument.signalParagraphChanged, "call2");

        r.shouldBe(t, "t.emitCalls", "['call1', 'call2']");
    }

    function emitSignals_ExceptionsThrownDuringDelayedEmit_DontPreventFurtherSignals() {
        createOdtDocument("<text:p/>");
        t.emitCalls = [];
        t.odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, function(args) { t.emitCalls.push(args); });
        t.odtDocument.subscribe(ops.OdtDocument.signalTableAdded, function(args) {
            t.emitCalls.push(args);
            throw new Error("intentional error");
        });

        t.odtDocument.pauseSignalEmitting();
        t.odtDocument.emit(ops.OdtDocument.signalParagraphChanged, "call1");
        t.odtDocument.emit(ops.OdtDocument.signalTableAdded, "call2");
        t.odtDocument.emit(ops.OdtDocument.signalParagraphChanged, "call3");
        t.odtDocument.resumeSignalEmitting();

        r.shouldBe(t, "t.emitCalls", "['call1', 'call2', 'call3']");
    }

    function cursorPositionTests() {
        // Examples from README_cursorpositions.txt
        
        return [
            // *************** Empty Paragraph *************** //
            // Examples from README_cursorpositions.txt
            "<text:p>|</text:p>",
            // TODO behaviour is different from README_cursorpositions
            // "<text:p><text:span>|</text:span></text:p>",
            // TODO behaviour is different from README_cursorpositions
            // "<text:p><text:span>|</text:span><text:span></text:span></text:p>",
            // TODO behaviour is different from README_cursorpositions
            // "<text:p><text:span>|<text:span></text:span></text:span></text:p>",
            "<text:p>|  </text:p>",
            // TODO behaviour is different from README_cursorpositions
            // "<text:p>  <text:span>|  </text:span>  </text:p>",
            // TODO behaviour is different from README_cursorpositions
            // "<text:p>  <text:span>|  </text:span> <text:span>  <text:span>  </text:span>  </text:span>  </text:p>",

            
            // *************** Simple Text Nodes *************** //
            "<text:p>|A|B|C|</text:p>",


            // *************** Mixed spans *************** //
            "<text:p><text:span>|A|B|</text:span>C|</text:p>",
            "<text:p>|A|<text:span>B|</text:span>C|</text:p>",
            "<text:p>|A|<text:span>B|C|</text:span></text:p>",
            "<text:p><text:span>|A|<text:span>B|</text:span></text:span>C|</text:p>",
            "<text:p>|A|<text:span><text:span>B|</text:span>C|</text:span></text:p>",


            // *************** Whitespace *************** //
            "<text:p>|A| |B|C|</text:p>",
            "<text:p>   |A|  </text:p>",
            "<text:p>|A| |B|</text:p>",
            "<text:p>  |A| | B|  </text:p>",
            "<text:p>  <text:span>  |a|  </text:span>  </text:p>",
            "<text:p>  <text:span>|a| | </text:span> <text:span>  b|</text:span>  </text:p>",
            // TODO behaviour is different from README_cursorpositions
            // cursorPositionsTest("<text:p>  <text:span>  |a<text:span>|</text:span>  </text:span>  </text:p>",
            "<text:p>  <text:span>  |a|<text:span></text:span>  </text:span>  </text:p>",
            "<text:p><text:span></text:span>  |a|</text:p>",


            // *************** Space elements *************** //
            "<text:p>|A|<text:s> </text:s>|B|C|</text:p>",
            // Unexpanded spaces - Not really supported, but interesting to test
            "<text:p>|A|<text:s></text:s>|B|C|</text:p>",
            // Slight span nesting and positioning
            "<text:p><text:span>|<text:s> </text:s>|</text:span></text:p>",
            // TODO behaviour is different from README_cursorpositions
            // cursorPositionsTest("<text:p> <text:span>|A| |</text:span> <text:s></text:s>| <text:span><text:s> </text:s>|B|</text:span> </text:p>",
            "<text:p>|<text:tab>    </text:tab>|<text:s> </text:s>|<text:s> </text:s>|</text:p>",
            "<text:p>|<text:tab>    </text:tab>| |<text:s> </text:s>|</text:p>",
            "<text:p>|a| | <text:s> </text:s>|   </text:p>",
            "<text:p><e:editinfo></e:editinfo><text:span></text:span>|a|<text:s> </text:s>|<text:s> </text:s>|<text:span></text:span><text:span></text:span></text:p>",


            // *************** Draw elements *************** //
            "<text:p>|<draw:frame text:anchor-type=\"as-char\"><draw:image><office:binary-data>data</office:binary-data></draw:image></draw:frame>|</text:p>",
            "<text:p><text:span>|<draw:frame text:anchor-type=\"as-char\"><draw:image><office:binary-data>data</office:binary-data></draw:image></draw:frame>|</text:span></text:p>",


            // *************** Annotations *************** //
            '<text:p>|a|b|<office:annotation><text:list><text:list-item><text:p>|</text:p></text:list-item></text:list></office:annotation>|c|d|<office:annotation-end></office:annotation-end>1|2|</text:p>',
            '<text:p>|a|<office:annotation><text:list><text:list-item><text:p>|b|</text:p></text:list-item></text:list></office:annotation>|c|<office:annotation-end></office:annotation-end>1|2|</text:p>',
            '<text:p>|a|<office:annotation><text:list><text:list-item><text:p>|b|</text:p></text:list-item></text:list></office:annotation>|<office:annotation-end></office:annotation-end>1|2|</text:p>',
            '<text:p>|<office:annotation><text:list><text:list-item><text:p>|</text:p></text:list-item></text:list></office:annotation><text:span>|</text:span></text:p>',
            '<text:p>|<office:annotation><text:list><text:list-item><text:p>|</text:p></text:list-item></text:list></office:annotation><e:editinfo></e:editinfo><text:span>|</text:span></text:p>',


            // *************** Annotations with highlighting *************** //
            '<text:p>|a|b|<office:annotation><text:list><text:list-item><text:p>|</text:p></text:list-item></text:list></office:annotation><text:span>|c|d|</text:span><office:annotation-end></office:annotation-end>1|2|</text:p>',
            '<text:p>|a|<html:div class="annotationWrapper"><office:annotation><text:list><text:list-item><text:p>|b|</text:p></text:list-item></text:list></office:annotation></html:div><html:span class="webodf-annotationHighlight">|c|</html:span><office:annotation-end></office:annotation-end>1|2|</text:p>',
            '<text:p>|a|<html:div class="annotationWrapper"><office:annotation><text:list><text:list-item><text:p>|b|</text:p></text:list-item></text:list></office:annotation></html:div><html:span class="webodf-annotationHighlight">|</html:span><office:annotation-end></office:annotation-end>1|2|</text:p>'
            
        ].map(function(testInput) {
                return {
                    name: "cursorPositions " + testInput,
                    f: testCursorPositions.bind(undefined, testInput)
                };
            });
    }

    this.setUp = function () {
        var doc, stylesElement;
        testarea = core.UnitTest.provideTestAreaDiv();
        doc = testarea.ownerDocument;
        stylesElement = doc.createElement("style");
        stylesElement.setAttribute("type", "text/css");
        stylesElement.appendChild(doc.createTextNode("@namespace text url(urn:oasis:names:tc:opendocument:xmlns:text:1.0);\n"));
        stylesElement.appendChild(doc.createTextNode("text|p { display: block; }\n")); // Make text:p behave as normal paragraphs
        doc.getElementsByTagName("head")[0].appendChild(stylesElement);
        t = {
            doc: doc,
            stylesElement: stylesElement,
            styles: stylesElement.sheet
        };
    };
    this.tearDown = function () {
        core.UnitTest.cleanupTestAreaDiv();
        t.stylesElement.parentNode.removeChild(t.stylesElement);
        t = {};
    };

    this.tests = function () {
        return r.name([
            testFixCursorPositions_AnchorInInvalidPlace,
            testFixCursorPositions_Range_CursorInInvalidPlace,
            testFixCursorPositions_Range_AnchorAndCursorInInvalidPlace,
            testFixCursorPositions_Collapsed_CursorInInvalidPlace,
            testFixCursorPositions_Range_AnchorAndCursorInInvalidPlace_OverAnnotation,
            testFixCursorPositions_CursorAndAnchorNearParagraphStart,
            testFixCursorPositions_CursorNearParagraphStart_ForwardSelection,
            testFixCursorPositions_CursorNearParagraphStart_ReverseSelection,

            getTextNodeAtStep_BeginningOfTextNode,
            getTextNodeAtStep_EndOfTextNode,
            getTextNodeAtStep_PositionWithNoTextNode_AddsNewNode_Front,
            getTextNodeAtStep_PositionWithNoTextNode_AddsNewNode_Back,
            getTextNodeAtStep_At0_PutsTargetMemberCursor_AfterTextNode,
            getTextNodeAtStep_At1_PutsTargetMemberCursor_AfterTextNode,
            getTextNodeAtStep_At4_PutsTargetMemberCursor_AfterTextNode,
            getTextNodeAtStep_AfterNonText_PutsTargetMemberCursor_AfterTextNode,
            getTextNodeAtStep_RearrangesExistingCursors_MovesMemberAfterTextNode,

            getTextNodeAtStep_At0_PutsTargetMemberCursor_BeforeTextNode,
            getTextNodeAtStep_At1_PutsTargetMemberCursor_BeforeTextNode,
            getTextNodeAtStep_At4_PutsTargetMemberCursor_BeforeTextNode,
            getTextNodeAtStep_AfterNonText_PutsTargetMemberCursor_BeforeTextNode,
            getTextNodeAtStep_EmptyP_MovesAllCursors_BeforeTextNode,

            emitSignals_AggregatedDuringOpExecution_MaintainsOrder,
            emitSignals_NewEmitDuringEndOp_EmitsImmediately,
            emitSignals_WhenNotExecutingOp_EmitsImmediately,
            emitSignals_ExceptionsThrownDuringDelayedEmit_DontPreventFurtherSignals
        ]).concat(cursorPositionTests());
    };
    this.asyncTests = function () {
        return [
        ];
    };
};
ops.OdtDocumentTests.prototype.description = function () {
    "use strict";
    return "Test the OdtDocument class.";
};
