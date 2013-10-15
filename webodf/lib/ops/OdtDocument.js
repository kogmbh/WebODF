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

/*global Node, runtime, core, gui, ops, odf*/

runtime.loadClass("core.EventNotifier");
runtime.loadClass("core.DomUtils");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("odf.Namespaces");
runtime.loadClass("gui.SelectionMover");
runtime.loadClass("gui.StyleHelper");
runtime.loadClass("core.PositionFilterChain");

/**
 * A document that keeps all data related to the mapped document.
 * @constructor
 * @param {!odf.OdfCanvas} odfCanvas
 */
ops.OdtDocument = function OdtDocument(odfCanvas) {
    "use strict";

    var self = this,
        odfUtils,
        domUtils,
        /**!Object.<!ops.OdtCursor>*/cursors = {},
        eventNotifier = new core.EventNotifier([
            ops.OdtDocument.signalCursorAdded,
            ops.OdtDocument.signalCursorRemoved,
            ops.OdtDocument.signalCursorMoved,
            ops.OdtDocument.signalParagraphChanged,
            ops.OdtDocument.signalParagraphStyleModified,
            ops.OdtDocument.signalCommonStyleCreated,
            ops.OdtDocument.signalCommonStyleDeleted,
            ops.OdtDocument.signalTableAdded,
            ops.OdtDocument.signalOperationExecuted,
            ops.OdtDocument.signalUndoStackChanged]),
        /**@const*/FILTER_ACCEPT = core.PositionFilter.FilterResult.FILTER_ACCEPT,
        /**@const*/FILTER_REJECT = core.PositionFilter.FilterResult.FILTER_REJECT,
        filter;

    /**
     * @return {!Element}
     */
    function getRootNode() {
        var element = odfCanvas.odfContainer().getContentElement(),
            localName = element && element.localName;
        runtime.assert(localName === "text", "Unsupported content element type '" + localName + "'for OdtDocument");
        return element;
    }

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
         * @param {!Node} node
         * @return {!boolean}
         */
        function isRoot(node) {
            if ((node.namespaceURI === odf.Namespaces.officens && node.localName === 'text') ||
                    (node.namespaceURI === odf.Namespaces.officens && node.localName === 'annotation')) {
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
     * @constructor
     * @implements {core.PositionFilter}
     */
    function TextPositionFilter() {
       /**
         * @param {!Node} container
         * @param {?Node} leftNode
         * @param {?Node} rightNode
         * @return {!core.PositionFilter.FilterResult}
         */
        function checkLeftRight(container, leftNode, rightNode) {
            var r, firstPos, rightOfChar;
            // accept if there is a character immediately to the left
            if (leftNode) {
                r = odfUtils.lookLeftForCharacter(leftNode);
                if (r === 1) {// non-whitespace character or a character element
                    return FILTER_ACCEPT;
                }
                if (r === 2 && (odfUtils.scanRightForAnyCharacter(rightNode)
                    || odfUtils.scanRightForAnyCharacter(odfUtils.nextNode(container)))) {
                    // significant whitespace is ok, if not in trailing whitesp
                    return FILTER_ACCEPT;
                }
            }
            // at this point, we know that the position is not directly to the
            // right of a significant character or element. so the position is
            // only acceptable if it is the first in an empty p or h or if it
            // is to the left of the first significant character or element.

            // accept if this is the first position in p or h and there is no
            // character in the p or h
            firstPos = leftNode === null && odfUtils.isParagraph(container);
            rightOfChar = odfUtils.lookRightForCharacter(rightNode);
            if (firstPos) {
                if (rightOfChar) {
                    return FILTER_ACCEPT;
                }
                // position is first position in empty paragraph
                return odfUtils.scanRightForAnyCharacter(rightNode) ? FILTER_REJECT : FILTER_ACCEPT;
            }
            // if not directly to the right of a character, reject
            if (!rightOfChar) {
                return FILTER_REJECT;
            }
            // accept if there is no character to the left
            leftNode = leftNode || odfUtils.previousNode(container);
            return odfUtils.scanLeftForAnyCharacter(leftNode) ? FILTER_REJECT : FILTER_ACCEPT;
        }

        /**
         * @param {!core.PositionIterator} iterator
         * @return {!core.PositionFilter.FilterResult}
         */
        this.acceptPosition = function (iterator) {
            var container = iterator.container(),
                nodeType = container.nodeType,
                offset,
                text,
                leftChar,
                rightChar,
                leftNode,
                rightNode,
                r;

            if (nodeType !== Node.ELEMENT_NODE && nodeType !== Node.TEXT_NODE) {
                return FILTER_REJECT;
            }
            if (nodeType === Node.TEXT_NODE) {
                if (!odfUtils.isGroupingElement(container.parentNode)
                        || odfUtils.isWithinTrackedChanges(container.parentNode, getRootNode())) {
                    return FILTER_REJECT;
                }
                // In a PositionIterator, the offset in a text node is never
                // equal to the length of the text node.
                offset = iterator.unfilteredDomOffset();
                text = container.data;
                runtime.assert(offset !== text.length, "Unexpected offset.");
                if (offset > 0) {
                    // The cursor may be placed to the right of a non-whitespace
                    // character.
                    leftChar = text.substr(offset - 1, 1);
                    if (!odfUtils.isODFWhitespace(leftChar)) {
                        return FILTER_ACCEPT;
                    }
                    // A whitespace to the left is ok, if
                    // * there is a non-whitespace character to the right and
                    //   that is the first non-whitespace character or character
                    //   element or
                    // * there is not another whitespace character in front of
                    //   it.
                    if (offset > 1) {
                        leftChar = text.substr(offset - 2, 1);
                        if (!odfUtils.isODFWhitespace(leftChar)) {
                            r = FILTER_ACCEPT;
                        } else if (!odfUtils.isODFWhitespace(text.substr(0, offset))) {
                            // check if this can be leading paragraph space
                            return FILTER_REJECT;
                        }
                    } else {
                        // check if there is a non-whitespace character or
                        // character element in a preceding node
                        leftNode = odfUtils.previousNode(container);
                        if (odfUtils.scanLeftForNonWhitespace(leftNode)) {
                            r = FILTER_ACCEPT;
                        }
                    }
                    if (r === FILTER_ACCEPT) {
                        return odfUtils.isTrailingWhitespace(container, offset)
                            ? FILTER_REJECT : FILTER_ACCEPT;
                    }
                    rightChar = text.substr(offset, 1);
                    if (odfUtils.isODFWhitespace(rightChar)) {
                        return FILTER_REJECT;
                    }
                    return odfUtils.scanLeftForAnyCharacter(odfUtils.previousNode(container))
                        ? FILTER_REJECT : FILTER_ACCEPT;
                }
                leftNode = iterator.leftNode();
                rightNode = container;
                container = /**@type{!Node}*/(container.parentNode);
                r = checkLeftRight(container, leftNode, rightNode);
            } else if (!odfUtils.isGroupingElement(container)
                        || odfUtils.isWithinTrackedChanges(container, getRootNode())) {
                r = FILTER_REJECT;
            } else {
                leftNode = iterator.leftNode();
                rightNode = iterator.rightNode();
                r = checkLeftRight(container, leftNode, rightNode);
            }
            return r;
        };
    }

    /**
     * Returns a PositionIterator instance at the
     * specified starting position
     * @param {!number} position
     * @return {!core.PositionIterator}
     */
    function getIteratorAtPosition(position) {
        var iterator = gui.SelectionMover.createPositionIterator(getRootNode());

        position += 1;

        while (position > 0 && iterator.nextPosition()) {
            if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                position -= 1;
            }
        }
        return iterator;
    }
    this.getIteratorAtPosition = getIteratorAtPosition;

    /**
     * This function will iterate through positions allowed by the position
     * iterator and count only the text positions. When the amount defined by
     * offset has been counted, the Text node that that position is returned
     * as well as the offset in that text node.
     * Optionally takes a memberid of a cursor, to specifically return the
     * text node positioned just behind that cursor.
     * @param {!number} position
     * @param {!string=} memberid
     * @return {?{textNode: !Text, offset: !number}}
     */
    function getPositionInTextNode(position, memberid) {
        var iterator = gui.SelectionMover.createPositionIterator(getRootNode()),
            /**@type{?Text}*/
            lastTextNode = null,
            node,
            nodeOffset = 0,
            cursorNode = null,
            originalPosition = position;

        runtime.assert(position >= 0, "position must be >= 0");

        // first prepare things
        // iterator should be at the start of getRootNode()
        if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
            node = iterator.container();
            if (node.nodeType === Node.TEXT_NODE) {
                lastTextNode = /**@type{!Text}*/(node);
                nodeOffset = 0;
            }
        } else {
            // add 1 to move into an acceptable position
            position += 1;
        }
        // now iterate over as many positions as given
        // loop as long as there is another position to reach
        // or the text node in the final destination has not been reached yet
        while (position > 0 || lastTextNode === null) {
            // reaching end of document too early?
            if (!iterator.nextPosition()) {
                // the desired position cannot be found
                return null;
            }
            // iterator at a text position?
            if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                position -= 1;
                node = iterator.container();
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node !== lastTextNode) {
                        lastTextNode = /**@type{!Text}*/(node);
                        nodeOffset = iterator.unfilteredDomOffset();
                    } else {
                        nodeOffset += 1;
                    }
                } else if (lastTextNode !== null) {
                    if (position === 0) {
                        // position is at end of text node
                        nodeOffset = lastTextNode.length;
                        break;
                    }
                    lastTextNode = null;
                } else if (position === 0) {
                    // position is without any text node currently, so add an empty one
                    lastTextNode = getRootNode().ownerDocument.createTextNode('');
                    node.insertBefore(lastTextNode, iterator.rightNode());
                    nodeOffset = 0;
                    break;
                }
            }
        }
        if (lastTextNode === null) {
            return null;
        }

        // Move the cursor with the current memberid after all adjacent cursors,
        // ONLY if it is at the same position as the requested one
        if (memberid
                && cursors[memberid]
                && self.getCursorPosition(memberid) === originalPosition) {

            cursorNode = cursors[memberid].getNode();
            while (nodeOffset === 0 && cursorNode.nextSibling
                    && cursorNode.nextSibling.localName === "cursor") {
                cursorNode.parentNode.insertBefore(cursorNode, cursorNode.nextSibling.nextSibling);
            }
            // The lastTextNode is not "" if the position is at the end of a paragraph.
            // We definitely need ephemeral empty text nodes instead of a lastTextNode representing
            // all the previous text, to prevent insertion by one cursor causing movement of the other
            // cursors at the same position.
            if (lastTextNode.length > 0) {
                lastTextNode = getRootNode().ownerDocument.createTextNode('');
                nodeOffset = 0;
                cursorNode.parentNode.insertBefore(lastTextNode, cursorNode.nextSibling);
            }

            // if the position is just after a cursor, then move in front of that
            // cursor. Give preference to the cursor with the optionally specified memberid
            while (nodeOffset === 0 && lastTextNode.previousSibling &&
                    lastTextNode.previousSibling.localName === "cursor") {
                node = lastTextNode.previousSibling;
                if (lastTextNode.length > 0) {
                    lastTextNode = getRootNode().ownerDocument.createTextNode('');
                }
                node.parentNode.insertBefore(lastTextNode, node);

                if (cursorNode === node) {
                    break;
                }
            }
        }

        // After the above cursor-specific adjustment, if the lastTextNode
        // has a text node previousSibling, merge them and make the result the lastTextNode
        while (lastTextNode.previousSibling
                && lastTextNode.previousSibling.nodeType === Node.TEXT_NODE) {
            lastTextNode.previousSibling.appendData(lastTextNode.data);
            nodeOffset = lastTextNode.previousSibling.length;
            lastTextNode = /**@type{!Text}*/(lastTextNode.previousSibling);
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
     * @returns {Element}
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
            return odfCanvas.getFormatting().getInheritedStyleAttributes(node);
        }

        return null;
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
            firstSpaceElementChild, lastSpaceElementChild;

        container = iterator.container();
        offset = iterator.unfilteredDomOffset();
        while (!odfUtils.isCharacterElement(container) && container.childNodes[offset]) {
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
    this.getPositionInTextNode = getPositionInTextNode;

    /**
     * Iterates through all cursors and checks if they are in
     * walkable positions; if not, move the cursor 1 filtered step backward
     * which guarantees walkable state for all cursors,
     * while keeping them inside the same root. An event will be raised for this cursor if it is moved
     */
    this.fixCursorPositions = function () {
        var rootConstrainedFilter = new core.PositionFilterChain();
        rootConstrainedFilter.addFilter('BaseFilter', filter);

        Object.keys(cursors).forEach(function(memberId) {
            var cursor = cursors[memberId],
                stepCounter = cursor.getStepCounter(),
                stepsToAnchor = stepCounter.countStepsToPosition(cursor.getAnchorNode(), 0, filter),
                positionsToAdjustFocus = 0,
                positionsToAnchor = 0,
                cursorMoved = false;

            // Equip a Root Filter for specifically this cursor
            rootConstrainedFilter.addFilter('RootFilter', self.createRootFilter(memberId));

            if (!stepCounter.isPositionWalkable(rootConstrainedFilter)) {
                cursorMoved = true;
                positionsToAdjustFocus = stepCounter.countPositionsToNearestStep(rootConstrainedFilter);
                cursor.move(positionsToAdjustFocus);

                if (stepsToAnchor !== 0) {
                    positionsToAnchor = stepsToAnchor < 0
                        ? -stepCounter.countBackwardSteps(-stepsToAnchor, rootConstrainedFilter)
                        : stepCounter.countForwardSteps(stepsToAnchor, rootConstrainedFilter);
                    // Cursor extension implicitly goes anchor-to-focus. As such, the cursor needs to be navigated
                    // first to the anchor position, then extended to the focus node to ensure the focus ends up at the
                    // correct end of the selection
                    cursor.move(positionsToAnchor);
                    cursor.move(-positionsToAnchor, true);
                }
            } else if (stepsToAnchor === 0) {
                cursorMoved = true;
                // call move(0) here to force the cursor to reset its selection to collapsed
                // and remove the now-unnecessary anchor node
                cursor.move(0);
            }

            if (cursorMoved) {
                self.emit(ops.OdtDocument.signalCursorMoved, cursor);
            }
            // Un-equip the Root Filter for this cursor because we are done with it
            rootConstrainedFilter.removeFilter('RootFilter');
        });
    };

    /**
     * Returns the number of walkable positions of a paragraph node
     * @param {!Node} paragraph
     * @return {!number}
     */
    this.getWalkableParagraphLength = function (paragraph) {
        var iterator = getIteratorAtPosition(0),
            length = 0;
        iterator.setUnfilteredPosition(paragraph, 0);

        do {
            if (getParagraphElement(iterator.container()) !== paragraph) {
                return length;
            }
            if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                length += 1;
            }
        } while (iterator.nextPosition());

        return length;
    };

    /**
     * This function calculates the steps in ODF world between the cursor of the
     * given member and the given position in the DOM. If the given position is
     * not walkable, then it will be the number of steps to the last walkable position
     * before the given position from the direction of the cursor.
     * @param {!string} memberid
     * @param {!Node} node
     * @param {!number} offset offset in filtered DOM world
     * @return {!number}
     */
    this.getDistanceFromCursor = function (memberid, node, offset) {
        var counter,
            cursor = cursors[memberid],
            steps = 0;
        runtime.assert((node !== null) && (node !== undefined),
            "OdtDocument.getDistanceFromCursor called without node");
        if (cursor) {
            counter = cursor.getStepCounter().countStepsToPosition;
            steps = counter(node, offset, filter);
        }
        return steps;
    };
    /**
     * This function returns the position in ODF world of the cursor of the member.
     * @param {!string} memberid
     * @return {!number}
     */
    this.getCursorPosition = function (memberid) {
        return -self.getDistanceFromCursor(memberid, getRootNode(), 0);
    };

    /**
     * This function returns the position and selection length in ODF world of
     * the cursor of the member.
     * position is always the number of steps from root node to the anchor node
     * length is the number of steps from anchor node to focus node
     * !IMPORTANT! length is a vector, and may be negative if the cursor selection
     * is reversed (i.e., user clicked and dragged the cursor backwards)
     * @param {!string} memberid
     * @returns {{position: !number, length: !number}}
     */
    this.getCursorSelection = function(memberid) {
        var counter,
            cursor = cursors[memberid],
            focusPosition = 0,
            stepsToAnchor = 0;
        if (cursor) {
            counter = cursor.getStepCounter().countStepsToPosition;
            focusPosition = -counter(getRootNode(), 0, filter);
            stepsToAnchor = counter(cursor.getAnchorNode(), 0, filter);
        }
        return {
            position: focusPosition + stepsToAnchor,
            length: -stepsToAnchor
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
     * @return {!Node}
     */
    this.getRootNode = getRootNode;

    /**
     * @return {!Document}
     */
    this.getDOM = function () {
        return /**@type{!Document}*/(getRootNode().ownerDocument);
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
        var distanceToFirstTextNode = cursor.getStepCounter().countForwardSteps(1, filter),
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
     * @param {!string} metadataId
     * @return {?string}
     */
    this.getMetaData = function (metadataId) {
        var node = odfCanvas.odfContainer().rootElement.firstChild;
        while (node && node.localName !== "meta") {
            node = node.nextSibling;
        }
        node = node && node.firstChild;
        while (node && node.localName !== metadataId) {
            node = node.nextSibling;
        }
        node = node && node.firstChild;
        while (node && node.nodeType !== Node.TEXT_NODE) {
            node = node.nextSibling;
        }
        return node ? node.data : null;
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
     * @param {!string} inputMemberId
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
        filter = new TextPositionFilter();
        odfUtils = new odf.OdfUtils();
        domUtils = new core.DomUtils();
    }
    init();
};

/**@const*/ops.OdtDocument.signalCursorAdded =   "cursor/added";
/**@const*/ops.OdtDocument.signalCursorRemoved = "cursor/removed";
/**@const*/ops.OdtDocument.signalCursorMoved =   "cursor/moved";
/**@const*/ops.OdtDocument.signalParagraphChanged = "paragraph/changed";
/**@const*/ops.OdtDocument.signalTableAdded = "table/added";
/**@const*/ops.OdtDocument.signalCommonStyleCreated = "style/created";
/**@const*/ops.OdtDocument.signalCommonStyleDeleted = "style/deleted";
/**@const*/ops.OdtDocument.signalParagraphStyleModified = "paragraphstyle/modified";
/**@const*/ops.OdtDocument.signalOperationExecuted = "operation/executed";
/**@const*/ops.OdtDocument.signalUndoStackChanged = "undo/changed";

(function () {
    "use strict";
    return ops.OdtDocument;
}());

// vim:expandtab
