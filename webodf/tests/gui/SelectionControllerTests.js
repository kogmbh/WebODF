/**
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
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
gui.SelectionControllerTests = function SelectionControllerTests(runner) {
    "use strict";
    var r = runner,
        t,
        testarea,
        textns = odf.Namespaces.textns,
        officens = odf.Namespaces.officens,
        domUtils = core.DomUtils,
        inputMemberId = "Joe";

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
        this.getElement = function () { return node; };
        this.rootElement = node;
    }

    /**
     * @param {!ops.OdtDocument} odtDocument
     * @extends {ops.Session} Don't mind me... I'm just lying to closure compiler again!
     * @constructor
     */
    function MockSession(odtDocument) {
        var self = this;
        this.operations = [];

        this.getOdtDocument = function() {
            return odtDocument;
        };

        this.enqueue = function(ops) {
            self.operations.push.apply(self.operations, ops);
            ops.forEach(function(op) { op.execute(odtDocument); });
        };

        this.reset = function() {
            self.operations.length = 0;
        };
    }

    /**
     * Create a new ODT document with the specified text body
     * @param {!string} xml
     * @return {!Element} Root document node
     */
    function createOdtDocument(xml) {
        var domDocument = testarea.ownerDocument,
            doc = core.UnitTest.createOdtDocument("<office:text>" + xml + "</office:text>", odf.Namespaces.namespaceMap),
            node = /**@type{!Element}*/(domDocument.importNode(doc.documentElement, true));

        testarea.appendChild(node);

        t.root = node;
        t.odtDocument = new ops.OdtDocument(new MockOdfCanvas(node));
        t.session = new MockSession(t.odtDocument);
        t.selectionController = new gui.SelectionController(t.session, inputMemberId);
        t.selectionToRange = t.selectionController.selectionToRange;
        t.rangeToSelection = t.selectionController.rangeToSelection;
        t.cursor = new ops.OdtCursor(inputMemberId, t.odtDocument);
        t.odtDocument.addCursor(t.cursor);
        return node;
    }

    /**
     * @param {!number} stepsToAnchor Number of steps to advance the cursor
     * @param {!number=} stepsDiffToFocus
     * @return {undefined}
     */
    function setCursorPosition(stepsToAnchor, stepsDiffToFocus) {
        var newRangeSelection = t.odtDocument.convertCursorToDomRange(stepsToAnchor, stepsDiffToFocus);
        t.cursor.setSelectedRange(newRangeSelection, stepsDiffToFocus >= 0);
    }

    /**
     * Gets the position of the local cursor in cursor steps
     * @return {!{position: !number, length: number}}
     */
    function getCursorPosition() {
        var selection = t.rangeToSelection(t.cursor.getSelectedRange(), t.cursor.hasForwardSelection());
        return t.odtDocument.convertDomToCursorRange(selection);
    }

    /**
     * Find and return an array of numbers indicating each move cursor operation's position as it
     * iterates over the document content.
     * @param {!string} docContent Odt content
     * @param {!number} direction if negative, iterate from right to left over the document instead of left to right
     * @return {!Array.<!number>} valid cursor positions within the specified doc content
     */
    function getMovementByWordsPositions(docContent, direction) {
        var bounds = [],
            loopGuard = new core.LoopWatchDog(100000, 100), // Don't care really how long this takes
            lastSpec,
            generatedOps = false;

        createOdtDocument(docContent);
        if(direction < 0) {
            t.selectionController.moveCursorToDocumentEnd();
        }
        t.session.reset();
        do {
            loopGuard.check();
            if(direction < 0) {
                t.selectionController.moveCursorBeforeWord();
            } else {
                t.selectionController.moveCursorPastWord();
            }
            generatedOps = t.session.operations.length > 0;
            if (generatedOps) {
                // Only ever expect a single operation to be queued here
                lastSpec = t.session.operations[0].spec();
                bounds.push(lastSpec.position);
                t.session.reset();
            }
        } while(generatedOps);

        return bounds;
    }

    function moveCursorPastWord_SimpleText() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the quick red fox</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 10, 14, 17]");
    }

    function moveCursorBeforeWord_SimpleText() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the quick red fox</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[14, 10, 4, 0]");
    }

    function moveCursorPastWord_SimpleText_Punctuation() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the quick, re,d fox.</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 9, 11, 13, 14, 16, 19, 20]");
    }

    function moveCursorBeforeWord_SimpleText_Punctuation() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the quick, re,d fox.</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[19, 16, 14, 13, 11, 9, 4, 0]");
    }

    function moveCursorPastWord_SimpleText_NonLatin() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the tes阿t rèd fox.</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 10, 14, 17, 18]");
    }

    function moveCursorBeforeWord_SimpleText_NonLatin() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the tes阿t rèd fox.</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[17, 14, 10, 4, 0]");
    }

    function moveCursorPastWord_TextSplitBySpans() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the q<text:span>uick</text:span> red fox</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 10, 14, 17]");
    }

    function moveCursorBeforeWord_TextSplitBySpans() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the q<text:span>uick</text:span> red fox</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[14, 10, 4, 0]");
    }

    function moveCursorPastWord_TextWithinSpan() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:span>quick</text:span> <text:span>red.</text:span> fox</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 10, 13, 15, 18]");
    }

    function moveCursorBeforeWord_TextWithinSpan() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:span>quick</text:span> <text:span>red.</text:span> fox</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[15, 13, 10, 4, 0]");
    }

    function moveCursorPastWord_TextWithinSpan_2() {
        t.movementPositions = getMovementByWordsPositions("<text:p><text:span>the quick</text:span> red fox</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 10, 14, 17]");
    }

    function moveCursorBeforeWord_TextWithinSpan_2() {
        t.movementPositions = getMovementByWordsPositions("<text:p><text:span>the quick</text:span> red fox</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[14, 10, 4, 0]");
    }

    function moveCursorPastWord_TextWithinSpan_3() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:span>quick,</text:span> <text:span>re,</text:span>d fox.</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 9, 11, 13, 14, 16, 19, 20]");
    }

    function moveCursorBeforeWord_TextWithinSpan_3() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:span>quick,</text:span> <text:span>re,</text:span>d fox.</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[19, 16, 14, 13, 11, 9, 4, 0]");
    }

    function moveCursorPastWord_WordStartsNextToSpan() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:span>quick </text:span>red fox</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 10, 14, 17]");
    }

    function moveCursorBeforeWord_WordStartsNextToSpan() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:span>quick </text:span>red fox</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[14, 10, 4, 0]");
    }

    function moveCursorPastWord_TextSplitByLink() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the q<text:a>uick</text:a> red fox</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 10, 14, 17]");
    }

    function moveCursorBeforeWord_TextSplitByLink() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the q<text:a>uick</text:a> red fox</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[14, 10, 4, 0]");
    }

    function moveCursorPastWord_TextWithinLink() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:a>quick</text:a> red fox</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 10, 14, 17]");
    }

    function moveCursorBeforeWord_TextWithinLink() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:a>quick</text:a> red fox</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[14, 10, 4, 0]");
    }

    function moveCursorPastWord_TextWithinLinkAndSpan() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:a>q</text:a><text:a><text:span>u</text:span></text:a>ick red fox</text:p>", 1);
        r.shouldBe(t, "t.movementPositions", "[4, 10, 14, 17]");
    }

    function moveCursorBeforeWord_TextWithinLinkAndSpan() {
        t.movementPositions = getMovementByWordsPositions("<text:p>the <text:a>q</text:a><text:a><text:span>u</text:span></text:a>ick red fox</text:p>", -1);
        r.shouldBe(t, "t.movementPositions", "[14, 10, 4, 0]");
    }

    function extendCursorBeforeWord_IsWithinWord() {
        var doc = createOdtDocument("<text:p>one two three</text:p>"),
            p = doc.getElementsByTagNameNS(textns, "p")[0],
            text = p.childNodes[1],
            selection = t.selectionToRange({
                anchorNode: text,
                anchorOffset: 5,
                focusNode: text,
                focusOffset: 5
            });
        t.selectionController.selectRange(selection.range, selection.hasForwardSelection);

        t.selectionController.extendSelectionBeforeWord();

        t.cursorPosition = getCursorPosition();
        r.shouldBe(t, "t.cursorPosition.position", "5");
        r.shouldBe(t, "t.cursorPosition.length", "-1");
    }

    function extendCursorPastWord_IsWithinWord() {
        var doc = createOdtDocument("<text:p>one two three</text:p>"),
            p = doc.getElementsByTagNameNS(textns, "p")[0],
            text = p.childNodes[1],
            selection = t.selectionToRange({
                anchorNode: text,
                anchorOffset: 5,
                focusNode: text,
                focusOffset: 5
            });
        t.selectionController.selectRange(selection.range, selection.hasForwardSelection);

        t.selectionController.extendSelectionPastWord();

        t.cursorPosition = getCursorPosition();
        r.shouldBe(t, "t.cursorPosition.position", "5");
        r.shouldBe(t, "t.cursorPosition.length", "3");
    }

    function moveCursorToDocumentEnd_Simple() {
        t.position = undefined;
        createOdtDocument("<text:p>the <text:a>q</text:a><text:a><text:span>u</text:span></text:a>ick red fox</text:p>");

        t.selectionController.moveCursorToDocumentEnd();

        if(t.session.operations.length > 0) {
            t.position = t.session.operations[0].spec().position;
        }
        r.shouldBe(t, "t.position", "17");
    }

    function moveCursorToDocumentEnd_EndsBeforeAnnotation() {
        t.position = undefined;
        createOdtDocument("<text:p>the quick red fox<office:annotation><text:p>an</text:p></office:annotation></text:p>");

        t.selectionController.moveCursorToDocumentEnd();

        if(t.session.operations.length > 0) {
            t.position = t.session.operations[0].spec().position;
        }
        r.shouldBe(t, "t.position", "21");
    }

    function moveSelectionToParagraphEnd_OverAnnotation() {
        var lastPosition,
            loopGuard = new core.LoopWatchDog(100000, 100); // Don't care really how long this takes
        t.movementPositions = [];
        createOdtDocument("<text:p>ab<office:annotation><text:p>an</text:p></office:annotation></text:p>"
                            + "<text:p>cde</text:p>"
                            + "<text:p><text:span>fgh</text:span></text:p>");

        do {
            loopGuard.check();
            lastPosition = getCursorPosition().position;
            t.movementPositions.push(lastPosition);
            t.selectionController.moveCursorToParagraphEnd();
        } while (lastPosition !== getCursorPosition().position);

        r.shouldBe(t, "t.movementPositions", "[0, 6, 10, 14]");
    }

    function moveSelectionToParagraphStart_OverAnnotation() {
        var lastPosition,
            loopGuard = new core.LoopWatchDog(100000, 100); // Don't care really how long this takes
        t.movementPositions = [];
        createOdtDocument("<text:p><office:annotation><text:p>an</text:p></office:annotation>ab</text:p>"
            + "<text:p>cde</text:p>"
            + "<text:p><text:span>fgh</text:span></text:p>");
        t.selectionController.moveCursorToDocumentEnd();

        do {
            loopGuard.check();
            lastPosition = getCursorPosition().position;
            t.movementPositions.push(lastPosition);
            t.selectionController.moveCursorToParagraphStart();
        } while (lastPosition !== getCursorPosition().position);

        r.shouldBe(t, "t.movementPositions", "[14, 11, 7, 0]");
    }

    function selectRange_BridgesMultipleRoots_IsConstrainedWithinAnchorRoot() {
        var doc = createOdtDocument("<text:p><office:annotation><text:p>an</text:p></office:annotation>ab</text:p>"),
            range = testarea.ownerDocument.createRange();

        range.setStart(doc.getElementsByTagNameNS(officens, "annotation")[0], 0);
        range.setEnd(doc, doc.childNodes.length);

        t.selectionController.selectRange(range, true);

        t.position = getCursorPosition();
        r.shouldBe(t, "t.position.position", "1");
        r.shouldBe(t, "t.position.length", "2");
    }

    function selectRange_BridgesMultipleRoots_IsConstrainedWithinAnchorRoot_Reverse() {
        var doc = createOdtDocument("<text:p>ab<office:annotation><text:p>an</text:p></office:annotation></text:p>"),
            range = testarea.ownerDocument.createRange();

        range.setStart(doc, 0);
        range.setEnd(doc.getElementsByTagNameNS(officens, "annotation")[0], 1);

        t.selectionController.selectRange(range, false);

        t.position = getCursorPosition();
        r.shouldBe(t, "t.position.position", "5");
        r.shouldBe(t, "t.position.length", "-2");
    }

    function selectRange_SelectionOutsideRoot_ContainsToDocumentRoot() {
        var doc = createOdtDocument("<text:p>ab</text:p>"),
            range = testarea.ownerDocument.createRange();

        range.setStart(doc, 0);
        range.setEnd(doc, doc.childNodes.length);

        t.selectionController.selectRange(range, true);

        t.position = getCursorPosition();
        r.shouldBe(t, "t.position.position", "0");
        r.shouldBe(t, "t.position.length", "2");
    }

    function expandToWordBoundaries_CollapsedInWord() {
        var doc = createOdtDocument("<text:p>one two three</text:p>"),
            p = doc.getElementsByTagNameNS(textns, "p")[0],
            text = p.childNodes[1];

        t.selection = t.selectionToRange({
            anchorNode: text,
            anchorOffset: 5,
            focusNode: text,
            focusOffset: 5
        });

        t.selectionController.expandToWordBoundaries(t.selection.range);

        t.text = text;
        r.shouldBe(t, "t.selection.range.startContainer", "t.text");
        r.shouldBe(t, "t.selection.range.startOffset", "4");
        r.shouldBe(t, "t.selection.range.endContainer", "t.text");
        r.shouldBe(t, "t.selection.range.endOffset", "7");
    }

    function expandToWordBoundaries_CollasedAtWordStart() {
        var doc = createOdtDocument("<text:p>one two three</text:p>"),
            p = doc.getElementsByTagNameNS(textns, "p")[0],
            text = p.childNodes[1];

        t.selection = t.selectionToRange({
            anchorNode: text,
            anchorOffset: 4,
            focusNode: text,
            focusOffset: 4
        });

        t.selectionController.expandToWordBoundaries(t.selection.range);

        t.text = text;
        r.shouldBe(t, "t.selection.range.startContainer", "t.text");
        r.shouldBe(t, "t.selection.range.startOffset", "4");
        r.shouldBe(t, "t.selection.range.endContainer", "t.text");
        r.shouldBe(t, "t.selection.range.endOffset", "7");
    }

    function expandToWordBoundaries_CollasedAtWordEnd() {
        var doc = createOdtDocument("<text:p>one two three</text:p>"),
            p = doc.getElementsByTagNameNS(textns, "p")[0],
            text = p.childNodes[1];

        t.selection = t.selectionToRange({
            anchorNode: text,
            anchorOffset: 7,
            focusNode: text,
            focusOffset: 7
        });

        t.selectionController.expandToWordBoundaries(t.selection.range);

        t.text = text;
        r.shouldBe(t, "t.selection.range.startContainer", "t.text");
        r.shouldBe(t, "t.selection.range.startOffset", "4");
        r.shouldBe(t, "t.selection.range.endContainer", "t.text");
        r.shouldBe(t, "t.selection.range.endOffset", "7");
    }

    function expandToWordBoundaries_AlreadyAtWordBoundaries() {
        var doc = createOdtDocument("<text:p>one two three</text:p>"),
            p = doc.getElementsByTagNameNS(textns, "p")[0],
            text = p.childNodes[1];

        t.selection = t.selectionToRange({
            anchorNode: text,
            anchorOffset: 4,
            focusNode: text,
            focusOffset: 7
        });

        t.selectionController.expandToWordBoundaries(t.selection.range);

        t.text = text;
        r.shouldBe(t, "t.selection.range.startContainer", "t.text");
        r.shouldBe(t, "t.selection.range.startOffset", "4");
        r.shouldBe(t, "t.selection.range.endContainer", "t.text");
        r.shouldBe(t, "t.selection.range.endOffset", "7");
    }

    function expandToWordBoundaries_RangeInDifferentRootToCursor() {
        var doc = createOdtDocument("<text:p>one two three<office:annotation><text:p>four five</text:p></office:annotation></text:p>"),
            p = doc.getElementsByTagNameNS(textns, "p")[1],
            text = p.childNodes[0];

        t.selection = t.selectionToRange({
            anchorNode: text,
            anchorOffset: 0,
            focusNode: text,
            focusOffset: 1
        });

        t.selectionController.expandToWordBoundaries(t.selection.range);

        t.text = text;
        r.shouldBe(t, "t.selection.range.startContainer", "t.text");
        r.shouldBe(t, "t.selection.range.startOffset", "0");
        r.shouldBe(t, "t.selection.range.endContainer", "t.text");
        r.shouldBe(t, "t.selection.range.endOffset", "4");
    }

    function testCountStepsToLineBoundary_Forward_FromParagraphStart() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(0);
        
        t.selectionController.moveCursorToLineEnd();
        
        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "4");
    }
    function testCountStepsToLineBoundary_Forward_StartingAtSpace() {
        createOdtDocument("<text:p> BCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(0);

        t.selectionController.moveCursorToLineEnd();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "3");
    }
    function testCountStepsToLineBoundary_Forward_EndingAtSpace() {
        createOdtDocument("<text:p>ABC </text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(0);

        t.selectionController.moveCursorToLineEnd();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "3");
    }
    function testCountStepsToLineBoundary_Forward_OverWrapping() {
        // Width calculated to wrap at first space
        createOdtDocument("<text:p paragraph-width='3'>ABC DEF</text:p>");
        setCursorPosition(0);

        t.selectionController.moveCursorToLineEnd();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "3");
    }
    function testCountStepsToLineBoundary_Forward_NonTextWrapPoint() {
        // spans actually display as blocks to force the browser to put each text block on it's own line
        createOdtDocument("<text:p>ABC<text:span display='block'>DEF</text:span></text:p>");
        setCursorPosition(0);

        t.selectionController.moveCursorToLineEnd();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "3");
    }
    function testCountStepsToLineBoundary_Forward_NonWhitespaceWrap_Instability() {
        // NOTE: This test is here to show the instability of the line detection at the end of
        // a non-whitespace wrapped line. The behaviour is not particularly desirable, but there
        // is no easy fix for this available.

        // spans actually display as blocks to force the browser to put each text block on it's own line
        createOdtDocument("<text:p>ABC<text:span display='block'>DEF</text:span></text:p>");
        setCursorPosition(0);

        t.selectionController.moveCursorToLineEnd();
        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "3");

        t.selectionController.moveCursorToLineEnd();
        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "4");

        t.selectionController.moveCursorToLineEnd();
        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "6");
    }
    function testCountStepsToLineBoundary_Backward_FromParagraphStart() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(0);

        t.selectionController.moveCursorToLineStart();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "0");
    }
    function testCountStepsToLineBoundary_Backward_EndingAtWhiteSpace() {
        createOdtDocument("<text:p> BCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(3);

        t.selectionController.moveCursorToLineStart();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "0");
    }
    function testCountStepsToLineBoundary_Backward_FromParagraphEnd() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        setCursorPosition(4);

        t.selectionController.moveCursorToLineStart();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "0");
    }
    function testCountStepsToLineBoundary_Backward_OverWhiteSpace() {
        createOdtDocument("<text:p>A <text:span> BC</text:span>D</text:p>");
        setCursorPosition(5);

        t.selectionController.moveCursorToLineStart();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "0");
    }
    function testCountStepsToLineBoundary_Backward_OverWhiteSpaceOnlyNode() {
        createOdtDocument("<text:p>A <text:span>   </text:span>D</text:p>");
        setCursorPosition(3);

        t.selectionController.moveCursorToLineStart();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "0");
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

        t.selectionController.moveCursorToLineStart();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "0");
    }
    function testCountStepsToLineBoundary_Backward_OverWrapping() {
        // Width calculated to wrap at first space
        createOdtDocument("<text:p paragraph-width='3'>ABC DEF</text:p>");
        setCursorPosition(6);

        t.selectionController.moveCursorToLineStart();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "4");
    }
    function testCountStepsToLineBoundary_Backward_OverWrapping2() {
        // Width calculated to wrap at first space
        createOdtDocument("<text:p paragraph-width='2.7'>ABC D <text:span>E</text:span>F</text:p>");
        setCursorPosition(8);

        t.selectionController.moveCursorToLineStart();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "4");
    }

    function testCountStepsToLineBoundary_Backward_NonTextWrapPoint() {
        // spans actually display as blocks to force the browser to put each text block on it's own line
        createOdtDocument("<text:p>ABC<text:span display='block'>DEF</text:span></text:p>");
        setCursorPosition(6);

        t.selectionController.moveCursorToLineStart();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "3");
    }

    function testCountStepsToLineBoundary_Backward_NonWhitespaceWrap_Instability() {
        // NOTE: This test is here to show the instability of the line detection at the end of
        // a non-whitespace wrapped line. The behaviour is not particularly desirable, but there
        // is no easy fix for this available.

        // spans actually display as blocks to force the browser to put each text block on it's own line
        createOdtDocument("<text:p>ABC<text:span display='block'>DEF</text:span></text:p>");
        setCursorPosition(6);

        t.selectionController.moveCursorToLineStart();
        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "3");

        t.selectionController.moveCursorToLineStart();
        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "2");

        t.selectionController.moveCursorToLineStart();
        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "0");
    }

    /**
     * Attempts to return the X-offset of the cursor from the previous sibling's right side,
     * or if there is no previous sibling, the next siblings left side;
     * @return {!number}
     */
    function simpleCaretLocator() {
        var cursorNode = t.cursor.getNode();
        if (cursorNode.previousSibling) {
            return domUtils.getBoundingClientRect(t.cursor.getNode().previousSibling).right;
        }
        return domUtils.getBoundingClientRect(t.cursor.getNode().nextSibling).left;
    }

    function testCountLinesStepsDown_FromParagraphStart() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        t.selectionController.setCaretXPositionLocator(simpleCaretLocator);
        setCursorPosition(0);

        t.selectionController.moveCursorDown();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "5");
    }
    function testCountLinesStepsDown_FromParagraphEnd() {
        createOdtDocument("<text:p>ABCDE</text:p><text:p>FGHIJ</text:p>");
        t.selectionController.setCaretXPositionLocator(simpleCaretLocator);
        setCursorPosition(4);

        t.selectionController.moveCursorDown();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "10");
    }
    function testCountLinesStepsDown_FromJaggedParagraphEnd() {
        createOdtDocument("<text:p>ABCDE1</text:p><text:p>FGHIJ</text:p>");
        t.selectionController.setCaretXPositionLocator(simpleCaretLocator);
        setCursorPosition(6);

        t.selectionController.moveCursorDown();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "12");
    }
    function testCountLinesStepsDown_OverWrap() {
        createOdtDocument("<text:p paragraph-width='4'>ABCDE FGHIJ</text:p>");
        t.selectionController.setCaretXPositionLocator(simpleCaretLocator);
        setCursorPosition(4);

        t.selectionController.moveCursorDown();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "10");
    }
    function testCountLinesStepsUp_FromParagraphStart() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        t.selectionController.setCaretXPositionLocator(simpleCaretLocator);
        setCursorPosition(5);

        t.selectionController.moveCursorUp();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "0");
    }
    function testCountLinesStepsUp_FromParagraphEnd() {
        createOdtDocument("<text:p>ABCD</text:p><text:p>FGHIJ</text:p>");
        t.selectionController.setCaretXPositionLocator(simpleCaretLocator);
        setCursorPosition(10);

        t.selectionController.moveCursorUp();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "4");
    }
    function testCountLinesStepsUp_FromJaggedParagraphEnd() {
        createOdtDocument("<text:p>ABCDE1</text:p><text:p>FGHIJ</text:p>");
        t.selectionController.setCaretXPositionLocator(simpleCaretLocator);
        setCursorPosition(11);

        t.selectionController.moveCursorUp();

        t.newPosition = getCursorPosition().position;
        r.shouldBe(t, "t.newPosition", "4");
    }

    this.setUp = function () {
        var doc, stylesElement;
        testarea = core.UnitTest.provideTestAreaDiv();
        doc = testarea.ownerDocument;
        stylesElement = doc.createElement("style");
        stylesElement.setAttribute("type", "text/css");
        stylesElement.appendChild(doc.createTextNode("@namespace text url(urn:oasis:names:tc:opendocument:xmlns:text:1.0);\n"));
        stylesElement.appendChild(doc.createTextNode("@namespace cursor url(urn:webodf:names:cursor);\n"));
        stylesElement.appendChild(doc.createTextNode("cursor|anchor { display: none; }\n"));
        stylesElement.appendChild(doc.createTextNode("cursor|cursor { display: none; }\n"));
        // Make text:p behave as normal paragraphs
        // Ensure font chars are always monospaced so widths are consistent between platforms
        stylesElement.appendChild(doc.createTextNode("text|p { display: block; font-family: monospace; }\n"));
        stylesElement.appendChild(doc.createTextNode("text|p[paragraph-width='2.7'] { width: 2.7em; }\n"));
        stylesElement.appendChild(doc.createTextNode("text|p[paragraph-width='3'] { width: 3em; }\n"));
        stylesElement.appendChild(doc.createTextNode("text|p[paragraph-width='4'] { width: 4em; }\n"));
        stylesElement.appendChild(doc.createTextNode("text|span[display='block'] { display: block; }\n"));
        doc.getElementsByTagName("head")[0].appendChild(stylesElement);
        t = {
            doc: testarea.ownerDocument,
            stylesElement: stylesElement
        };
    };
    this.tearDown = function () {
        core.UnitTest.cleanupTestAreaDiv();
        t.stylesElement.parentNode.removeChild(t.stylesElement);
        t = {};
    };

    this.tests = function () {
        return r.name([
            moveCursorPastWord_SimpleText,
            moveCursorBeforeWord_SimpleText,
            moveCursorPastWord_SimpleText_Punctuation,
            moveCursorBeforeWord_SimpleText_Punctuation,
            moveCursorBeforeWord_SimpleText_NonLatin,
            moveCursorPastWord_SimpleText_NonLatin,

            moveCursorPastWord_TextSplitBySpans,
            moveCursorBeforeWord_TextSplitBySpans,
            moveCursorPastWord_TextWithinSpan,
            moveCursorBeforeWord_TextWithinSpan,
            moveCursorPastWord_TextWithinSpan_2,
            moveCursorBeforeWord_TextWithinSpan_2,
            moveCursorPastWord_TextWithinSpan_3,
            moveCursorBeforeWord_TextWithinSpan_3,
            moveCursorPastWord_WordStartsNextToSpan,
            moveCursorBeforeWord_WordStartsNextToSpan,

            moveCursorPastWord_TextSplitByLink,
            moveCursorBeforeWord_TextSplitByLink,
            moveCursorPastWord_TextWithinLink,
            moveCursorBeforeWord_TextWithinLink,
            moveCursorPastWord_TextWithinLinkAndSpan,
            moveCursorBeforeWord_TextWithinLinkAndSpan,

            extendCursorBeforeWord_IsWithinWord,
            extendCursorPastWord_IsWithinWord,

            moveCursorToDocumentEnd_Simple,
            moveCursorToDocumentEnd_EndsBeforeAnnotation,

            moveSelectionToParagraphEnd_OverAnnotation,
            moveSelectionToParagraphStart_OverAnnotation,

            selectRange_BridgesMultipleRoots_IsConstrainedWithinAnchorRoot,
            selectRange_BridgesMultipleRoots_IsConstrainedWithinAnchorRoot_Reverse,
            selectRange_SelectionOutsideRoot_ContainsToDocumentRoot,

            expandToWordBoundaries_CollapsedInWord,
            expandToWordBoundaries_CollasedAtWordStart,
            expandToWordBoundaries_CollasedAtWordEnd,
            expandToWordBoundaries_AlreadyAtWordBoundaries,
            expandToWordBoundaries_RangeInDifferentRootToCursor,

            testCountStepsToLineBoundary_Forward_FromParagraphStart,
            testCountStepsToLineBoundary_Forward_StartingAtSpace,
            testCountStepsToLineBoundary_Forward_EndingAtSpace,
            testCountStepsToLineBoundary_Forward_OverWrapping,
            testCountStepsToLineBoundary_Forward_NonTextWrapPoint,
            testCountStepsToLineBoundary_Forward_NonWhitespaceWrap_Instability,

            testCountStepsToLineBoundary_Backward_FromParagraphStart,
            testCountStepsToLineBoundary_Backward_EndingAtWhiteSpace,
            testCountStepsToLineBoundary_Backward_FromParagraphEnd,
            testCountStepsToLineBoundary_Backward_OverWhiteSpace,
            testCountStepsToLineBoundary_Backward_OverWhiteSpaceOnlyNode,
            testCountStepsToLineBoundary_Backward_OverEmptyTextNodes,
            testCountStepsToLineBoundary_Backward_OverWrapping,
            testCountStepsToLineBoundary_Backward_OverWrapping2,
            testCountStepsToLineBoundary_Backward_NonTextWrapPoint,
            testCountStepsToLineBoundary_Backward_NonWhitespaceWrap_Instability,

            testCountLinesStepsDown_FromParagraphStart,
            testCountLinesStepsDown_FromParagraphEnd,
            testCountLinesStepsDown_FromJaggedParagraphEnd,
            testCountLinesStepsDown_OverWrap,

            testCountLinesStepsUp_FromParagraphStart,
            testCountLinesStepsUp_FromParagraphEnd,
            testCountLinesStepsUp_FromJaggedParagraphEnd
        ]);
    };
    this.asyncTests = function () {
        return [
        ];
    };
};
gui.SelectionControllerTests.prototype.description = function () {
    "use strict";
    return "Test the SelectionController class.";
};
