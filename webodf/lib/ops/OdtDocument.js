/**
 * @license
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
 *
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

/*global Node, runtime, core, gui, ops, odf*/

runtime.loadClass("core.EventNotifier");
runtime.loadClass("core.DomUtils");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("core.StepIterator");
runtime.loadClass("odf.Namespaces");
runtime.loadClass("gui.SelectionMover");
runtime.loadClass("core.PositionFilterChain");
runtime.loadClass("ops.StepsTranslator");
runtime.loadClass("ops.TextPositionFilter");
runtime.loadClass("ops.Member");

/**
 * A document that keeps all data related to the mapped document.
 * @constructor
 * @implements {ops.Document}
 * @param {!odf.OdfCanvas} odfCanvas
 */
ops.OdtDocument = function OdtDocument(odfCanvas) {
    "use strict";

    var self = this,
        odfUtils,
        domUtils,
        /**!Object.<!ops.OdtCursor>*/
        cursors = {},
        /**!Object.<!ops.Member>*/
        members = {},
        eventNotifier = new core.EventNotifier([
            ops.OdtDocument.signalMemberAdded,
            ops.OdtDocument.signalMemberUpdated,
            ops.OdtDocument.signalMemberRemoved,
            ops.OdtDocument.signalCursorAdded,
            ops.OdtDocument.signalCursorRemoved,
            ops.OdtDocument.signalCursorMoved,
            ops.OdtDocument.signalParagraphChanged,
            ops.OdtDocument.signalParagraphStyleModified,
            ops.OdtDocument.signalCommonStyleCreated,
            ops.OdtDocument.signalCommonStyleDeleted,
            ops.OdtDocument.signalTableAdded,
            ops.OdtDocument.signalOperationStart,
            ops.OdtDocument.signalOperationEnd,
            ops.OdtDocument.signalProcessingBatchStart,
            ops.OdtDocument.signalProcessingBatchEnd,
            ops.OdtDocument.signalUndoStackChanged,
            ops.OdtDocument.signalStepsInserted,
            ops.OdtDocument.signalStepsRemoved
        ]),
        /**@const*/
        FILTER_ACCEPT = core.PositionFilter.FilterResult.FILTER_ACCEPT,
        /**@const*/
        FILTER_REJECT = core.PositionFilter.FilterResult.FILTER_REJECT,
        filter,
        stepsTranslator,
        lastEditingOp,
        unsupportedMetadataRemoved = false;

    /**
     * @return {!Element}
     */
    function getRootNode() {
        var element = odfCanvas.odfContainer().getContentElement(),
            localName = element && element.localName;
        runtime.assert(localName === "text", "Unsupported content element type '" + localName + "' for OdtDocument");
        return element;
    }
    this.getDocumentElement = function () {
        return odfCanvas.odfContainer().rootElement;
    };

    this.cloneDocumentElement = function () {
        var rootElement = self.getDocumentElement(),
            annotationViewManager = odfCanvas.getAnnotationViewManager(),
            initialDoc;

        if (annotationViewManager) {
            annotationViewManager.forgetAnnotations();
        }
        initialDoc = rootElement.cloneNode(true);
        odfCanvas.refreshAnnotations();
        return initialDoc;
    };

    this.setDocumentElement = function (documentElement) {
        var odfContainer = odfCanvas.odfContainer();
        // TODO Replace with a neater hack for reloading the Odt tree
        // Once this is fixed, SelectionView.addOverlays & StepsTranslator.verifyRootNode can be largely removed
        // Also checkout some swear words in EventManager which re-adds the event trap
        odfContainer.setRootElement(documentElement);
        odfCanvas.setOdfContainer(odfContainer, true);
        odfCanvas.refreshCSS();
    };

    /**
     * @return {!Document}
     */
    function getDOM() {
        return /**@type{!Document}*/(getRootNode().ownerDocument);
    }
    this.getDOM = getDOM;
    
    /**
     * @param {!Node} node
     * @return {!boolean}
     */
    function isRoot(node) {
        if ((node.namespaceURI === odf.Namespaces.officens
             && node.localName === 'text'
            ) || (node.namespaceURI === odf.Namespaces.officens
                  && node.localName === 'annotation')) {
            return true;
        }
        return false;
    }

    /**
     * @param {!Node} node
     * @return {!Node}
     */
    function getRoot(node) {
        while (node && !isRoot(node)) {
            node = /**@type{!Node}*/(node.parentNode);
        }
        return node;
    }
    this.getRootElement = getRoot;

    /**
     * A filter that allows a position if it has the same closest
     * whitelisted root as the specified 'anchor', which can be the cursor
     * of the given memberid, or a given node
     * @constructor
     * @implements {core.PositionFilter}
     * @param {!string|!Node} anchor 
     */
    function RootFilter(anchor) {

        /**
         * @param {!core.PositionIterator} iterator
         * @return {!core.PositionFilter.FilterResult}
         */
        this.acceptPosition = function (iterator) {
            var node = iterator.container(),
                anchorNode;

            if (typeof anchor === "string") {
                anchorNode = cursors[anchor].getNode();
            } else {
                anchorNode = anchor;
            }

            if (getRoot(node) === getRoot(anchorNode)) {
                return FILTER_ACCEPT;
            }
            return FILTER_REJECT;
        };
    }

    /**
     * Create a new StepIterator instance set to the defined position
     *
     * @param {!Node} container
     * @param {!number} offset
     * @param {!Array.<!core.PositionFilter>} filters Filter to apply to the iterator positions. If multiple
     *  iterators are provided, they will be combined in order using a PositionFilterChain.
     * @param {!Node} subTree Subtree to search for step within. Generally a paragraph or document root. Choosing
     *  a smaller subtree allows iteration to end quickly if there are no walkable steps remaining in a particular
     *  direction. This can vastly improve performance.
     *
     * @return {!core.StepIterator}
     */
    function createStepIterator(container, offset, filters, subTree) {
        var positionIterator = gui.SelectionMover.createPositionIterator(subTree),
            filterOrChain,
            stepIterator;

        if (filters.length === 1) {
            filterOrChain = filters[0];
        } else {
            filterOrChain = new core.PositionFilterChain();
            filters.forEach(filterOrChain.addFilter);
        }

        stepIterator = new core.StepIterator(filterOrChain, positionIterator);
        stepIterator.setPosition(container, offset);
        return stepIterator;
    }
    this.createStepIterator = createStepIterator;

    /**
     * Returns a PositionIterator instance at the
     * specified starting position
     * @param {!number} position
     * @return {!core.PositionIterator}
     */
    function getIteratorAtPosition(position) {
        var iterator = gui.SelectionMover.createPositionIterator(getRootNode()),
            point = stepsTranslator.convertStepsToDomPoint(position);

        iterator.setUnfilteredPosition(point.node, point.offset);
        return iterator;
    }
    this.getIteratorAtPosition = getIteratorAtPosition;

    /**
     * @param {!Node} node
     * @param {!number} offset
     * @param {function(!number, !Node, !number):!boolean=} roundDirection if the node & offset
     * is not in an accepted location, this delegate is used to choose between rounding up or
     * rounding down to the nearest step. If not provided, the default behaviour is to round down.
     * @return {!number}
     */
    this.convertDomPointToCursorStep = function (node, offset, roundDirection) {
        return stepsTranslator.convertDomPointToSteps(node, offset, roundDirection);
    };

    /**
     * @param {!{anchorNode: !Node, anchorOffset: !number, focusNode: !Node, focusOffset: !number}} selection
     * @param {function(!Node, !number):function(!number, !Node, !number):!boolean=} constraint
     * @return {{position: !number, length: number}}
     */
    this.convertDomToCursorRange = function (selection, constraint) {
        var point1,
            point2,
            anchorConstraint = constraint && constraint(selection.anchorNode, selection.anchorOffset),
            focusConstraint;

        point1 = stepsTranslator.convertDomPointToSteps(selection.anchorNode, selection.anchorOffset, anchorConstraint);
        if (!constraint && selection.anchorNode === selection.focusNode && selection.anchorOffset === selection.focusOffset) {
            // If the user has specified a constraint, the rounding might differ between the focus and anchor
            // In this case, it's safest to just look up the next point again.
            point2 = point1;
        } else {
            focusConstraint = constraint && constraint(selection.focusNode, selection.focusOffset);
            point2 = stepsTranslator.convertDomPointToSteps(selection.focusNode, selection.focusOffset, focusConstraint);
        }

        return {
            position: point1,
            length: point2 - point1
        };
    };

    /**
     * Convert a cursor range to a DOM range
     * @param {!number} position
     * @param {!number} length
     * @return {Range}
     */
    this.convertCursorToDomRange = function (position, length) {
        var range = getDOM().createRange(),
            point1,
            point2;

        point1 = stepsTranslator.convertStepsToDomPoint(position);
        if (length) {
            point2 = stepsTranslator.convertStepsToDomPoint(position + length);
            if (length > 0) {
                range.setStart(point1.node, point1.offset);
                range.setEnd(point2.node, point2.offset);
            } else {
                range.setStart(point2.node, point2.offset);
                range.setEnd(point1.node, point1.offset);
            }
        } else {
            range.setStart(point1.node, point1.offset);
        }
        return range;
    };

    /**
     * This function will iterate through positions allowed by the position
     * iterator and count only the text positions. When the amount defined by
     * offset has been counted, the Text node that that position is returned
     * as well as the offset in that text node.
     * Optionally takes a memberid of a cursor, to specifically return the
     * text node positioned just behind that cursor.
     * @param {!number} steps
     * @param {!string=} memberid
     * @return {?{textNode: !Text, offset: !number}}
     */
    function getTextNodeAtStep(steps, memberid) {
        var iterator = getIteratorAtPosition(steps),
            node = iterator.container(),
            lastTextNode,
            nodeOffset = 0,
            cursorNode = null;

        if (node.nodeType === Node.TEXT_NODE) {
            // Iterator has stopped within an existing text node, to put that up as a possible target node
            lastTextNode = /**@type{!Text}*/(node);
            nodeOffset = /**@type{!number}*/(iterator.unfilteredDomOffset());
            // Always cut in a new empty text node at the requested position.
            // If this proves to be unnecessary, it will be cleaned up just before the return
            // after all necessary cursor rearrangements have been performed
            if (lastTextNode.length > 0) {
                // The node + offset returned make up the boundary just to the right of the requested step
                if (nodeOffset > 0) {
                    // In this case, after the split, the right of the requested step is just after the new node
                    lastTextNode = lastTextNode.splitText(nodeOffset);
                }
                lastTextNode.parentNode.insertBefore(getDOM().createTextNode(""), lastTextNode);
                lastTextNode = /**@type{!Text}*/(lastTextNode.previousSibling);
                nodeOffset = 0;
            }
        } else {
            // There is no text node at the current position, so insert a new one at the current position
            lastTextNode = getDOM().createTextNode("");
            nodeOffset = 0;
            node.insertBefore(lastTextNode, iterator.rightNode());
        }

        if (memberid) {
            // DEPRECATED: This branch is no longer the recommended way of handling cursor movements DO NOT USE
            // If the member cursor is as the requested position
            if (cursors[memberid] && self.getCursorPosition(memberid) === steps) {
                cursorNode = cursors[memberid].getNode();
                // Then move the member's cursor after all adjacent cursors
                while (cursorNode.nextSibling && cursorNode.nextSibling.localName === "cursor") {
                    // TODO this re-arrange logic will break if there are non-cursor elements in the way
                    // E.g., cursors occupy the same "step", but are on different sides of a span boundary
                    // This is currently avoided by calling fixCursorPositions after (almost) every op
                    // to re-arrange cursors together again
                    cursorNode.parentNode.insertBefore(cursorNode.nextSibling, cursorNode);
                }
                if (lastTextNode.length > 0 && lastTextNode.nextSibling !== cursorNode) {
                    // The last text node contains content but is not adjacent to the cursor
                    // This can't be moved, as moving it would move the text content around as well. Yikes!
                    // So, create a new text node to insert data into
                    lastTextNode = getDOM().createTextNode('');
                    nodeOffset = 0;
                }
                // Keep the destination text node right next to the member's cursor, so inserted text pushes the cursor over
                cursorNode.parentNode.insertBefore(lastTextNode, cursorNode);
            }
        } else {
            // Move all cursors BEFORE the new text node. Any cursors occupying the requested position should not
            // move when new text is added in the position
            while (lastTextNode.nextSibling && lastTextNode.nextSibling.localName === "cursor") {
                // TODO this re-arrange logic will break if there are non-cursor elements in the way
                // E.g., cursors occupy the same "step", but are on different sides of a span boundary
                // This is currently avoided by calling fixCursorPositions after (almost) every op
                // to re-arrange cursors together again
                lastTextNode.parentNode.insertBefore(lastTextNode.nextSibling, lastTextNode);
            }
        }

        // After the above cursor adjustments, if the lastTextNode
        // has a text node previousSibling, merge them and make the result the lastTextNode
        while (lastTextNode.previousSibling && lastTextNode.previousSibling.nodeType === Node.TEXT_NODE) {
            lastTextNode.previousSibling.appendData(lastTextNode.data);
            nodeOffset = /**@type{!number}*/(lastTextNode.previousSibling.length);
            lastTextNode = /**@type{!Text}*/(lastTextNode.previousSibling);
            lastTextNode.parentNode.removeChild(lastTextNode.nextSibling);
        }

        // Empty text nodes can be left on either side of the split operations that have occurred
        while (lastTextNode.nextSibling && lastTextNode.nextSibling.nodeType === Node.TEXT_NODE) {
            lastTextNode.appendData(lastTextNode.nextSibling.data);
            lastTextNode.parentNode.removeChild(lastTextNode.nextSibling);
        }

        return {textNode: lastTextNode, offset: nodeOffset };
    }

    /**
     * @param {?Node} node
     * @return {?Node}
     */
    function getParagraphElement(node) {
        return odfUtils.getParagraphElement(node);
    }

    /**
     * @param {!string} styleName
     * @param {!string} styleFamily
     * @return {Element}
     */
    function getStyleElement(styleName, styleFamily) {
        return odfCanvas.getFormatting().getStyleElement(styleName, styleFamily);
    }
    this.getStyleElement = getStyleElement;

    /**
     * @param {!string} styleName
     * @return {Element}
     */
    function getParagraphStyleElement(styleName) {
        return getStyleElement(styleName, 'paragraph');
    }

    /**
     * @param {!string} styleName
     * @return {?Object}
     */
    function getParagraphStyleAttributes(styleName) {
        var node = getParagraphStyleElement(styleName);
        if (node) {
            return odfCanvas.getFormatting().getInheritedStyleAttributes(node, false);
        }

        return null;
    }

    /**
     * Called after an operation is executed, this
     * function will check if the operation is an
     * 'edit', and in that case will update the
     * document's metadata, such as dc:creator,
     * meta:editing-cycles, and dc:creator.
     * @param {!ops.Operation} op
     */
    function handleOperationExecuted(op) {
        var spec = op.spec(),
            memberId = spec.memberid,
            date = new Date(spec.timestamp).toISOString(),
            odfContainer = odfCanvas.odfContainer(),
            fullName;

        // If the operation is an edit (that changes the
        // ODF that will be saved), then update metadata.
        if (op.isEdit) {
            fullName = self.getMember(memberId).getProperties().fullName;

            odfContainer.setMetadata({
                "dc:creator": fullName,
                "dc:date": date
            }, null);

            // If no previous op was found in this session,
            // then increment meta:editing-cycles by 1.
            if (!lastEditingOp) {
                odfContainer.incrementEditingCycles();
                // Remove certain metadata fields that
                // should be updated as soon as edits happen,
                // but cannot be because we don't support those yet.
                if (!unsupportedMetadataRemoved) {
                    odfContainer.setMetadata(null, [
                        "meta:editing-duration",
                        "meta:document-statistic"
                    ]);
                }
            }

            lastEditingOp = op;
        }
    }

    /**
     * Upgrades literal whitespaces (' ') to <text:s> </text:s>,
     * when given a textNode containing the whitespace and an offset
     * indicating the location of the whitespace in it.
     * @param {!Text} textNode
     * @param {!number} offset
     * @return {!Element}
     */
    function upgradeWhitespaceToElement(textNode, offset) {
        runtime.assert(textNode.data[offset] === ' ', "upgradeWhitespaceToElement: textNode.data[offset] should be a literal space");

        var space = textNode.ownerDocument.createElementNS(odf.Namespaces.textns, 'text:s');
        space.appendChild(textNode.ownerDocument.createTextNode(' '));

        textNode.deleteData(offset, 1);
        if (offset > 0) { // Don't create an empty text node if the offset is 0...
            textNode = /**@type {!Text}*/(textNode.splitText(offset));
        }
        textNode.parentNode.insertBefore(space, textNode);
        return space;
    }

    function upgradeWhitespacesAtPosition(position) {
        var iterator = getIteratorAtPosition(position),
            container,
            offset,
            i;

        // Ideally we have to check from *two* positions to the left and right
        // because the position may be surrounded by node boundaries. Slightly hackish.
        iterator.previousPosition();
        iterator.previousPosition();
        for (i = -1; i <= 1; i += 1) {
            container = iterator.container();
            offset = iterator.unfilteredDomOffset();
            if (container.nodeType === Node.TEXT_NODE
                    && container.data[offset] === ' '
                    && odfUtils.isSignificantWhitespace(container, offset)) {
                container = upgradeWhitespaceToElement(/**@type{!Text}*/(container), offset);
                // Reset the iterator position to be after the newly created space character
                iterator.moveToEndOfNode(container);
            }
            iterator.nextPosition();
        }
    }
    /**
     * Upgrades any significant whitespace at, one step left, and one step right of the given
     * position to space elements.
     * @param {!number} position
     * @return {undefined}
     */
    this.upgradeWhitespacesAtPosition = upgradeWhitespacesAtPosition;

    /**
     * Downgrades white space elements to normal spaces at the specified position if possible
     * @param {!number} position
     */
    this.downgradeWhitespacesAtPosition = function (position) {
        var iterator = getIteratorAtPosition(position),
            container,
            offset,
            firstSpaceElementChild,
            lastSpaceElementChild;

        container = iterator.container();
        offset = iterator.unfilteredDomOffset();
        while (!odfUtils.isSpaceElement(container) && container.childNodes[offset]) {
            // iterator.container will likely return a paragraph element with a non-zero offset
            // easiest way to translate this is to keep diving into child nodes until the either
            // an odf character element is encountered, or there are no more children
            container = container.childNodes[offset];
            offset = 0;
        }
        if (container.nodeType === Node.TEXT_NODE) {
            // a space element cannot be a text node. Perhaps it's parent is
            // this would be hit if iterator.container returns a text node or the previous loop dives
            // all the way down without finding any odf character elements
            container = container.parentNode;
        }
        if (odfUtils.isDowngradableSpaceElement(container)) {
            firstSpaceElementChild = container.firstChild;
            lastSpaceElementChild = container.lastChild;

            domUtils.mergeIntoParent(container);

            // merge any now neighbouring textnodes
            // usually there was just one child node, " "
            if (lastSpaceElementChild !== firstSpaceElementChild) {
                domUtils.normalizeTextNodes(lastSpaceElementChild);
            }
            domUtils.normalizeTextNodes(firstSpaceElementChild);
        }
    };

    this.getParagraphStyleElement = getParagraphStyleElement;

    this.getParagraphElement = getParagraphElement;

    /**
     * This method returns the style attributes for a given stylename, including all properties
     * inherited from any parent styles, and also the Default style in the family.
     * @param {!string} styleName
     * @return {?Object}
     */
    this.getParagraphStyleAttributes = getParagraphStyleAttributes;

    /**
     * This function will return the Text node as well as the offset in that text node
     * of the cursor.
     * @param {!number} position
     * @param {!string=} memberid
     * @return {?{textNode: !Text, offset: !number}}
     */
    this.getTextNodeAtStep = getTextNodeAtStep;

    /**
     * Returns the closest parent paragraph or root to the supplied container and offset
     * @param {!Node} container
     * @param {!number} offset
     * @param {!Node} root
     *
     * @return {!Node}
     */
    function paragraphOrRoot(container, offset, root) {
        var node = container.childNodes[offset] || container,
            paragraph = getParagraphElement(node);
        if (paragraph && domUtils.containsNode(root, paragraph)) {
            // Only return the paragraph if it is contained within the destination root
            return /**@type{!Node}*/(paragraph);
        }
        // Otherwise the step filter should be contained within the supplied root
        return root;
    }

    /**
     * Iterates through all cursors and checks if they are in
     * walkable positions; if not, move the cursor 1 filtered step backward
     * which guarantees walkable state for all cursors,
     * while keeping them inside the same root. An event will be raised for this cursor if it is moved
     */
    this.fixCursorPositions = function () {
        Object.keys(cursors).forEach(function (memberId) {
            var cursor = cursors[memberId],
                root = getRoot(cursor.getNode()),
                rootFilter = self.createRootFilter(root),
                subTree,
                startPoint,
                endPoint,
                selectedRange,
                cursorMoved = false;

            selectedRange = cursor.getSelectedRange();
            subTree = paragraphOrRoot(/**@type{!Node}*/(selectedRange.startContainer), selectedRange.startOffset, root);
            startPoint = createStepIterator(/**@type{!Node}*/(selectedRange.startContainer), selectedRange.startOffset,
                [filter, rootFilter], subTree);

            if (!selectedRange.collapsed) {
                subTree = paragraphOrRoot(/**@type{!Node}*/(selectedRange.endContainer), selectedRange.endOffset, root);
                endPoint = createStepIterator(/**@type{!Node}*/(selectedRange.endContainer), selectedRange.endOffset,
                    [filter, rootFilter], subTree);
            } else {
                endPoint = startPoint;
            }

            if (!startPoint.isStep() || !endPoint.isStep()) {
                cursorMoved = true;
                runtime.assert(startPoint.roundToClosestStep(), "No walkable step found for cursor owned by " + memberId);
                selectedRange.setStart(startPoint.container(), startPoint.offset());
                runtime.assert(endPoint.roundToClosestStep(), "No walkable step found for cursor owned by " + memberId);
                selectedRange.setEnd(endPoint.container(), endPoint.offset());
            } else if (startPoint.container() === endPoint.container() && startPoint.offset() === endPoint.offset()) {
                // The range *should* be collapsed
                if (!selectedRange.collapsed || cursor.getAnchorNode() !== cursor.getNode()) {
                    // It might not be collapsed if there are other unwalkable nodes (e.g., cursors)
                    // between the cursor and anchor nodes. In this case, force the cursor to collapse
                    cursorMoved = true;
                    selectedRange.setStart(startPoint.container(), startPoint.offset());
                    selectedRange.collapse(true);
                }
            }

            if (cursorMoved) {
                cursor.setSelectedRange(selectedRange, cursor.hasForwardSelection());
                self.emit(ops.OdtDocument.signalCursorMoved, cursor);
            }
        });
    };

    /**
     * This function returns the position in ODF world of the cursor of the member.
     * @param {!string} memberid
     * @return {!number}
     */
    this.getCursorPosition = function (memberid) {
        var cursor = cursors[memberid];
        return cursor ? stepsTranslator.convertDomPointToSteps(cursor.getNode(), 0) : 0;
    };

    /**
     * This function returns the position and selection length in ODF world of
     * the cursor of the member.
     * position is always the number of steps from root node to the anchor node
     * length is the number of steps from anchor node to focus node
     * !IMPORTANT! length is a vector, and may be negative if the cursor selection
     * is reversed (i.e., user clicked and dragged the cursor backwards)
     * @param {!string} memberid
     * @return {{position: !number, length: !number}}
     */
    this.getCursorSelection = function(memberid) {
        var cursor = cursors[memberid],
            focusPosition = 0,
            anchorPosition = 0;
        if (cursor) {
            focusPosition = stepsTranslator.convertDomPointToSteps(cursor.getNode(), 0);
            anchorPosition = stepsTranslator.convertDomPointToSteps(cursor.getAnchorNode(), 0);
        }
        return {
            position: anchorPosition,
            length: focusPosition - anchorPosition
        };
    };
    /**
     * @return {!core.PositionFilter}
     */
    this.getPositionFilter = function () {
        return filter;
    };

    /**
     * @return {!odf.OdfCanvas}
     */
    this.getOdfCanvas = function () {
        return odfCanvas;
    };

    /**
     * @return {!Element}
     */
    this.getRootNode = getRootNode;

    /**
     * @param {!ops.Member} member
     * @return {undefined}
     */
    this.addMember = function (member) {
        runtime.assert(members[member.getMemberId()] === undefined, "This member already exists");
        members[member.getMemberId()] = member;
    };

    /**
     * @param {!string} memberId
     * @return {?ops.Member}
     */
    this.getMember = function (memberId) {
        return members.hasOwnProperty(memberId) ? members[memberId] : null;
    };

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    this.removeMember = function (memberId) {
        delete members[memberId];
    };

    /**
     * @param {!string} memberid
     * @return {ops.OdtCursor}
     */
    this.getCursor = function (memberid) {
        return cursors[memberid];
    };

    /**
     * @return {!Array.<!ops.OdtCursor>}
     */
    this.getCursors = function () {
        var list = [], i;
        for (i in cursors) {
            if (cursors.hasOwnProperty(i)) {
                list.push(cursors[i]);
            }
        }
        return list;
    };

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    this.addCursor = function (cursor) {
        runtime.assert(Boolean(cursor), "OdtDocument::addCursor without cursor");
        var distanceToFirstTextNode = cursor.getStepCounter().countSteps(1, filter),
            memberid = cursor.getMemberId();

        runtime.assert(typeof memberid === "string", "OdtDocument::addCursor has cursor without memberid");
        runtime.assert(!cursors[memberid], "OdtDocument::addCursor is adding a duplicate cursor with memberid " + memberid);
        cursor.move(distanceToFirstTextNode);

        cursors[memberid] = cursor;
    };

    /**
     * @param {!string} memberid
     * @return {!boolean}
     */
    this.removeCursor = function (memberid) {
        var cursor = cursors[memberid];
        if (cursor) {
            cursor.removeFromOdtDocument();
            delete cursors[memberid];
            self.emit(ops.OdtDocument.signalCursorRemoved, memberid);
            return true;
        }
        return false;
    };

    /**
     * Moves the cursor/selection of a given memberid to the
     * given position+length combination and adopts the given
     * selectionType.
     * It is the caller's responsibility to decide if and when
     * to subsequently fire signalCursorMoved.
     * @param {!string} memberid
     * @param {!number} position
     * @param {!number} length
     * @param {!string} selectionType
     * @return {undefined}
     */
    this.moveCursor = function (memberid, position, length, selectionType) {
        var cursor = cursors[memberid],
            selectionRange = self.convertCursorToDomRange(position, length);
        if (cursor && selectionRange) {
            cursor.setSelectedRange(selectionRange, length >= 0);
            cursor.setSelectionType(selectionType || ops.OdtCursor.RangeSelection);
        }
    };

    /**
     * @return {!odf.Formatting}
     */
    this.getFormatting = function () {
        return odfCanvas.getFormatting();
    };

    /**
     * @param {!string} eventid
     * @param {*} args
     * @return {undefined}
     */
    this.emit = function (eventid, args) {
        eventNotifier.emit(eventid, args);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function (eventid, cb) {
        eventNotifier.subscribe(eventid, cb);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function (eventid, cb) {
        eventNotifier.unsubscribe(eventid, cb);
    };

    /**
     * @param {string|!Node} inputMemberId
     * @reurn {!RootFilter}
     */
    this.createRootFilter = function (inputMemberId) {
        return new RootFilter(inputMemberId);
    };

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.close = function(callback) {
        // TODO: check if anything needs to be cleaned up
        callback();
    };

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function(callback) {
        callback();
    };

    /**
     * @return {undefined}
     */
    function init() {
        filter = new ops.TextPositionFilter(getRootNode);
        odfUtils = new odf.OdfUtils();
        domUtils = new core.DomUtils();
        stepsTranslator = new ops.StepsTranslator(getRootNode, gui.SelectionMover.createPositionIterator, filter, 500);
        eventNotifier.subscribe(ops.OdtDocument.signalStepsInserted, stepsTranslator.handleStepsInserted);
        eventNotifier.subscribe(ops.OdtDocument.signalStepsRemoved, stepsTranslator.handleStepsRemoved);
        eventNotifier.subscribe(ops.OdtDocument.signalOperationEnd, handleOperationExecuted);
    }
    init();
};

/**@const*/ops.OdtDocument.signalMemberAdded =   "member/added";
/**@const*/ops.OdtDocument.signalMemberUpdated =   "member/updated";
/**@const*/ops.OdtDocument.signalMemberRemoved =   "member/removed";
/**@const*/ops.OdtDocument.signalCursorAdded =   "cursor/added";
/**@const*/ops.OdtDocument.signalCursorRemoved = "cursor/removed";
/**@const*/ops.OdtDocument.signalCursorMoved =   "cursor/moved";
/**@const*/ops.OdtDocument.signalParagraphChanged = "paragraph/changed";
/**@const*/ops.OdtDocument.signalTableAdded = "table/added";
/**@const*/ops.OdtDocument.signalCommonStyleCreated = "style/created";
/**@const*/ops.OdtDocument.signalCommonStyleDeleted = "style/deleted";
/**@const*/ops.OdtDocument.signalParagraphStyleModified = "paragraphstyle/modified";
/**@const*/ops.OdtDocument.signalOperationStart = "operation/start";
/**@const*/ops.OdtDocument.signalOperationEnd = "operation/end";
/**@const*/ops.OdtDocument.signalProcessingBatchStart = "router/batchstart";
/**@const*/ops.OdtDocument.signalProcessingBatchEnd = "router/batchend";
/**@const*/ops.OdtDocument.signalUndoStackChanged = "undo/changed";
/**@const*/ops.OdtDocument.signalStepsInserted = "steps/inserted";
/**@const*/ops.OdtDocument.signalStepsRemoved = "steps/removed";

(function () {
    "use strict";
    return ops.OdtDocument;
}());

// vim:expandtab
