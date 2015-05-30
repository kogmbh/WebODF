/**
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
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

/*global Node, NodeFilter, runtime, core*/

/**
 * An iterator that iterators through positions in a DOM tree.
 * Positions in the DOM tree are places between nodes and between characters.
 * Undesired positions can be avoided by passing a filter to constructor of the
 * PositionIterator.
 * In the following example '|' designates positions that an unfiltered
 * PositionIterator would visit.
 *
 *  <a>|<b>|<c>|a|b|</c>|a|<a>|</a>|</b>|</a>
 *
 * Certain positions are considered equivalent in by the PositionIterator.
 * Position 0 in a Text node is the same as the position preceding the Text node
 * in the parent node. The last position in a Text node is considered equal to
 * the subsequent position in the parent node. As such, these two Text node
 * positions are ommitted from the PositionIterator's traversal throught the
 * DOM. If the PositionIterator is set to a first or last position in a Text
 * node, it is instead set the equivalent position in the parent node.
 * Omitting the first and last Text node positions serves two functions:
 *  - It ensures that the number of iterated steps is independent of how
 *    characters are split up over text nodes.
 *  - The iterator avoids positions that not distinguised by the API for
 *    range and selections purposes.
 *
 *
 * @constructor
 * @param {!Node} root
 * @param {!number=} whatToShow
 * @param {!NodeFilter=} filter
 * @param {!boolean=} expandEntityReferences
 */
core.PositionIterator = function PositionIterator(root, whatToShow, filter,
        expandEntityReferences) {
    "use strict";
    /*
     * Implementation notes.
     * The position of the positioniterator is defined by two internal
     * variables: walker and currentPos. The walker is an instance of TreeWalker
     * which has a member called currentNode of type Node.
     * Since the implementation uses a Node and an offset, it is comparable to
     * the parameters that go into Range and Selection related functions.
     * If the currentNode is a Text node, the variable currentPos gives the
     * offset in the node.
     * If the currentNode is an Element node, the variable currentPos can only
     * have the values 0 or 1. The value 0 means that the iterator is at the
     * position just before the currentNode. A value of 1 means that the
     * iterator is at the last position inside the currentNode.
     */
    var self = this,
        /**@type{!TreeWalker}*/
        walker,
        /**@type{!number}*/
        currentPos,
        /**@type{!function(?Node):!number}*/
        nodeFilter,
        TEXT_NODE = Node.TEXT_NODE,
        ELEMENT_NODE = Node.ELEMENT_NODE,
        FILTER_ACCEPT = NodeFilter.FILTER_ACCEPT,
        FILTER_REJECT = NodeFilter.FILTER_REJECT;

    /**
     * Empty text nodes are not considered to be a valid position for the
     * positioniterator. They should be filtered out in all cases.
     * @constructor
     * @implements NodeFilter
     */
    function EmptyTextNodeFilter() {
        /**
         * @param {?Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            var text = /**@type{!Text}*/(node);
            if (!node || (node.nodeType === TEXT_NODE && text.length === 0)) {
                return FILTER_REJECT;
            }
            return FILTER_ACCEPT;
        };
    }
    /**
     * @constructor
     * @implements NodeFilter
     * @param {!NodeFilter} filter
     */
    function FilteredEmptyTextNodeFilter(filter) {
        /**
         * @param {?Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            var text = /**@type{!Text}*/(node);
            if (!node || (node.nodeType === TEXT_NODE && text.length === 0)) {
                return FILTER_REJECT;
            }
            return filter.acceptNode(node);
        };
    }

    /**
     * @return {!boolean}
     */
    this.nextPosition = function () {
        var currentNode = walker.currentNode,
            nodeType = currentNode.nodeType,
            text = /**@type{!Text}*/(currentNode);
        if (currentNode === root) {
            return false;
        }
        if (currentPos === 0 && nodeType === ELEMENT_NODE) {
            // step inside an element
            if (walker.firstChild() === null) {
                currentPos = 1;
            }
        } else if (nodeType === TEXT_NODE
                && currentPos + 1 < text.length) {
            // advance inside a text node
            currentPos += 1;
        } else {
            if (walker.nextSibling() !== null) {
                currentPos = 0;
            } else if (walker.parentNode()) {
                currentPos = 1;
            } else {
                return false;
            }
        }
        return true;
    };
    function setAtEnd() {
        var text = /**@type{!Text}*/(walker.currentNode),
            type = text.nodeType;
        if (type === TEXT_NODE) {
            currentPos = text.length - 1;
        } else {
            currentPos = (type === ELEMENT_NODE) ? 1 : 0;
        }
    }
    /**
     * @return {!boolean}
     */
    function previousNode() {
        if (walker.previousSibling() === null) {
            if (!walker.parentNode() || walker.currentNode === root) {
                walker.firstChild();
                return false;
            }
            currentPos = 0;
        } else {
            setAtEnd();
        }
        return true;
    }
    /**
     * Move the iterator to the previous position.
     * If the iterator is already at the first position, it is not moved and
     * false is returned instead of true.
     * @return {!boolean}
     */
    this.previousPosition = function () {
        var moved = true,
            currentNode = walker.currentNode;
        if (currentPos === 0) {
            moved = previousNode();
        } else if (currentNode.nodeType === TEXT_NODE) {
            currentPos -= 1;
        } else if (walker.lastChild() !== null) {
            setAtEnd();
        } else if (currentNode === root) {
            moved = false;
        } else {
            currentPos = 0;
        }
        return moved;
    };
    /**
     * This function exposes class internals and should be avoided.
     */
    this.previousNode = previousNode;
    /**
     * Return the container for the current position.
     * @return {!Element|!Text}
     */
    this.container = function () {
        var n = /**@type{!Element|!Text}*/(walker.currentNode),
            t = n.nodeType;
        if (currentPos === 0 && t !== TEXT_NODE) {
            n = /**@type{!Element|!Text}*/(n.parentNode);
        }
        return n;
    };
    /**
     * Return the node to the right of the current iterator position.
     * If the iterator is placed between two characters in a text node,
     * the text node will be returned.
     * If there is no right neighbor in the container node, then null is
     * returned.
     * Only filtered nodes will be returned.
     * @return {?Node}
     */
    this.rightNode = function () {
        var n = walker.currentNode,
            text = /**@type{!Text}*/(n),
            nodeType = n.nodeType;
        if (nodeType === TEXT_NODE && currentPos === text.length) {
            n = n.nextSibling;
            while (n && nodeFilter(n) !== FILTER_ACCEPT) {
                n = n.nextSibling;
            }
        } else if (nodeType === ELEMENT_NODE && currentPos === 1) {
            n = null;
        }
        return n;
    };
    /**
     * Return the node to the left of the current iterator position.
     * See rightNode().
     * @return {?Node}
     */
    this.leftNode = function () {
        var n = walker.currentNode;
        if (currentPos === 0) {
            n = n.previousSibling;
            while (n && nodeFilter(n) !== FILTER_ACCEPT) {
                n = n.previousSibling;
            }
        } else if (n.nodeType === ELEMENT_NODE) {
            n = n.lastChild;
            while (n && nodeFilter(n) !== FILTER_ACCEPT) {
                n = n.previousSibling;
            }
        }
        return n;
    };
    /**
     * This function exposes class internals and should be avoided.
     * @return {!Element|!Text}
     */
    this.getCurrentNode = function () {
        var n = /**@type{!Element|!Text}*/(walker.currentNode);
        return n;
    };
    /**
     * Returns the current position within the container of the iterator.
     * This function is useful for communication iterator position with
     * components that do not use a filter.
     * @return {!number}
     */
    this.unfilteredDomOffset = function () {
        if (walker.currentNode.nodeType === TEXT_NODE) {
            return currentPos;
        }
        var c = 0,
            n = walker.currentNode;
        if (currentPos === 1) {
            n = n.lastChild;
        } else {
            n = n.previousSibling;
        }
        while (n) {
            c += 1;
            n = n.previousSibling;
        }
        return c;
    };
    /**
     * Return the previous sibling of the current node
     * @return {Node}
     */
    this.getPreviousSibling = function () {
        var currentNode = walker.currentNode,
            sibling = walker.previousSibling();

        walker.currentNode = currentNode;

        return sibling;
    };
    /**
     * Return the next sibling of the current node
     * @return {Node}
     */
    this.getNextSibling = function () {
        var currentNode = walker.currentNode,
            sibling = walker.nextSibling();

        walker.currentNode = currentNode;

        return sibling;
    };

    /**
     * Advance the walker to the first node that is accepted by the node filter
     * (i.e., nodeFilter(node) === FILTER_ACCEPT)
     *
     * @return {!boolean} Returns true if the walker found an accepted node. Otherwise
     * returns false.
     */
    function moveToAcceptedNode() {
        var node = walker.currentNode,
            filterResult,
            moveResult;

        // Ensure currentNode is not within a rejected subtree by crawling each parent node
        // up to the root and verifying it is either accepted or skipped by the nodeFilter.
        // NOTE: The root is deliberately not checked as it is the container iteration happens within.
        filterResult = nodeFilter(node);
        if (node !== root) {
            node = node.parentNode;
            while (node && node !== root) {
                if (nodeFilter(node) === FILTER_REJECT) {
                    walker.currentNode = node;
                    filterResult = FILTER_REJECT;
                }
                node = node.parentNode;
            }
        }

        if (filterResult === FILTER_REJECT) {
            // Set currentPos to be 1 (or text data.length), so nextPosition will jump to the next sibling or parent
            currentPos = walker.currentNode.nodeType === TEXT_NODE ? /**@type{!Text}*/(node).length : 1;
            moveResult = self.nextPosition();
        } else if (filterResult === FILTER_ACCEPT) {
            moveResult = true;
        } else {
            // filterResult === FILTER_SKIP
            // FILTER_SKIP indicates children of the current node are acceptable.
            // currentPos is left unchanged as nextPosition can advance to an accepted child inside the node
            moveResult = self.nextPosition();
        }
        if (moveResult) {
            runtime.assert(nodeFilter(walker.currentNode) === FILTER_ACCEPT,
                "moveToAcceptedNode did not result in walker being on an accepted node");
        }
        return moveResult;
    }

    /**
     * Set the current position of the iterator to just before the supplied element.
     *
     * Querying the iterator then will return the container of the element and the offset
     * of the element within it's container (assuming the supplied element is accepted by
     * the nodeFilter).
     *
     * E.g.,
     * p1.setPositionBeforeElement(span);
     * p1.container() === span.parentNode
     * p1.unfilteredDomOffset === positionInParent(span)
     *
     * If the element is not accepted by the nodeFilter, the iterator will immediately
     * move to the next accepted node.
     *
     * @param {!Element} element
     * @return {!boolean} Returns true if the iterator was set to a valid position
     * (i.e., is currently on a node that is accepted by the nodeFilter)
     */
    this.setPositionBeforeElement = function (element) {
        runtime.assert(Boolean(element), "setPositionBeforeElement called without element");
        walker.currentNode = element;
        currentPos = 0;

        return moveToAcceptedNode();
    };

    /**
     * Set the current position of the iterator to the specified container + offset.
     *
     * Querying the iterator will then return the supplied container + offset
     * (assuming the supplied element is accepted by the nodeFilter).
     *
     * E.g.,
     * p2.setUnfilteredPosition(container, offset);
     * p2.container() === container
     * p2.unfilteredDomOffset() === offset;
     *
     * If the container is not accepted by the nodeFilter, the iterator will immediately
     * move to the next accepted node.
     *
     * @param {!Node} container
     * @param {!number} offset offset in unfiltered DOM world. Will immediately advance
     * the iterator to the numbered child node of the provided container.
     * @return {!boolean} Returns true if the iterator was set to a valid position
     * (i.e., is currently on a node that is accepted by the nodeFilter)
     */
    this.setUnfilteredPosition = function (container, offset) {
        var text;
        runtime.assert(Boolean(container), "PositionIterator.setUnfilteredPosition called without container");
        walker.currentNode = container;
        if (container.nodeType === TEXT_NODE) {
            currentPos = offset;
            text = /**@type{!Text}*/(container);
            runtime.assert(offset <= text.length, "Error in setPosition: " +
                offset + " > " + text.length);
            runtime.assert(offset >= 0, "Error in setPosition: " +
                offset + " < 0");
            if (offset === text.length) {
                if (walker.nextSibling()) {
                    currentPos = 0;
                } else if (walker.parentNode()) {
                    currentPos = 1;
                } else {
                    runtime.assert(false, "Error in setUnfilteredPosition: position not valid.");
                }
            }
        } else if (offset < container.childNodes.length) {
            // Immediately advance to the child node at that offset to begin iteration.
            // This is necessary in order to satisfy the most frequent use case where developer will
            // store the (container, unfilteredDomOffset) from a previous position iterator, and use
            // this value to resume iteration at the specified point. If we didn't immediately advance
            // to the next position, the first call to nextPosition would return the input container+offset.
            walker.currentNode = /**@type{!Node}*/(container.childNodes.item(offset));
            currentPos = 0;
        } else {
            // Either the node has no children or offset === childNodes.length

            // Set currentPos to 1 to indicate iteration on the currentNode is complete.
            // This will cause the next call to self.nextPosition() to jump to the next
            // available sibling or parent
            currentPos = 1;
        }

        return moveToAcceptedNode();
    };
    /**
     * Move the iterator to its last possible position.
     * This is at the last position in the root node if the iterator.
     * @return {undefined}
     */
    this.moveToEnd = function () {
        walker.currentNode = root;
        currentPos = 1;
    };

    /**
     * Places the iterator at the last position inside the given node.
     * @param {!Node} node
     * @return {undefined}
     */
    this.moveToEndOfNode = function (node) {
        var text;
        if (node.nodeType === TEXT_NODE) {
            text = /**@type{!Text}*/(node);
            self.setUnfilteredPosition(text, text.length);
        } else {
            walker.currentNode = node;
            currentPos = 1;
        }
    };

    /**
     * Returns true if the iterator is just to the left of a node. In this position,
     * calls to container() will return the parent of the node, and unfilteredDomOffset
     * will return the position of the node within the parent container.
     *
     * Calls to unfilteredDomOffset are extremely slow when the iterator is just before a
     * node, so querying this method can provide warning when a slow offset is necessary.
     * @return {!boolean}
     */
    this.isBeforeNode = function() {
        return currentPos === 0;
    };

    /**
     * Return the filter that is used in this iterator.
     * @return {!function(?Node):!number}
     */
    this.getNodeFilter = function () {
        return nodeFilter;
    };

    function init() {
        var f;
        // a position can never be near an empty TextNode. A NodeFilter is the
        // easiest way of filtering out these nodes.
        if (filter) {
            f = new FilteredEmptyTextNodeFilter(filter);
        } else {
            f = new EmptyTextNodeFilter();
        }
        // workaround for versions of createTreeWalker that need a function
        // instead of an object with a function such as IE 9 and older webkits
        nodeFilter = /**@type {!function(?Node):!number}*/(f.acceptNode);
        nodeFilter.acceptNode = nodeFilter;
        whatToShow = whatToShow || NodeFilter.SHOW_ALL;
        runtime.assert(root.nodeType !== Node.TEXT_NODE, "Internet Explorer doesn't allow tree walker roots to be text nodes");
        walker = root.ownerDocument.createTreeWalker(root, whatToShow,
                nodeFilter, expandEntityReferences);

        currentPos = 0;
        if (walker.firstChild() === null) {
            currentPos = 1;
        }
    }
    init();
};
