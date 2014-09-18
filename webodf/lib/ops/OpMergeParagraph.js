/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global ops, runtime, odf, core, Node*/

/**
 * Merges two adjacent paragraphs together into the first paragraph. The destination paragraph
 * is expected to always be the first paragraph in DOM order. No content (other than editinfo elements)
 * are removed as part of this operation. Once all child nodes have been shifted from the source paragraph,
 * the source paragraph and any collapsible parents will be cleaned up.
 *
 * @constructor
 * @implements ops.Operation
 */
ops.OpMergeParagraph = function OpMergeParagraph() {
    "use strict";

    var memberid, timestamp,
        /**@type {!boolean}*/
        moveCursor,
        /**@type{!string}*/
        paragraphStyleName,
        /**@type{!number}*/
        sourceStartPosition,
        /**@type{!number}*/
        destinationStartPosition,
        odfUtils = odf.OdfUtils,
        domUtils = core.DomUtils,
        /**@const*/
        textns = odf.Namespaces.textns;

    /**
     * @param {!ops.OpMergeParagraph.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        moveCursor = data.moveCursor;
        paragraphStyleName = data.paragraphStyleName;
        sourceStartPosition = parseInt(data.sourceStartPosition, 10);
        destinationStartPosition = parseInt(data.destinationStartPosition, 10);
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * Returns true if the supplied node is an ODF grouping element with no content
     * @param {!Node} element
     * @return {!boolean}
     */
    function isEmptyGroupingElement(element) {
        return odfUtils.isGroupingElement(element) && odfUtils.hasNoODFContent(element);
    }

    /**
     * Merges the source paragraph into the destination paragraph.
     * @param {!Element} destination Paragraph to merge content into
     * @param {!Element} source Paragraph to merge content from
     * @return {undefined}
     */
    function mergeParagraphs(destination, source) {
        var child;

        child = source.firstChild;
        while (child) {
            if (child.localName === 'editinfo') {
                // TODO It should be the view's responsibility to clean these up. This would fix #431
                source.removeChild(child);
            } else {
                destination.appendChild(child);
                // Empty spans need to be cleaned up on merge, as remove text only removes things that contain text content
                // Child is moved across before collapsing so any foreign sub-elements are collapsed up the chain next to
                // the destination location
                domUtils.removeUnwantedNodes(child, isEmptyGroupingElement);
            }
            child = source.firstChild;
        }
    }

    /**
     * Returns true if the specified node is insignificant whitespace
     * @param {!Node} node
     * @return {!boolean}
     */
    function isInsignificantWhitespace(node) {
        var textNode,
            badNodeDescription;
        if (node.nodeType === Node.TEXT_NODE) {
            textNode = /**@type{!Text}*/(node);
            if (textNode.length === 0) {
                // This is not a critical issue, but indicates an operation somewhere isn't correctly normalizing text nodes
                // after manipulation of the DOM.
                runtime.log("WARN: Empty text node found during merge operation");
                return true;
            }
            if (odfUtils.isODFWhitespace(textNode.data) && odfUtils.isSignificantWhitespace(textNode, 0) === false) {
                return true;
            }
            badNodeDescription = "#text";
        } else {
            badNodeDescription = (node.prefix ? (node.prefix + ":") : "") + node.localName;
        }
        runtime.log("WARN: Unexpected text element found near paragraph boundary [" + badNodeDescription + "]");
        return false;
    }

    /**
     * Remove all the text nodes within the supplied range. These are expected to be insignificant whitespace only.
     * Assertions will be thrown if this is not the case.
     *
     * @param {!Range} range
     * @return {undefined}
     */
    function removeTextNodes(range) {
        var emptyTextNodes;

        if (range.collapsed) {
            return;
        }

        domUtils.splitBoundaries(range);
        // getTextElements may return some unexpected text nodes if the step filters haven't correctly identified the
        // first/last step in the paragraph. Rather than failing completely in this case, simply log the unexpected
        // items and skip them.
        emptyTextNodes = odfUtils.getTextElements(range, false, true).filter(isInsignificantWhitespace);
        emptyTextNodes.forEach(function(node) {
            node.parentNode.removeChild(node);
        });
    }

    /**
     * Discard insignificant whitespace between the start of the paragraph node and the first step in the paragraph
     *
     * @param {!core.StepIterator} stepIterator
     * @param {!Element} paragraphElement
     * @return {undefined}
     */
    function trimLeadingInsignificantWhitespace(stepIterator, paragraphElement) {
        var range = paragraphElement.ownerDocument.createRange();
        stepIterator.setPosition(paragraphElement, 0);
        stepIterator.roundToNextStep();
        range.setStart(paragraphElement, 0);
        range.setEnd(stepIterator.container(), stepIterator.offset());
        removeTextNodes(range);
    }

    /**
     * Discard insignificant whitespace between the last step in the paragraph and the end of the paragraph node
     *
     * @param {!core.StepIterator} stepIterator
     * @param {!Element} paragraphElement
     * @return {undefined}
     */
    function trimTrailingInsignificantWhitespace(stepIterator, paragraphElement) {
        var range = paragraphElement.ownerDocument.createRange();
        stepIterator.setPosition(paragraphElement, paragraphElement.childNodes.length);
        stepIterator.roundToPreviousStep();
        range.setStart(stepIterator.container(), stepIterator.offset());
        range.setEnd(paragraphElement, paragraphElement.childNodes.length);
        removeTextNodes(range);
    }

    /**
     * Fetch the paragraph at the specified step. In addition, if a stepIterator is provided,
     * set the step iterator position to the exact DOM point of the requested step.
     *
     * @param {!ops.OdtDocument} odtDocument
     * @param {!number} steps
     * @param {!core.StepIterator=} stepIterator
     * @return {!Element}
     */
    function getParagraphAtStep(odtDocument, steps, stepIterator) {
        var domPoint = odtDocument.convertCursorStepToDomPoint(steps),
            paragraph = odfUtils.getParagraphElement(domPoint.node, domPoint.offset);
        runtime.assert(Boolean(paragraph), "Paragraph not found at step " + steps);
        if (stepIterator) {
            stepIterator.setPosition(domPoint.node, domPoint.offset);
        }
        return /**@type{!Element}*/(paragraph);
    }

    /**
     * @param {!ops.Document} document
     * @return {!boolean}
     */
    this.execute = function (document) {
        var odtDocument = /**@type{!ops.OdtDocument}*/(document),
            sourceParagraph,
            destinationParagraph,
            cursor = odtDocument.getCursor(memberid),
            rootNode = odtDocument.getRootNode(),
            collapseRules = new odf.CollapsingRules(rootNode),
            stepIterator = odtDocument.createStepIterator(rootNode, 0, [odtDocument.getPositionFilter()], rootNode),
            downgradeOffset;

        // Asserting a specific order for destination + source makes it easier to decide which ends to upgrade
        runtime.assert(destinationStartPosition < sourceStartPosition,
                        "Destination paragraph (" + destinationStartPosition + ") must be " +
                        "before source paragraph (" + sourceStartPosition + ")");

        destinationParagraph = getParagraphAtStep(odtDocument, destinationStartPosition);

        // Merging is not expected to be able to re-order document content. It is only ever removing a single paragraph
        // split and merging the content back into the previous paragraph. This helps ensure OT behaviour is straightforward
        sourceParagraph = getParagraphAtStep(odtDocument, sourceStartPosition, stepIterator);
        stepIterator.previousStep();
        runtime.assert(domUtils.containsNode(destinationParagraph, stepIterator.container()),
                        "Destination paragraph must be adjacent to the source paragraph");

        trimTrailingInsignificantWhitespace(stepIterator, destinationParagraph);
        downgradeOffset = destinationParagraph.childNodes.length;
        trimLeadingInsignificantWhitespace(stepIterator, sourceParagraph);

        mergeParagraphs(destinationParagraph, sourceParagraph);
        // All children have been migrated, now consume up the source parent chain
        runtime.assert(sourceParagraph.childNodes.length === 0, "Source paragraph should be empty before it is removed");
        // Merge into parent logic still necessary as the parent may have surrounding containers that collapse
        // (e.g., is now inside an empty list)
        collapseRules.mergeChildrenIntoParent(sourceParagraph);

        // Merging removes a single step between the boundary of the two paragraphs
        odtDocument.handleStepsRemoved({position: sourceStartPosition - 1});

        // Downgrade trailing spaces at the end of the destination paragraph, and the beginning of the source paragraph.
        // These are the only two places that might need downgrading as a result of the merge.
        // NB: if the destination paragraph was empty before the merge, this might actually check the
        // paragraph just prior to the destination. However, as the downgrade also checks 2 steps after the specified
        // one though, there is no harm caused by this.
        stepIterator.setPosition(destinationParagraph, downgradeOffset);
        stepIterator.roundToClosestStep();
        if (!stepIterator.previousStep()) {
            // If no previous step is found, round back up to the next available step
            stepIterator.roundToNextStep();
        }
        odtDocument.downgradeWhitespaces(stepIterator);

        if (paragraphStyleName) {
            destinationParagraph.setAttributeNS(textns, "text:style-name", paragraphStyleName);
        } else {
            destinationParagraph.removeAttributeNS(textns, "style-name");
        }

        if (cursor && moveCursor) {
            odtDocument.moveCursor(memberid, sourceStartPosition - 1, 0);
            odtDocument.emit(ops.Document.signalCursorMoved, cursor);
        }

        odtDocument.fixCursorPositions();
        odtDocument.getOdfCanvas().refreshSize();
        // TODO: signal also the deleted paragraphs, so e.g. SessionView can clean up the EditInfo
        odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
            paragraphElement: destinationParagraph,
            memberId: memberid,
            timeStamp: timestamp
        });

        odtDocument.getOdfCanvas().rerenderAnnotations();
        return true;
    };

    /**
     * @return {!ops.OpMergeParagraph.Spec}
     */
    this.spec = function () {
        return {
            optype: "MergeParagraph",
            memberid: memberid,
            timestamp: timestamp,
            moveCursor: moveCursor,
            paragraphStyleName: paragraphStyleName,
            sourceStartPosition: sourceStartPosition,
            destinationStartPosition: destinationStartPosition
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    moveCursor: !boolean,
    paragraphStyleName: !string,
    sourceStartPosition: !number,
    destinationStartPosition: !number
}}*/
ops.OpMergeParagraph.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    moveCursor: !boolean,
    paragraphStyleName: !string,
    sourceStartPosition: !number,
    destinationStartPosition: !number
}}*/
ops.OpMergeParagraph.InitSpec;
