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
     * @returns {!boolean}
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
     * Set the position of the iterator.
     * The position can be on an unfiltered, i.e. forbidden, position.
     * If the specified container is forbidden, the iterator will immediately
     * move to the next visible position
     *
     * @param {!Node} container
     * @param {!number} offset offset in unfiltered DOM world
     * @return {!boolean}
     */
    this.setUnfilteredPosition = function (container, offset) {
        var filterResult, node, text;
        runtime.assert((container !== null) && (container !== undefined),
            "PositionIterator.setUnfilteredPosition called without container");
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
            return true;
        }

        filterResult = nodeFilter(container);
        node = container.parentNode;
        while (node && node !== root && filterResult === FILTER_ACCEPT) {
            filterResult = nodeFilter(node);
            if (filterResult !== FILTER_ACCEPT) {
                walker.currentNode = node;
            }
            node = node.parentNode;
        }

        // Need to ensure the container can have children, otherwise the treewalker will happily
        // iterate over the child nodes of the container if started on one of the children
        if (offset < container.childNodes.length && filterResult !== NodeFilter.FILTER_REJECT) {
            walker.currentNode = /**@type{!Node}*/(container.childNodes.item(offset));
            filterResult = nodeFilter(walker.currentNode);
            currentPos = 0; // Assume the current position is ok. Will get modified later if necessary
        } else {
            // Either
            // - the node has no children
            // - or offset === childNodes.length
            // - or the container is rejected.
            // If the container is rejected, this will get modified later regardless, so don't bother checking now
            currentPos = 1;
        }

        if (filterResult === NodeFilter.FILTER_REJECT) {
            // Setting currentPos to 1 indicates iteration on the currentNode is complete.
            // This will cause the subsequent call to self.nextPosition() to jump to the next
            // available sibling or parent
            currentPos = 1;
        }
        if (filterResult !== FILTER_ACCEPT) {
            // The current position is not valid! Move along to the next one that is
            return self.nextPosition();
        }
        runtime.assert(nodeFilter(walker.currentNode) === FILTER_ACCEPT,
            "PositionIterater.setUnfilteredPosition call resulted in an non-visible node being set");
        return true;
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
        walker = /**@type{!HTMLDocument}*/(root.ownerDocument).createTreeWalker(
            root,
            whatToShow,
            /**@type{!NodeFilter}*/(nodeFilter),
            expandEntityReferences
        );

        currentPos = 0;
        if (walker.firstChild() === null) {
            currentPos = 1;
        }
    }
    init();
};
