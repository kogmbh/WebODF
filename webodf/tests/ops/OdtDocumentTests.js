/**
 * Copyright (C) 2013 KO GmbH <jos.van.den.oever@kogmbh.com>
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
        inputMemberId = "Joe";

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
            if (node.namespaceURI === "urn:webodf:names:cursor") {
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
    function createOdtDocument(xml) {
        var domDocument = testarea.ownerDocument,
            doc = core.UnitTest.createOdtDocument("<office:text>" + xml + "</office:text>", odf.Namespaces.namespaceMap),
            node = /**@type{!Element}*/(domDocument.importNode(doc.documentElement, true));

        testarea.appendChild(node);

        t.root = node;
        t.odtDocument = new ops.OdtDocument(new MockOdfCanvas(t.root));
        t.cursor = new ops.OdtCursor(inputMemberId, t.odtDocument);
        t.odtDocument.addCursor(t.cursor);
        t.counter = t.cursor.getStepCounter();

        t.range = t.root.ownerDocument.createRange();
        t.filter = t.odtDocument.getPositionFilter();
        return node;
    }
    function appendCssRule(rule) {
        t.styles.insertRule(rule, t.styles.cssRules.length);
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
            cursorSerialized = /<ns\d:cursor[^>]*><\/ns\d:cursor>/,
            position,
            step = 0;

        serializer.filter = new OdfOrCursorNodeFilter();
        runtime.log("Scenario: " + documentString);
        t.segmentCount = segments.length;
        r.shouldBe(t, "t.segmentCount > 1", "true");
        createOdtDocument(segments.join(""));

        // Test iteration forward
        for (position = 1; position < segments.length; position += 1) {
            setCursorPosition(step);
            t.lastValidStep = step;
            t.expected = "<office:text>" +
                segments.slice(0, position).join("") + "|" + segments.slice(position, segments.length).join("") +
                "</office:text>";
            t.result = serializer.writeToString(t.root.firstChild, odf.Namespaces.namespaceMap);
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
            t.expected = "<office:text>" +
                segments.slice(0, position).join("") + "|" + segments.slice(position, segments.length).join("") +
                "</office:text>";
            t.result = serializer.writeToString(t.root.firstChild, odf.Namespaces.namespaceMap);
            t.result = t.result.replace(cursorSerialized, "|");
            r.shouldBe(t, "t.result", "t.expected");
            step -= 1;
        }
        // Ensure there are no other walkable positions in the document
        t.isFirstStep = documentHasStep(step) === false;
        r.shouldBe(t, "t.isFirstStep", "true");
    }
    /*jslint regexp:false*/
    function testCountLinesStepsDown_FromParagraphStart() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(0);
        t.steps = t.counter.countLinesSteps(1, t.filter);
        r.shouldBe(t, "t.steps", "5");
    }
    function testCountLinesStepsDown_FromParagraphEnd() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(4);
        t.steps = t.counter.countLinesSteps(1, t.filter);
        r.shouldBe(t, "t.steps", "6");
    }
    function testCountLinesStepsDown_FromJaggedParagraphEnd() {
        createOdtDocument("<text:p>ABCDE</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(5);
        t.steps = t.counter.countLinesSteps(1, t.filter);
        r.shouldBe(t, "t.steps", "6");
    }
    function testCountLinesStepsDown_OverWrap() {
        createOdtDocument("<text:p text:style-name='width30px'>ABCD FGHIJ</text:p>");
        appendCssRule("text|p[text|style-name=width30px] { width: 30px; }\n"); // Width calculated to wrap at first space
        setCursorPosition(4);
        t.steps = t.counter.countLinesSteps(1, t.filter);
        r.shouldBe(t, "t.steps", "6");
    }
    function testCountLinesStepsUp_FromParagraphStart() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(5);
        t.steps = t.counter.countLinesSteps(-1, t.filter);
        r.shouldBe(t, "t.steps", "-5");
    }
    function testCountLinesStepsUp_FromParagraphEnd() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(10);
        t.steps = t.counter.countLinesSteps(-1, t.filter);
        r.shouldBe(t, "t.steps", "-6");
    }
    function testCountLinesStepsUp_FromJaggedParagraphEnd() {
        createOdtDocument("<text:p>ABCDE</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(11);
        t.steps = t.counter.countLinesSteps(-1, t.filter);
        r.shouldBe(t, "t.steps", "-7");
    }
    function testCountStepsToLineBoundary_Forward_FromParagraphStart() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(0);
        t.steps = t.counter.countStepsToLineBoundary(1, t.filter);
        r.shouldBe(t, "t.steps", "4");
    }
    function testCountStepsToLineBoundary_Forward_StartingAtSpace() {
        createOdtDocument("<text:p> BCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(0);
        t.steps = t.counter.countStepsToLineBoundary(1, t.filter);
        r.shouldBe(t, "t.steps", "3");
    }
    function testCountStepsToLineBoundary_Forward_EndingAtSpace() {
        createOdtDocument("<text:p>ABC </text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(0);
        t.steps = t.counter.countStepsToLineBoundary(1, t.filter);
        r.shouldBe(t, "t.steps", "3");
    }
    function testCountStepsToLineBoundary_Forward_OverWrapping() {
        createOdtDocument("<text:p text:style-name='width30px'>ABC DEF</text:p>");
        appendCssRule("text|p[text|style-name=width30px] { width: 30px; }\n"); // Width calculated to wrap at first space
        setCursorPosition(0);
        t.steps = t.counter.countStepsToLineBoundary(1, t.filter);
        r.shouldBe(t, "t.steps", "3");
    }
    function testCountStepsToLineBoundary_Backward_FromParagraphStart() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(0);
        t.steps = Math.abs(t.counter.countStepsToLineBoundary(-1, t.filter)); // Chrome tells me this is -0. Er wat?
        r.shouldBe(t, "t.steps", "0");
    }
    function testCountStepsToLineBoundary_Backward_EndingAtWhiteSpace() {
        createOdtDocument("<text:p> BCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(3);
        t.steps = t.counter.countStepsToLineBoundary(-1, t.filter);
        r.shouldBe(t, "t.steps", "-3");
    }
    function testCountStepsToLineBoundary_Backward_FromParagraphEnd() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(4);
        t.steps = t.counter.countStepsToLineBoundary(-1, t.filter);
        r.shouldBe(t, "t.steps", "-4");
    }
    function testCountStepsToLineBoundary_Backward_OverWhiteSpace() {
        createOdtDocument("<text:p>A <text:span> BC</text:span>D</text:p>");
        setCursorPosition(5);
        t.steps = t.counter.countStepsToLineBoundary(-1, t.filter);
        r.shouldBe(t, "t.steps", "-5");
    }
    function testCountStepsToLineBoundary_Backward_OverWhiteSpaceOnlyNode() {
        createOdtDocument("<text:p>A <text:span>   </text:span>D</text:p>");
        setCursorPosition(3);
        t.steps = t.counter.countStepsToLineBoundary(-1, t.filter);
        r.shouldBe(t, "t.steps", "-3");
    }
    function testCountStepsToLineBoundary_Backward_OverEmptyTextNodes() {
        var spans;
        createOdtDocument("<text:p>A <text:span/><text:span/> D </text:p>");
        // Add an empty text node to the span element
        spans = t.root.getElementsByTagNameNS(odf.Namespaces.textns, "span");
        spans[0].appendChild(t.root.ownerDocument.createTextNode(""));
        spans[1].parentNode.insertBefore(t.root.ownerDocument.createTextNode(""), spans[0]);
        spans[1].appendChild(t.root.ownerDocument.createTextNode(""));
        spans[1].parentNode.insertBefore(t.root.ownerDocument.createTextNode(""), spans[1]);
        setCursorPosition(3);
        t.steps = t.counter.countStepsToLineBoundary(-1, t.filter);
        r.shouldBe(t, "t.steps", "-3");
    }
    function testCountStepsToLineBoundary_Backward_OverWrapping() {
        createOdtDocument("<text:p text:style-name='width30px'>ABC DEF</text:p>");
        appendCssRule("text|p[text|style-name=width30px] { width: 30px; }\n"); // Width calculated to wrap at first space
        setCursorPosition(6);
        t.steps = t.counter.countStepsToLineBoundary(-1, t.filter);
        r.shouldBe(t, "t.steps", "-2");
    }
    function testCountStepsToLineBoundary_Backward_OverWrapping2() {
        createOdtDocument("<text:p text:style-name='width40px'>ABC D <text:span>E</text:span>F</text:p>");
        appendCssRule("text|p[text|style-name=width40px] { width: 40px; }\n"); // Width calculated to wrap at first space
        setCursorPosition(8);
        t.steps = t.counter.countStepsToLineBoundary(-1, t.filter);
        r.shouldBe(t, "t.steps", "-4");
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
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0);
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
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0);
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
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0);
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
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0);
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
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0);
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
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0);
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
        t.rootToAnchor = t.odtDocument.convertDomPointToCursorStep(t.cursor.getAnchorNode(), 0);
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0);
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
        t.rootToFocus = t.odtDocument.convertDomPointToCursorStep(t.cursor.getNode(), 0);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.anchorInDiv", "false");
        r.shouldBe(t, "t.cursorInDiv", "false");
        r.shouldBe(t, "t.rootToFocus", "1");
    }

    function testAvailablePositions_EmptyParagraph() {
        // Examples from README_cursorpositions.txt
        testCursorPositions("<text:p>|</text:p>");
        // TODO behaviour is different from README_cursorpositions
        // cursorPositionsTest("<text:p><text:span>|</text:span></text:p>");
        // TODO behaviour is different from README_cursorpositions
        // cursorPositionsTest("<text:p><text:span>|</text:span><text:span></text:span></text:p>");
        // TODO behaviour is different from README_cursorpositions
        // cursorPositionsTest("<text:p><text:span>|<text:span></text:span></text:span></text:p>");
        testCursorPositions("<text:p>|  </text:p>");
        // TODO behaviour is different from README_cursorpositions
        // cursorPositionsTest("<text:p>  <text:span>|  </text:span>  </text:p>");
        // TODO behaviour is different from README_cursorpositions
        // cursorPositionsTest("<text:p>  <text:span>|  </text:span> <text:span>  <text:span>  </text:span>  </text:span>  </text:p>");
    }
    function testAvailablePositions_SimpleTextNodes() {
        // Examples from README_cursorpositions.txt
        testCursorPositions("<text:p>|A|B|C|</text:p>");
    }
    function testAvailablePositions_MixedSpans() {
        // Examples from README_cursorpositions.txt
        testCursorPositions("<text:p><text:span>|A|B|</text:span>C|</text:p>");
        testCursorPositions("<text:p>|A|<text:span>B|</text:span>C|</text:p>");
        testCursorPositions("<text:p>|A|<text:span>B|C|</text:span></text:p>");
        testCursorPositions("<text:p><text:span>|A|<text:span>B|</text:span></text:span>C|</text:p>");
        testCursorPositions("<text:p>|A|<text:span><text:span>B|</text:span>C|</text:span></text:p>");
    }
    function testAvailablePositions_Whitespace() {
        // Examples from README_cursorpositions.txt
        testCursorPositions("<text:p>|A| |B|C|</text:p>");
        testCursorPositions("<text:p>   |A|  </text:p>");
        testCursorPositions("<text:p>|A| |B|</text:p>");
        testCursorPositions("<text:p>  |A| | B|  </text:p>");
        testCursorPositions("<text:p>  <text:span>  |a|  </text:span>  </text:p>");
        testCursorPositions("<text:p>  <text:span>|a| | </text:span> <text:span>  b|</text:span>  </text:p>");
        // TODO behaviour is different from README_cursorpositions
        // cursorPositionsTest("<text:p>  <text:span>  |a<text:span>|</text:span>  </text:span>  </text:p>");
        testCursorPositions("<text:p>  <text:span>  |a|<text:span></text:span>  </text:span>  </text:p>");
        testCursorPositions("<text:p><text:span></text:span>  |a|</text:p>");
    }
    function testAvailablePositions_SpaceElements() {
        // Examples from README_cursorpositions.txt
        testCursorPositions("<text:p>|A|<text:s> </text:s>|B|C|</text:p>");
        // Unexpanded spaces - Not really supported, but interesting to test
        testCursorPositions("<text:p>|A|<text:s></text:s>|B|C|</text:p>");
        // Slight span nesting and positioning
        testCursorPositions("<text:p><text:span>|<text:s> </text:s>|</text:span></text:p>");
        // TODO behaviour is different from README_cursorpositions
        // cursorPositionsTest("<text:p> <text:span>|A| |</text:span> <text:s></text:s>| <text:span><text:s> </text:s>|B|</text:span> </text:p>");
        testCursorPositions("<text:p>|<text:tab>    </text:tab>|<text:s> </text:s>|<text:s> </text:s>|</text:p>");
        testCursorPositions("<text:p>|<text:tab>    </text:tab>| |<text:s> </text:s>|</text:p>");
        testCursorPositions("<text:p>|a| | <text:s> </text:s>|   </text:p>");
    }
    function testAvailablePositions_DrawElements() {
        testCursorPositions("<text:p>|<draw:frame text:anchor-type=\"as-char\"><draw:image><office:binary-data>data</office:binary-data></draw:image></draw:frame>|</text:p>");
        testCursorPositions("<text:p><text:span>|<draw:frame text:anchor-type=\"as-char\"><draw:image><office:binary-data>data</office:binary-data></draw:image></draw:frame>|</text:span></text:p>");
    }
    function testAvailablePositions_Annotations() {
        testCursorPositions('<text:p>|a|b|<office:annotation><text:list><text:list-item><text:p>|</text:p></text:list-item></text:list></office:annotation>|c|d|<office:annotation-end></office:annotation-end>1|2|</text:p>');
    }
    function testAvailablePositions_BetweenAnnotationAndSpan() {
        testCursorPositions('<text:p>|a|b|<office:annotation><text:list><text:list-item><text:p>|</text:p></text:list-item></text:list></office:annotation><text:span>c|d|e|</text:span><office:annotation-end></office:annotation-end>1|2|</text:p>');
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
            testCountLinesStepsDown_FromParagraphStart,
            testCountLinesStepsDown_FromParagraphEnd,
            testCountLinesStepsDown_FromJaggedParagraphEnd,
            testCountLinesStepsDown_OverWrap,

            testCountLinesStepsUp_FromParagraphStart,
            testCountLinesStepsUp_FromParagraphEnd,
            testCountLinesStepsUp_FromJaggedParagraphEnd,

            testCountStepsToLineBoundary_Forward_FromParagraphStart,
            testCountStepsToLineBoundary_Forward_StartingAtSpace,
            testCountStepsToLineBoundary_Forward_EndingAtSpace,
            testCountStepsToLineBoundary_Forward_OverWrapping,

            testCountStepsToLineBoundary_Backward_FromParagraphStart,
            testCountStepsToLineBoundary_Backward_EndingAtWhiteSpace,
            testCountStepsToLineBoundary_Backward_FromParagraphEnd,
            testCountStepsToLineBoundary_Backward_OverWhiteSpace,
            testCountStepsToLineBoundary_Backward_OverWhiteSpaceOnlyNode,
            testCountStepsToLineBoundary_Backward_OverEmptyTextNodes,
            testCountStepsToLineBoundary_Backward_OverWrapping,
            testCountStepsToLineBoundary_Backward_OverWrapping2,

            testFixCursorPositions_AnchorInInvalidPlace,
            testFixCursorPositions_Range_CursorInInvalidPlace,
            testFixCursorPositions_Range_AnchorAndCursorInInvalidPlace,
            testFixCursorPositions_Collapsed_CursorInInvalidPlace,
            testFixCursorPositions_Range_AnchorAndCursorInInvalidPlace_OverAnnotation,
            testFixCursorPositions_CursorAndAnchorNearParagraphStart,
            testFixCursorPositions_CursorNearParagraphStart_ForwardSelection,
            testFixCursorPositions_CursorNearParagraphStart_ReverseSelection,

            testAvailablePositions_EmptyParagraph,
            testAvailablePositions_SimpleTextNodes,
            testAvailablePositions_MixedSpans,
            testAvailablePositions_Whitespace,
            testAvailablePositions_SpaceElements,
            testAvailablePositions_DrawElements,
            testAvailablePositions_Annotations,
            testAvailablePositions_BetweenAnnotationAndSpan,

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
            getTextNodeAtStep_EmptyP_MovesAllCursors_BeforeTextNode
        ]);
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
(function () {
    "use strict";
    return ops.OdtDocumentTests;
}());
