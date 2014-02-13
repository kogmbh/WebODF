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
/*global runtime, core, odf, ops, gui*/
/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
ops.StepsTranslatorTests = function StepsTranslatorTests(runner) {
    "use strict";
    var t,
        domUtils = new core.DomUtils(),
        textns = odf.Namespaces.textns,
        r = runner,
        testarea;

    function roundDown(step) {
        return step === ops.StepsTranslator.PREVIOUS_STEP;
    }

    function roundUp(step) {
        return step === ops.StepsTranslator.NEXT_STEP;
    }

    /**
     * @param {!core.PositionFilter} filter
     * @implements {core.PositionFilter}
     * @constructor
     */
    function CallCountedPositionFilter(filter) {
        var self = this;

        this.acceptPositionCalls = 0;

        this.acceptPosition = function() {
            self.acceptPositionCalls += 1;
            return filter.acceptPosition.apply(filter, arguments);
        };

        this.popCallCount = function() {
            var existingCount = self.acceptPositionCalls;
            self.acceptPositionCalls = 0;
            return existingCount;
        };
    }

    /**
     * @param {!Node} paragraphNode
     * @return {!{node: !Node, start: !number, length: !number}}
     */
    function createParagraphBoundary(paragraphNode) {
        var start = t.translator.convertDomPointToSteps(paragraphNode, 0, roundUp),
            end = t.translator.convertDomPointToSteps(paragraphNode, paragraphNode.childNodes.length);
        return {
            node: paragraphNode,
            start: start,
            length: end - start
        };
    }

    /**
     * @param {!HTMLElement} node
     * @return {!Array.<!{node: !Node, start: !number, length: !number}>}
     */
    function extractParagraphBoundaries(node) {
        return domUtils.getElementsByTagNameNS(node, textns, "p").map(createParagraphBoundary);
    }

    /**
     * Verify each expected boundary matches the current paragraph node boundary
     * @param {!Array.<!{node: !Node, start: !number, length: !number}>} expectedBoundaries
     * @param {?number=} cycleCount
     */
    function verifyParagraphBoundaries(expectedBoundaries, cycleCount) {
        expectedBoundaries.forEach(function(paragraph, index) {
            var cycleDescription = (cycleCount !== undefined ? "Cycle " + cycleCount + ": " : "" );
            runtime.log(cycleDescription + "comparing p[" + index + "]");
            t.paragraph = paragraph;
            t.paragraphStartPoint = t.translator.convertStepsToDomPoint(paragraph.start);
            r.shouldBe(t, "t.paragraphStartPoint.node", "t.paragraph.node.firstChild || t.paragraph.node");
            r.shouldBe(t, "t.paragraphStartPoint.offset", "0");

            t.paragraphStartStep = t.translator.convertDomPointToSteps(paragraph.node, 0, roundUp);
            r.shouldBe(t, "t.paragraphStartStep", "t.paragraph.start");

            t.paragraphEndPoint = t.translator.convertStepsToDomPoint(paragraph.start + paragraph.length);
            r.shouldBe(t, "t.paragraphEndPoint.node", "t.paragraph.node");
            r.shouldBe(t, "t.paragraphEndPoint.offset", "t.paragraph.node.childNodes.length");

            t.paragraphEndStep = t.translator.convertDomPointToSteps(paragraph.node, paragraph.node.childNodes.length);
            r.shouldBe(t, "t.paragraphEndStep", "t.paragraph.start + t.paragraph.length");
        });
    }

    function createDoc(xml) {
        var domDocument = testarea.ownerDocument,
            doc = core.UnitTest.createOdtDocument("<office:text>" + xml + "</office:text>", odf.Namespaces.namespaceMap),
            node = /**@type{!Element}*/(domDocument.importNode(doc.documentElement, true));

        testarea.appendChild(node);
        return node;
    }

    this.setUp = function () {
        testarea = core.UnitTest.provideTestAreaDiv();
        t = {
            filter: new CallCountedPositionFilter(new ops.TextPositionFilter(function() { return testarea; }))
        };
        t.translator = new ops.StepsTranslator(function() { return testarea; },
            gui.SelectionMover.createPositionIterator,
            t.filter, 5);
    };
    this.tearDown = function () {
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };

    function convertStepsToDomPoint_At0() {
        var doc = createDoc("<text:p>AB</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.expected = {node: p.firstChild, offset: 0};
        t.position = t.translator.convertStepsToDomPoint(0);
        r.shouldBe(t, "t.filter.acceptPositionCalls", "4");
        r.shouldBe(t, "t.position.node", "t.expected.node");
        r.shouldBe(t, "t.position.offset", "t.expected.offset");
    }

    function convertStepsToDomPoint_At1() {
        var doc = createDoc("<text:p>AB</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.expected = {node: p.firstChild, offset: 1};
        t.position = t.translator.convertStepsToDomPoint(1);
        r.shouldBe(t, "t.filter.acceptPositionCalls", "5");
        r.shouldBe(t, "t.position.node", "t.expected.node");
        r.shouldBe(t, "t.position.offset", "t.expected.offset");
    }

    function convertStepsToDomPoint_At5() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>EF</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[1];

        t.expected = {node: p.firstChild, offset: 0};
        t.position = t.translator.convertStepsToDomPoint(5);
        r.shouldBe(t, "t.filter.acceptPositionCalls", "10");
        r.shouldBe(t, "t.position.node", "t.expected.node");
        r.shouldBe(t, "t.position.offset", "t.expected.offset");
    }

    function convertStepsToDomPoint_LessThan0_ThrowsException() {
        createDoc("<text:p>AB</text:p>");

        try {
            t.translator.convertStepsToDomPoint(-1);
        } catch(e) {
            t.exceptionThrown = true;
        }
        r.shouldBe(t, "t.exceptionThrown", "true");
    }

    function convertStepsToDomPoint_BeyondMaxSteps_ThrowsException() {
        createDoc("<text:p>ABCD</text:p><text:p>EF</text:p>");

        try {
            t.translator.convertStepsToDomPoint(100);
        } catch(e) {
            t.exceptionThrown = true;
        }
        r.shouldBe(t, "t.exceptionThrown", "true");
    }

    function convertStepsToDomPoint_isNan_ThrowsException() {
        createDoc("<text:p>ABCD</text:p><text:p>EF</text:p>");

        try {
            t.translator.convertStepsToDomPoint(undefined);
        } catch(e) {
            t.exceptionThrown = true;
        }
        r.shouldBe(t, "t.exceptionThrown", "true");
    }

    function convertStepsToDomPoint_Prime_PrimesCache() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>EF</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[1];

        t.translator.prime();
        t.filter.popCallCount();
        t.expected = {node: p.firstChild, offset: 0};

        t.position = t.translator.convertStepsToDomPoint(5);
        t.cachedCallCount = t.filter.popCallCount();
        r.shouldBe(t, "t.cachedCallCount", "2");
        r.shouldBe(t, "t.position.node", "t.expected.node");
        r.shouldBe(t, "t.position.offset", "t.expected.offset");
    }

    function convertStepsToDomPoint_Cached_SpeedsUpSecondCall() {
        createDoc("<text:p>ABCD</text:p><text:p>EF</text:p>");

        t.expected = t.translator.convertStepsToDomPoint(5);
        t.uncachedCallCount = t.filter.popCallCount();
        t.position = t.translator.convertStepsToDomPoint(5);
        t.cachedCallCount = t.filter.popCallCount();
        r.shouldBe(t, "t.cachedCallCount < t.uncachedCallCount", "true");
        r.shouldBe(t, "t.cachedCallCount", "2");
        r.shouldBe(t, "t.position.node", "t.expected.node");
        r.shouldBe(t, "t.position.offset", "t.expected.offset");
    }

    function convertStepsToDomPoint_Cached_UsesClosestPointForCalculations() {
        createDoc("<text:p>A</text:p><text:p>BC</text:p><text:p>EF</text:p>");
        t.expected = t.translator.convertStepsToDomPoint(5);
        t.uncachedCallCount = t.filter.popCallCount();

        t.position = t.translator.convertStepsToDomPoint(5);
        t.cachedCallCount = t.filter.popCallCount();
        r.shouldBe(t, "t.cachedCallCount < t.uncachedCallCount", "true");
        r.shouldBe(t, "t.cachedCallCount", "2");
        r.shouldBe(t, "t.position.node", "t.expected.node");
        r.shouldBe(t, "t.position.offset", "t.expected.offset");
    }

    function convertStepsToDomPoint_Cached_HasContentBeforeWalkablePosition() {
        createDoc("<text:p>ABCD</text:p><text:p><text:span/>EF</text:p>");

        t.expected = t.translator.convertStepsToDomPoint(5);
        t.uncachedCallCount = t.filter.popCallCount();

        t.position = t.translator.convertStepsToDomPoint(5);
        t.cachedCallCount = t.filter.popCallCount();
        r.shouldBe(t, "t.cachedCallCount < t.uncachedCallCount", "true");
        r.shouldBe(t, "t.position.node", "t.expected.node");
        r.shouldBe(t, "t.position.offset", "t.expected.offset");
    }

    function convertStepsToDomPoint_Cached_ContentAddedBeforeWalkablePosition() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>EF</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[1];

        t.expected = t.translator.convertStepsToDomPoint(5);
        t.uncachedCallCount = t.filter.popCallCount();
        p.insertBefore(p.ownerDocument.createElement('span'), p.firstChild);

        t.position = t.translator.convertStepsToDomPoint(5);
        t.cachedCallCount = t.filter.popCallCount();
        r.shouldBe(t, "t.cachedCallCount < t.uncachedCallCount", "true");
        r.shouldBe(t, "t.position.node", "t.expected.node");
        r.shouldBe(t, "t.position.offset", "t.expected.offset");
    }

    function convertStepsToDomPoint_Cached_CopesWithClonedNode() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>EFGH</text:p>"),
            originalParagraph = createParagraphBoundary(doc.getElementsByTagNameNS(textns, "p")[1]),
            body = originalParagraph.node.parentNode,
            cloneParagraph = originalParagraph.node.cloneNode(true);

        t.cloneParagraph = cloneParagraph;
        t.originalParagraph = originalParagraph.node;
        t.translator.prime(); // Should already be primed, but just in case!

        body.insertBefore(cloneParagraph, originalParagraph.node);
        t.translator.handleStepsInserted({position: originalParagraph.start - 1, length: originalParagraph.length + 1});

        t.actualCloneDomPoint = t.translator.convertStepsToDomPoint(5); // First position in new p
        r.shouldBe(t, "t.actualCloneDomPoint.node", "t.cloneParagraph.firstChild");
        r.shouldBe(t, "t.actualCloneDomPoint.offset", "0");

        t.actualOriginalDomPoint = t.translator.convertStepsToDomPoint(10); // First position in original p
        r.shouldBe(t, "t.actualOriginalDomPoint.node", "t.originalParagraph.firstChild");
        r.shouldBe(t, "t.actualOriginalDomPoint.offset", "0");
    }

    function convertDomPointsToSteps_At0() {
        var doc = createDoc("<text:p>AB</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.steps = t.translator.convertDomPointToSteps(p.firstChild, 0);
        r.shouldBe(t, "t.filter.acceptPositionCalls", "4");
        r.shouldBe(t, "t.steps", "0");
    }

    function convertDomPointsToSteps_Before0() {
        var doc = createDoc("<text:p>AB</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.steps = t.translator.convertDomPointToSteps(p, 0);
        r.shouldBe(t, "t.filter.acceptPositionCalls", "4");
        r.shouldBe(t, "t.steps", "0");
    }

    function convertDomPointsToSteps_BeforeRootNode_Returns0() {
        createDoc("<text:p>AB</text:p>");

        t.steps = t.translator.convertDomPointToSteps(testarea.parentNode, 0);
        r.shouldBe(t, "t.steps", "0");
    }

    function convertDomPointsToSteps_AfterRootNode_ReturnsMaxLength() {
        var doc = createDoc("<text:p>AB</text:p>"),
            afterRoot = doc.ownerDocument.createElement("span");

        testarea.parentNode.insertBefore(afterRoot, testarea.nextSibling);
        t.steps = t.translator.convertDomPointToSteps(afterRoot, 0);
        r.shouldBe(t, "t.steps", "2");
    }

    function convertDomPointsToSteps_AfterRootNode_LastPositionInParent_ReturnsMaxLength() {
        createDoc("<text:p>AB</text:p>");

        t.steps = t.translator.convertDomPointToSteps(testarea.parentNode, testarea.parentNode.childNodes.length);
        r.shouldBe(t, "t.steps", "2");
    }

    function convertDomPointsToSteps_At1() {
        var doc = createDoc("<text:p>AB</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.steps = t.translator.convertDomPointToSteps(p.firstChild, 1);
        r.shouldBe(t, "t.filter.acceptPositionCalls", "5");
        r.shouldBe(t, "t.steps", "1");
    }

    function convertDomPointsToSteps_BetweenPositions_RoundsDown() {
        var doc = createDoc("<text:p>A<text:span/><text:span/>B</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.steps1 = t.translator.convertDomPointToSteps(p, 1);
        t.steps2 = t.translator.convertDomPointToSteps(p, 2);
        r.shouldBe(t, "t.steps1", "1");
        r.shouldBe(t, "t.steps2", "1");
    }

    function convertDomPointsToSteps_At5() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>EF</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[1];

        t.steps = t.translator.convertDomPointToSteps(p.firstChild, 0);
        r.shouldBe(t, "t.filter.acceptPositionCalls", "10");
        r.shouldBe(t, "t.steps", "5");
    }

    function convertDomPointsToSteps_WithinParagraph_BeforeFirstWalkablePosition_RoundsDown() {
        var doc = createDoc("<text:p>AB</text:p><text:p><text:span/>C</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[1];

        t.steps = t.translator.convertDomPointToSteps(p, 0);
        r.shouldBe(t, "t.filter.acceptPositionCalls", "8");
        r.shouldBe(t, "t.steps", "2");
    }

    function convertDomPointsToSteps_BeforeRootNode_RoundingCheck() {
        createDoc("<text:p>AB</text:p>");

        t.steps1 = t.translator.convertDomPointToSteps(testarea.parentNode, 0, roundDown);
        t.steps2 = t.translator.convertDomPointToSteps(testarea.parentNode, 0, roundUp);
        r.shouldBe(t, "t.steps1", "0");
        r.shouldBe(t, "t.steps2", "0");
    }

    function convertDomPointsToSteps_BetweenPositions_RoundingCheck() {
        var doc = createDoc("<text:p>A<text:span/><text:span/>B</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0];

        t.steps1 = t.translator.convertDomPointToSteps(p, 2, roundDown);
        t.steps2 = t.translator.convertDomPointToSteps(p, 2, roundUp);
        r.shouldBe(t, "t.steps1", "1");
        r.shouldBe(t, "t.steps2", "2");
    }

    function convertDomPointsToSteps_Cached_FirstPositionInParagraph_ConsistentWhenCached() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>C</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[1];

        t.steps = t.translator.convertDomPointToSteps(p, 0);
        t.stepsCached = t.translator.convertDomPointToSteps(p, 0);
        r.shouldBe(t, "t.steps", "5");
        r.shouldBe(t, "t.stepsCached", "5");
    }

    function convertDomPointsToSteps_Cached_SpeedsUpSecondCall() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>EF</text:p>"),
            p = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[1];

        t.expected = t.translator.convertDomPointToSteps(p.firstChild, 0);
        t.uncachedCallCount = t.filter.popCallCount();

        t.steps = t.translator.convertDomPointToSteps(p.firstChild, 0);
        t.cachedCallCount = t.filter.popCallCount();
        r.shouldBe(t, "t.cachedCallCount < t.uncachedCallCount", "true");
        r.shouldBe(t, "t.cachedCallCount", "2");
        r.shouldBe(t, "t.steps", "5");
    }

    function convertDomPointsToSteps_Cached_CopesWithClonedNode() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>EFGH</text:p>"),
            originalParagraph = createParagraphBoundary(doc.getElementsByTagNameNS(textns, "p")[1]),
            body = originalParagraph.node.parentNode,
            cloneParagraph;

        t.translator.prime(); // Should already be primed, but just in case!

        cloneParagraph = originalParagraph.node.cloneNode(true);
        body.insertBefore(cloneParagraph, originalParagraph.node);
        t.translator.handleStepsInserted({position: originalParagraph.start - 1, length: originalParagraph.length + 1});

        t.actualOriginalSteps = t.translator.convertDomPointToSteps(originalParagraph.node, 0, roundUp);
        r.shouldBe(t, "t.actualOriginalSteps", "10");
        t.actualCloneSteps = t.translator.convertDomPointToSteps(cloneParagraph, 0, roundUp);
        r.shouldBe(t, "t.actualCloneSteps", "5");
    }

    /**
     * See OpRemoveText. Paragraph merging behaviour may choose to remove the first paragraph
     * and directly place the second paragraph in this position. This results in a change
     * occurring at the step of modification (i.e., step 9's node changes, but it is still step 9)
     */
    function convertDomPointsToSteps_Cached_CopesWithBookmarkedNodeBeingRemoved() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>E</text:p><text:p/><text:p/>"),
            bookmarkedParagraph = createParagraphBoundary(doc.getElementsByTagNameNS(textns, "p")[1]),
            trailingParagraph = doc.getElementsByTagNameNS(textns, "p")[2],
            lastParagraph = doc.getElementsByTagNameNS(textns, "p")[3],
            body = bookmarkedParagraph.node.parentNode;

        t.translator.prime(); // Should already be primed, but just in case!

        body.removeChild(bookmarkedParagraph.node);
        t.translator.handleStepsRemoved({position: bookmarkedParagraph.start, length: 2});

        t.trailingParagraphSteps = t.translator.convertDomPointToSteps(trailingParagraph, 0);
        r.shouldBe(t, "t.trailingParagraphSteps", "5");
        t.lastParagraphSteps = t.translator.convertDomPointToSteps(lastParagraph, 0);
        r.shouldBe(t, "t.lastParagraphSteps", "6");
    }

    function convertDomPointsToSteps_Cached_FindsNearestKnownPosition() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>EFGH</text:p><text:custom/>"),
            frame = doc.getElementsByTagNameNS(textns, "custom")[0];

        t.translator.prime();
        t.filter.popCallCount();

        t.steps = t.translator.convertDomPointToSteps(frame, 0);
        r.shouldBe(t, "t.filter.acceptPositionCalls", "8");
        r.shouldBe(t, "t.steps", "9");
    }

    function handleStepsInserted_InsertMultipleStepsIndividually() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>E</text:p><text:p>IJKL</text:p>"),
            paragraphs = extractParagraphBoundaries(doc),
            step = 0;

        t.translator.prime();
        t.filter.popCallCount();

        while (paragraphs[1].length < 10) {
            paragraphs[1].node.firstChild.appendData("e");
            t.translator.handleStepsInserted({position: paragraphs[1].start + paragraphs[1].length, length: 1});
            paragraphs[1].length += 1;
            paragraphs[2].start += 1;
            verifyParagraphBoundaries(paragraphs, step);
            step += 1;
        }
    }

    function handleStepsInserted_InsertMultipleParagraphsIndividually() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>E</text:p><text:p>IJKL</text:p>"),
            dom = doc.ownerDocument,
            body,
            paragraphs = extractParagraphBoundaries(doc),
            step;

        body = paragraphs[0].node.parentNode;
        t.translator.prime();
        t.filter.popCallCount();

        for(step = 0; step < 10; step += 1) {
            body.insertBefore(dom.createElementNS(textns, "p"), paragraphs[2].node);
            t.translator.handleStepsInserted({position: paragraphs[2].start-1, length: 1});
            paragraphs[2].start += 1;
            verifyParagraphBoundaries(paragraphs, step);
        }
    }

    function handleStepsInserted_InsertParagraphAtDocumentEnd() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>E</text:p>"),
            dom = doc.ownerDocument,
            body,
            newParagraph,
            paragraphs = extractParagraphBoundaries(doc);

        body = paragraphs[0].node.parentNode;
        t.translator.prime();
        t.filter.popCallCount();
        newParagraph = dom.createElementNS(textns, "p");

        body.appendChild(newParagraph);
        t.translator.handleStepsInserted({position: paragraphs[1].start + paragraphs[1].length, length: 1});

        paragraphs.push({node: newParagraph, start: paragraphs[1].start + paragraphs[1].length + 1, length: 0});
        verifyParagraphBoundaries(paragraphs);
    }

    function handleStepsRemoved_RemoveMultipleStepsIndividually() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>Eeeeeeeeee</text:p><text:p>IJKL</text:p>"),
            paragraphs = extractParagraphBoundaries(doc),
            step = 0;

        t.translator.prime();
        t.filter.popCallCount();

        while (paragraphs[1].length > 0) {
            paragraphs[1].node.firstChild.deleteData(paragraphs[1].length - 1, 1);
            if (paragraphs[1].node.firstChild.length === 0) {
                paragraphs[1].node.removeChild(paragraphs[1].node.firstChild);
            }
            t.translator.handleStepsRemoved({position: paragraphs[1].start + paragraphs[1].length - 1, length: 1});
            paragraphs[1].length -= 1;
            paragraphs[2].start -= 1;
            verifyParagraphBoundaries(paragraphs, step);
            step += 1;
        }
    }

    function handleStepsRemoved_RemoveMultipleParagraphsIndividually() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>E</text:p><text:p>IJKL</text:p>"),
            dom = doc.ownerDocument,
            originalParagraphs = domUtils.getElementsByTagNameNS(doc, textns, "p"),
            insertionPoint = originalParagraphs[2],
            body,
            paragraphs,
            step;

        body = originalParagraphs[0].parentNode;
        for(step = 0; step < 10; step += 1) {
            body.insertBefore(dom.createElementNS(textns, "p"), insertionPoint);
        }
        paragraphs = originalParagraphs.map(createParagraphBoundary);
        t.translator.prime();
        t.filter.popCallCount();

        for(step = 0; step < 10; step += 1) {
            body.removeChild(insertionPoint.previousSibling);
            t.translator.handleStepsRemoved({position: paragraphs[2].start-1, length: 1});
            paragraphs[2].start -= 1;
            verifyParagraphBoundaries(paragraphs, step);
        }
    }

    function handleStepsRemoved_AtDocumentStart() {
        var doc = createDoc("<text:p>ABCD</text:p><text:p>EFG</text:p>"),
            removedParagraph = doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0],
            paragraphs = [];

        paragraphs.push(createParagraphBoundary(doc.getElementsByTagNameNS(odf.Namespaces.textns, "p")[1]));
        t.translator.prime();
        t.filter.popCallCount();

        removedParagraph.parentNode.removeChild(removedParagraph);
        paragraphs[0].node.firstChild.deleteData(0, 2);
        t.translator.handleStepsRemoved({position: 0, length: 7});
        paragraphs[0].start = 0;
        paragraphs[0].length = 1;

        verifyParagraphBoundaries(paragraphs);
    }

    this.tests = function () {
        return r.name([
            convertStepsToDomPoint_At0,
            convertStepsToDomPoint_At1,
            convertStepsToDomPoint_At5,
            convertStepsToDomPoint_LessThan0_ThrowsException,
            convertStepsToDomPoint_BeyondMaxSteps_ThrowsException,
            convertStepsToDomPoint_isNan_ThrowsException,
            convertStepsToDomPoint_Prime_PrimesCache,
            convertStepsToDomPoint_Cached_SpeedsUpSecondCall,
            convertStepsToDomPoint_Cached_UsesClosestPointForCalculations,
            convertStepsToDomPoint_Cached_HasContentBeforeWalkablePosition,
            convertStepsToDomPoint_Cached_ContentAddedBeforeWalkablePosition,
            convertStepsToDomPoint_Cached_CopesWithClonedNode,

            convertDomPointsToSteps_At0,
            convertDomPointsToSteps_Before0,
            convertDomPointsToSteps_BeforeRootNode_Returns0,
            convertDomPointsToSteps_AfterRootNode_ReturnsMaxLength,
            convertDomPointsToSteps_AfterRootNode_LastPositionInParent_ReturnsMaxLength,
            convertDomPointsToSteps_At1,
            convertDomPointsToSteps_BetweenPositions_RoundsDown,
            convertDomPointsToSteps_At5,
            convertDomPointsToSteps_WithinParagraph_BeforeFirstWalkablePosition_RoundsDown,
            convertDomPointsToSteps_BeforeRootNode_RoundingCheck,
            convertDomPointsToSteps_BetweenPositions_RoundingCheck,
            convertDomPointsToSteps_Cached_FirstPositionInParagraph_ConsistentWhenCached,
            convertDomPointsToSteps_Cached_SpeedsUpSecondCall,
            convertDomPointsToSteps_Cached_CopesWithClonedNode,
            convertDomPointsToSteps_Cached_CopesWithBookmarkedNodeBeingRemoved,
            convertDomPointsToSteps_Cached_FindsNearestKnownPosition,

            handleStepsInserted_InsertMultipleStepsIndividually,
            handleStepsInserted_InsertMultipleParagraphsIndividually,
            handleStepsInserted_InsertParagraphAtDocumentEnd,
            handleStepsRemoved_RemoveMultipleStepsIndividually,
            handleStepsRemoved_RemoveMultipleParagraphsIndividually,
            handleStepsRemoved_AtDocumentStart
        ]);
    };
    this.asyncTests = function () {
        return [
        ];
    };
};
ops.StepsTranslatorTests.prototype.description = function () {
    "use strict";
    return "Test the StepsTranslator class.";
};
(function () {
    "use strict";
    return ops.StepsTranslatorTests;
}());
