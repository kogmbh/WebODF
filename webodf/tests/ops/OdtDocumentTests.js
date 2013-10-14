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
/*global runtime, core, gui, odf, ops, Node, NodeFilter, xmldom*/
runtime.loadClass("xmldom.LSSerializer");
runtime.loadClass("odf.Namespaces");
runtime.loadClass("gui.SelectionMover");
runtime.loadClass("ops.OdtDocument");
runtime.loadClass("ops.OdtCursor");
/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
ops.OdtDocumentTests = function OdtDocumentTests(runner) {
    "use strict";
    var r = runner,
        t, testarea;

    /**
     * Trying to avoid having to load a complete document for these tests. Mocking ODF
     * canvas allows some simplification in the testing setup
     * @param {Element} node
     * @extends {odf.OdfCanvas} Well.... we don't really, but please shut your face closure compiler :)
     * @constructor
     */
    function OdfCanvasAdapter(node) {
        var self = this;
        this.odfContainer = function() { return self; };
        this.getContentElement = function() { return node.getElementsByTagNameNS(odf.Namespaces.officens, 'text')[0]; };
    }
    function createOdtDocument(xml) {
        var domDocument = testarea.ownerDocument,
            doc = core.UnitTest.createOdtDocument("<office:text>" + xml + "</office:text>", odf.Namespaces.namespaceMap),
            node = /**@type{!Element}*/(domDocument.importNode(doc.documentElement, true));

        testarea.appendChild(node);

        t.root = node;
        t.odtDocument = new ops.OdtDocument(new OdfCanvasAdapter(t.root));
        t.cursor = new ops.OdtCursor("Joe", t.odtDocument);
        t.odtDocument.addCursor(t.cursor);
        t.counter = t.cursor.getStepCounter();

        t.range = t.root.ownerDocument.createRange();
        t.filter = t.odtDocument.getPositionFilter();
    }
    function appendCssRule(rule) {
        t.styles.insertRule(rule, t.styles.cssRules.length);
    }
    /**
     * @param {!number} startOffset
     * @param {!number=} selectionLength
     */
    function setCursorPosition(startOffset, selectionLength) {
        var stepsToStartOffset;
        stepsToStartOffset = t.counter.countForwardSteps(startOffset, t.filter);
        t.cursor.move(stepsToStartOffset, false);
        if (selectionLength) {
            t.cursor.move(selectionLength, true);
        } else {
            // workaround for SelectionMover cachedXOffset "feature"
            // Failure to do this will leave SelectionMover incorrectly assuming countLineSteps wants to get
            // to left = 8px due to the fact setCursorPosition moved over multiple lines in a single command
            t.cursor.move(0, false);
        }
    }

    /**
     * Test cursor iteration over a document fragment. Each supported cursor position should be indicated in
     * the fragment using the pipe character ('|'). This exercises both forwards and backwards iteration.
     * @param {!string} documentString Document fragment with cursor positions indicated using a vertical pipe '|'
     */
    function testCursorPositions(documentString) {
        var segments = documentString.split("|"),
            serializer = new xmldom.LSSerializer(),
            cursorSerialized = '<ns0:cursor xmlns:ns0="urn:webodf:names:cursor" ns0:memberId="Joe"></ns0:cursor>',
            position;
        runtime.log("Scenario: " + documentString);
        t.segmentCount = segments.length;
        r.shouldBe(t, "t.segmentCount > 1", "true");
        createOdtDocument(segments.join(""));
        setCursorPosition(0);

        // Test iteration forward
        for (position = 1; position < segments.length; position += 1) {
            t.expected = "<office:text>" +
                segments.slice(0, position).join("") + "|" + segments.slice(position, segments.length).join("") +
                "</office:text>";
            t.result = serializer.writeToString(t.root.firstChild, odf.Namespaces.namespaceMap);
            t.result = t.result.replace(cursorSerialized, "|");
            r.shouldBe(t, "t.result", "t.expected");
            t.stepsToNextPosition = t.counter.countForwardSteps(1, t.filter);
            t.cursor.move(t.stepsToNextPosition, false);
        }
        // Ensure there are no other walkable positions in the document
        r.shouldBe(t, "t.stepsToNextPosition", "0");

        // Test iteration backward
        for (position = segments.length - 1; position > 0; position -= 1) {
            t.expected = "<office:text>" +
                segments.slice(0, position).join("") + "|" + segments.slice(position, segments.length).join("") +
                "</office:text>";
            t.result = serializer.writeToString(t.root.firstChild, odf.Namespaces.namespaceMap);
            t.result = t.result.replace(cursorSerialized, "|");
            r.shouldBe(t, "t.result", "t.expected");
            t.stepsToNextPosition = t.counter.countBackwardSteps(1, t.filter);
            t.cursor.move(-t.stepsToNextPosition, false);
        }
        // Ensure there are no other walkable positions in the document
        r.shouldBe(t, "t.stepsToNextPosition", "0");
    }
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
    function testcountStepsToPosition_CursorNearBeginningOfSpan() {
        var span;
        createOdtDocument("<text:p>A<text:span>BCD</text:span></text:p>");
        span = t.root.getElementsByTagNameNS(odf.Namespaces.textns, "span")[0];
        setCursorPosition(2);
        t.steps = t.counter.countStepsToPosition(span, 0, t.filter);
        r.shouldBe(t, "t.steps", "-1");
    }
    function testcountStepsToPosition_CursorNearEndOfSpan() {
        var span;
        createOdtDocument("<text:p>A<text:span>BCD</text:span></text:p>");
        span = t.root.getElementsByTagNameNS(odf.Namespaces.textns, "span")[0];
        setCursorPosition(3);
        t.steps = t.counter.countStepsToPosition(span, span.childNodes.length, t.filter);
        r.shouldBe(t, "t.steps", "1");
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

        t.isWalkable = t.counter.isPositionWalkable(t.filter);
        t.stepsToAnchor = t.counter.countStepsToPosition(t.cursor.getAnchorNode(), 0, t.filter);
        t.stepsToRoot = t.counter.countStepsToPosition(t.root, 0, t.filter);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.stepsToAnchor", "-2");
        r.shouldBe(t, "t.stepsToRoot", "-3");
    }
    function testFixCursorPositions_Range_CursorInInvalidPlace() {
        createOdtDocument("<text:p>ABCD</text:p>");
        setCursorPosition(1, 2);
        wrapInDiv(t.cursor.getNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = t.counter.isPositionWalkable(t.filter);
        t.stepsToAnchor = t.counter.countStepsToPosition(t.cursor.getAnchorNode(), 0, t.filter);
        t.stepsToRoot = t.counter.countStepsToPosition(t.root, 0, t.filter);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.stepsToAnchor", "-2");
        r.shouldBe(t, "t.stepsToRoot", "-3");
    }
    function testFixCursorPositions_Range_AnchorAndCursorInInvalidPlace() {
        createOdtDocument("<text:p>ABCD</text:p>");
        setCursorPosition(1, 2);
        wrapInDiv(t.cursor.getNode());
        wrapInDiv(t.cursor.getAnchorNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = t.counter.isPositionWalkable(t.filter);
        t.stepsToAnchor = t.counter.countStepsToPosition(t.cursor.getAnchorNode(), 0, t.filter);
        t.stepsToRoot = t.counter.countStepsToPosition(t.root, 0, t.filter);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.stepsToAnchor", "-2");
        r.shouldBe(t, "t.stepsToRoot", "-3");
    }
    function testFixCursorPositions_Collapsed_CursorInInvalidPlace() {
        createOdtDocument("<text:p>ABCD</text:p>");
        setCursorPosition(1);
        wrapInDiv(t.cursor.getNode());

        t.odtDocument.fixCursorPositions();

        t.isWalkable = t.counter.isPositionWalkable(t.filter);
        t.stepsToRoot = t.counter.countStepsToPosition(t.root, 0, t.filter);
        r.shouldBe(t, "t.isWalkable", "true");
        r.shouldBe(t, "t.stepsToRoot", "-1");
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
        // TODO behaviour is different from README_cursorpositions
        // cursorPositionsTest("<text:p> <text:span>|A| |</text:span> <text:s></text:s>| <text:span><text:s> </text:s>|B|</text:span> </text:p>");
    }
    function testAvailablePositions_Annotations() {
        testCursorPositions('<text:p>|a|b|<office:annotation><text:list><text:list-item><text:p>|</text:p></text:list-item></text:list></office:annotation>c|d|<office:annotation-end></office:annotation-end>1|2|</text:p>');
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
        return [
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

            testcountStepsToPosition_CursorNearBeginningOfSpan,
            testcountStepsToPosition_CursorNearEndOfSpan,

            testFixCursorPositions_AnchorInInvalidPlace,
            testFixCursorPositions_Range_CursorInInvalidPlace,
            testFixCursorPositions_Range_AnchorAndCursorInInvalidPlace,
            testFixCursorPositions_Collapsed_CursorInInvalidPlace,

            testAvailablePositions_EmptyParagraph,
            testAvailablePositions_SimpleTextNodes,
            testAvailablePositions_MixedSpans,
            testAvailablePositions_Whitespace,
            testAvailablePositions_SpaceElements,
            testAvailablePositions_Annotations
        ];
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
