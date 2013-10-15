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
/*global Node, core, ops, runtime*/

runtime.loadClass("core.DomUtils");

/**
 * @class
 * A cursor is a dom node that visually represents a cursor in a DOM tree.
 * It should stay synchronized with the selection in the document. When
 * there is only one collapsed selection range, a cursor should be shown at
 * that point.
 *
 * Putting the cursor in the DOM tree modifies the DOM, so care should be taken
 * to keep the selection consistent. If e.g. a selection is drawn over the
 * cursor, and the cursor is updated to the selection, the cursor is removed
 * from the DOM because the selection is not collapsed. This means that the
 * offsets of the selection may have to be changed.
 *
 * When the selection is collapsed, the cursor is placed after the point of the
 * selection and the selection will stay valid. However, if the cursor was
 * placed in the DOM tree and was counted in the offset, the offset in the
 * selection should be decreased by one.
 *
 * Even when the selection allows for a cursor, it might be desireable to hide
 * the cursor by not letting it be part of the DOM.
 *
 * @constructor
 * @param {!Document} document  The DOM document in which the cursor is placed
 * @param {!string} memberId The memberid this cursor is assigned to
 */
core.Cursor = function Cursor(document, memberId) {
    "use strict";
    var cursorns = 'urn:webodf:names:cursor',
        /**@type{!Element}*/
        cursorNode = document.createElementNS(cursorns, 'cursor'),
        /**@type{!Element}*/
        anchorNode = document.createElementNS(cursorns, 'anchor'),
        forwardSelection,
        recentlyModifiedNodes = [],
        selectedRange,
        isCollapsed,
        domUtils = new core.DomUtils();

    /**
     * Split a text node and put the cursor into it.
     * @param {!Node} node
     * @param {!Text} container
     * @param {!number} offset
     * @return {undefined}
     */
    function putIntoTextNode(node, container, offset) {
        runtime.assert(Boolean(container), "putCursorIntoTextNode: invalid container");
        var parent = container.parentNode;
        runtime.assert(Boolean(parent), "putCursorIntoTextNode: container without parent");
        runtime.assert(offset >= 0 && offset <= container.length, "putCursorIntoTextNode: offset is out of bounds");

        if (offset === 0) {
            parent.insertBefore(node, container);
        } else if (offset === container.length) {
            parent.insertBefore(node, container.nextSibling);
        } else {
            container.splitText(offset);
            parent.insertBefore(node, container.nextSibling);
        }
    }
    /**
     * @param {!Node} node
     * @param {!Element} container
     * @param {!number} offset
     * @return {undefined}
     */
    function putIntoContainer(node, container, offset) {
        runtime.assert(Boolean(container), "putCursorIntoContainer: invalid container");
        var n = container.firstChild;
        while (n !== null && offset > 0) {
            n = n.nextSibling;
            offset -= 1;
        }
        container.insertBefore(node, n);
    }
    /**
     * Remove the cursor from the tree.
     * @param {!Element} node
     */
    function removeNode(node) {
        if (node.parentNode) {
            recentlyModifiedNodes.push(node.previousSibling);
            recentlyModifiedNodes.push(node.nextSibling);
            node.parentNode.removeChild(node);
        }
    }

    /**
     * Put the cursor at a particular position.
     * @param {!Node} node
     * @param {!Node} container
     * @param {!number} offset
     * @return {undefined}
     */
    function putNode(node, container, offset) {
        var text, element;
        if (container.nodeType === Node.TEXT_NODE) {
            text = /**@type{!Text}*/(container);
            putIntoTextNode(node, text, offset);
        } else if (container.nodeType === Node.ELEMENT_NODE) {
            element = /**@type{!Element}*/(container);
            putIntoContainer(node, element, offset);
        }
        recentlyModifiedNodes.push(node.previousSibling);
        recentlyModifiedNodes.push(node.nextSibling);
    }

    /**
     * Gets the earliest selection node in the document
     * @returns {!Node}
     */
    function getStartNode() {
        return forwardSelection ? anchorNode : cursorNode;
    }

    /**
     * Gets the latest selection node in the document
     * @returns {!Node}
     */
    function getEndNode() {
        return forwardSelection ? cursorNode : anchorNode;
    }
    /**
     * Obtain the node representing the cursor. This is
     * the selection end point
     * @return {!Element}
     */
    this.getNode = function () {
        return cursorNode;
    };
    /**
     * Obtain the node representing the selection start point.
     * If a 0-length range is selected (e.g., by clicking without
     * dragging),, this will return the exact same node as getNode
     * @returns {!Element}
     */
    this.getAnchorNode = function() {
        return anchorNode.parentNode ? anchorNode : cursorNode;
    };
    /**
     * Obtain the selection to which the cursor corresponds.
     * @return {?Range}
     */
    this.getSelectedRange = function () {
        if (isCollapsed) {
            selectedRange.setStartBefore(cursorNode);
            selectedRange.collapse(true);
        } else {
            selectedRange.setStartAfter(getStartNode());
            selectedRange.setEndBefore(getEndNode());
        }

        return selectedRange;
    };
    /**
     * Synchronize the cursor to a specific range
     * If there is a single collapsed selection range, the cursor will be placed
     * there. If not, the cursor will be removed from the document tree.
     * @param {!Range} range
     * @param {boolean=} isForwardSelection Set to true to indicate the direction of the
     *                          range is startContainer => endContainer. This should be false if
     *                          the user creates a selection that ends before it starts in the document (i.e.,
     *                          drags the range backwards from the start point)
     * @return {undefined}
     */
    this.setSelectedRange = function (range, isForwardSelection) {
        if (selectedRange && selectedRange !== range) {
            selectedRange.detach();
        }
        selectedRange = range;
        forwardSelection = isForwardSelection !== false;
        isCollapsed = range.collapsed;

        // TODO the nodes need to be added and removed in the right order to preserve the range
        if (range.collapsed) {
            removeNode(anchorNode);
            removeNode(cursorNode);
            putNode(cursorNode, /**@type {!Node}*/(range.startContainer), range.startOffset);
        } else {
            removeNode(anchorNode);
            removeNode(cursorNode);
            // putting in the end node first eliminates the chance the position of the start node is destroyed
            putNode(getEndNode(), /**@type {!Node}*/(range.endContainer), range.endOffset);
            putNode(getStartNode(), /**@type {!Node}*/(range.startContainer), range.startOffset);
        }
        recentlyModifiedNodes.forEach(domUtils.normalizeTextNodes);
        recentlyModifiedNodes.length = 0;
    };
    /**
     * Returns if the selection of this cursor has the
     * same direction as the direction of the range
     * @return {boolean}
     */
    this.hasForwardSelection = function () {
        return forwardSelection;
    };
    /**
     * Remove the cursor from the document tree.
     * @return {undefined}
     */
    this.remove = function () {
        removeNode(cursorNode);
        recentlyModifiedNodes.forEach(domUtils.normalizeTextNodes);
        recentlyModifiedNodes.length = 0;
    };

    function init() {
        // mark cursornode with memberid
        cursorNode.setAttributeNS(cursorns, "memberId", memberId);
        anchorNode.setAttributeNS(cursorns, "memberId", memberId);
    }

    init();
};
