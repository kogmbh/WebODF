/**
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
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
runtime.loadClass("xmldom.LSSerializer");
runtime.loadClass("odf.Namespaces");
runtime.loadClass("gui.SelectionController");
runtime.loadClass("ops.OdtDocument");
runtime.loadClass("ops.OdtCursor");
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

        t.odtDocument = new ops.OdtDocument(new MockOdfCanvas(node));
        t.session = new MockSession(t.odtDocument);
        t.selectionController = new gui.SelectionController(t.session, inputMemberId);
        t.cursor = new ops.OdtCursor(inputMemberId, t.odtDocument);
        t.odtDocument.addCursor(t.cursor);
        return node;
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

    function moveCursorToDocumentEnd_Simple() {
        t.position = undefined;
        createOdtDocument("<text:p>the <text:a>q</text:a><text:a><text:span>u</text:span></text:a>ick red fox</text:p>");

        t.selectionController.moveCursorToDocumentEnd();

        if(t.session.operations.length > 0) {
            t.position = t.session.operations[0].spec().position;
        }
        r.shouldBe(t, "t.position", "17");
    }

    this.setUp = function () {
        testarea = core.UnitTest.provideTestAreaDiv();
        t = { doc: testarea.ownerDocument };
    };
    this.tearDown = function () {
        core.UnitTest.cleanupTestAreaDiv();
        t = {};
    };

    this.tests = function () {
        return r.name([
            moveCursorPastWord_SimpleText,
            moveCursorBeforeWord_SimpleText,
            moveCursorPastWord_SimpleText_Punctuation,
            moveCursorBeforeWord_SimpleText_Punctuation,

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

            moveCursorToDocumentEnd_Simple
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
(function () {
    "use strict";
    return gui.SelectionControllerTests;
}());
