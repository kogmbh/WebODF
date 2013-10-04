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

/*global Node, core, ops, runtime, NodeFilter*/
/*jslint bitwise: true*/
/**
 * A collection of Dom utilities
 * @constructor
 */
core.DomUtils = function DomUtils() {
    "use strict";

    /**
     * Find the inner-most child point that is equivalent
     * to the provided container and offset.
     * @param {Node} container
     * @param {!number} offset
     * @returns {{container: Node, offset: !number}}
     */
    function findStablePoint(container, offset) {
        if (offset < container.childNodes.length) {
            container = container.childNodes[offset];
            offset = 0;
            while (container.firstChild) {
                container = container.firstChild;
            }
        } else {
            while (container.lastChild) {
                container = container.lastChild;
                offset = container.nodeType === Node.TEXT_NODE ? container.textContent.length : container.childNodes.length;
            }
        }
        return {container: container, offset: offset};
    }

    /**
     * If either the start or end boundaries of a range start within a text node, this function will split these text nodes
     * and reset the range boundaries to select the new nodes. The end result is that there are no partially contained
     * text nodes within the resulting range.
     * E.g., the text node with selection:
     *  "A|BCD|E"
     * would be split into 3 text nodes, with the range modified to maintain only the completely selected text node:
     *  "A" "|BCD|" "E"
     * @param {!Range} range
     * @returns {!Array.<!Node>} Return a list of nodes modified as a result of this split operation. These are often
     *  processed through DomUtils.normalizeTextNodes after all processing has been complete.
     */
    function splitBoundaries(range) {
        var modifiedNodes = [], end, splitStart;

        if (range.startContainer.nodeType === Node.TEXT_NODE || range.endContainer.nodeType === Node.TEXT_NODE) {
            end = findStablePoint(range.endContainer, range.endOffset);
            // Stable points need to be found to ensure splitting the text node
            // doesn't inadvertently modify the other end of the range
            range.setEnd(end.container, end.offset);

            // Must split end first to stop the start point from being lost
            if (range.endOffset !== 0
                && range.endContainer.nodeType === Node.TEXT_NODE
                && range.endOffset !== range.endContainer.length) {
                modifiedNodes.push(range.endContainer.splitText(range.endOffset));
                modifiedNodes.push(range.endContainer);
                // The end doesn't need to be reset as endContainer & endOffset are still valid after the modification
            }

            if (range.startOffset !== 0
                && range.startContainer.nodeType === Node.TEXT_NODE
                && range.startOffset !== range.startContainer.length) {
                splitStart = range.startContainer.splitText(range.startOffset);
                modifiedNodes.push(range.startContainer);
                modifiedNodes.push(splitStart);
                range.setStart(splitStart, 0);
            }
        }

        return modifiedNodes;
    }
    this.splitBoundaries = splitBoundaries;

    /**
     * Returns true if the container range completely contains the insideRange. Aligned boundaries
     * are counted as inclusion
     * @param {!Range} container
     * @param {!Range} insideRange
     * @returns {boolean}
     */
    function containsRange(container, insideRange) {
        return container.compareBoundaryPoints(container.START_TO_START, insideRange) <= 0
            && container.compareBoundaryPoints(container.END_TO_END, insideRange) >= 0;
    }
    this.containsRange = containsRange;

    /**
     * Returns true if there is any intersection between range1 and range2
     * @param {!Range} range1
     * @param {!Range} range2
     * @returns {boolean}
     */
    function rangesIntersect(range1, range2) {
        return range1.compareBoundaryPoints(range1.END_TO_START, range2) <= 0
            && range1.compareBoundaryPoints(range1.START_TO_END, range2) >= 0;
    }
    this.rangesIntersect = rangesIntersect;

    /**
     * Fetches all nodes within a supplied range that pass the required filter
     * @param {!Range} range
     * @param {!function(!Node) : number} nodeFilter
     * @returns {!Array.<Node>}
     */
    function getNodesInRange(range, nodeFilter) {
        var document = range.startContainer.ownerDocument,
            elements = [],
            root = /**@type{!Node}*/(range.commonAncestorContainer),
            n,
            filterResult,
            treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, nodeFilter, false);

        treeWalker.currentNode = range.startContainer;
        n = range.startContainer;
        while (n) {
            filterResult = nodeFilter(n);
            if (filterResult === NodeFilter.FILTER_ACCEPT) {
                elements.push(n);
            } else if (filterResult === NodeFilter.FILTER_REJECT) {
                break;
            }
            n = n.parentNode;
        }
        // The expected sequence is outer-most to inner-most element, thus, the array just built needs to be reversed
        elements.reverse();

        n = treeWalker.nextNode();
        while (n) {
            elements.push(n);
            n = treeWalker.nextNode();
        }
        return elements;
    }
    this.getNodesInRange = getNodesInRange;

    /**
     * Merges the content of node with nextNode.
     * If node is an empty text node, it will be removed in any case.
     * If nextNode is an empty text node, it will be only removed if node is a text node.
     * @param {!Node} node
     * @param {!Node} nextNode
     * @return {?Node} merged text node or null if there is no text node as result
     */
    function mergeTextNodes(node, nextNode) {
        var mergedNode = null;

        if (node.nodeType === Node.TEXT_NODE) {
            if (node.length === 0) {
                node.parentNode.removeChild(node);
                if (nextNode.nodeType === Node.TEXT_NODE) {
                    mergedNode = nextNode;
                }
            } else {
                if (nextNode.nodeType === Node.TEXT_NODE) {
                    // in chrome it is important to add nextNode to node. doing it the
                    // other way around causes random whitespace to appear
                    node.appendData(nextNode.data);
                    nextNode.parentNode.removeChild(nextNode);
                }
                mergedNode = node;
            }
        }

        return mergedNode;
    }

    /**
     * Attempts to normalize the node with any surrounding text nodes. No
     * actions are performed if the node is undefined, has no siblings, or
     * is not a text node
     * @param {Node} node
     * @return {undefined}
     */
    function normalizeTextNodes(node) {
        if (node && node.nextSibling) {
            node = mergeTextNodes(node, node.nextSibling);
        }
        if (node && node.previousSibling) {
            mergeTextNodes(node.previousSibling, node);
        }
    }
    this.normalizeTextNodes = normalizeTextNodes;

    /**
     * Checks if the provided limits fully encompass the passed in node
     * @param {{startContainer: Node, startOffset: !number, endContainer: Node, endOffset: !number}} limits
     * @param {!Node} node
     * @returns {boolean} Returns true if the node is fully contained within the range
     */
    function rangeContainsNode(limits, node) {
        var range = node.ownerDocument.createRange(),
            nodeLength = node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length,
            result;
        range.setStart(limits.startContainer, limits.startOffset);
        range.setEnd(limits.endContainer, limits.endOffset);
        result = range.comparePoint(node, 0) === 0 && range.comparePoint(node, nodeLength) === 0;
        range.detach();
        return result;
    }
    this.rangeContainsNode = rangeContainsNode;

    /**
     * Merge all child nodes into the targetNode's parent and remove the targetNode entirely
     * @param {Node} targetNode
     * @return {Node} parent of targetNode
     */
    function mergeIntoParent(targetNode) {
        var parent = targetNode.parentNode;
        while (targetNode.firstChild) {
            parent.insertBefore(targetNode.firstChild, targetNode);
        }
        parent.removeChild(targetNode);
        return parent;
    }
    this.mergeIntoParent = mergeIntoParent;

    /**
     * Removes all unwanted nodes from targetNodes includes itself.
     * @param {Node} targetNode
     * @param {function(Node):!boolean} shouldRemove check whether a node should be removed or not
     * @return {Node} parent of targetNode
     */
    function removeUnwantedNodes(targetNode, shouldRemove) {
        var parent = targetNode.parentNode,
            node = targetNode.firstChild,
            next;
        while (node) {
            next = node.nextSibling;
            removeUnwantedNodes(node, shouldRemove);
            node = next;
        }
        if (shouldRemove(targetNode)) {
            parent = mergeIntoParent(targetNode);
        }
        return parent;
    }
    this.removeUnwantedNodes = removeUnwantedNodes;

    /**
     * Get an array of nodes below the specified node with the specific namespace and tag name
     * @param {!Element|!Document} node
     * @param {!string} namespace
     * @param {!string} tagName
     * @returns {!Array.<!Node>}
     */
    function getElementsByTagNameNS(node, namespace, tagName) {
        return Array.prototype.slice.call(node.getElementsByTagNameNS(namespace, tagName));
    }
    this.getElementsByTagNameNS = getElementsByTagNameNS;

    function rangeIntersectsNode(range, node) {
        var nodeLength = node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length;
        return range.comparePoint(node, 0) <= 0 && range.comparePoint(node, nodeLength) >= 0;
    }
    this.rangeIntersectsNode = rangeIntersectsNode;

    /**
     * Whether a node contains another node
     * @param {!Node} parent The node that should contain the other node
     * @param {?Node} descendant The node to test presence of
     * @return {!boolean}
     */
    function containsNode(parent, descendant) {
        return parent === descendant || parent.contains(descendant);
    }
    this.containsNode = containsNode;

    /**
     * Calculate node offset in unfiltered DOM world
     * @param {!Node} node
     * @param {!Node} container
     * @return {!number}
     */
    function getPositionInContainingNode(node, container) {
        var offset = 0,
            n;
        while (node.parentNode !== container) {
            runtime.assert(node.parentNode !== null, "parent is null");
            node = /**@type{!Node}*/(node.parentNode);
        }
        n = container.firstChild;
        while (n !== node) {
            offset += 1;
            n = n.nextSibling;
        }
        return offset;
    }
    /**
     * Return a number > 0 when point 1 precedes point 2. Return 0 if the points
     * are equal. Return < 0 when point 2 precedes point 1.
     * @param {!Node} c1 container of point 1
     * @param {!number} o1  offset in unfiltered DOM world of point 1
     * @param {!Node} c2 container of point 2
     * @param {!number} o2  offset in unfiltered DOM world of point 2
     * @return {!number}
     */
    function comparePoints(c1, o1, c2, o2) {
        if (c1 === c2) {
            return o2 - o1;
        }
        var comparison = c1.compareDocumentPosition(c2);
        if (comparison === 2) { // DOCUMENT_POSITION_PRECEDING
            comparison = -1;
        } else if (comparison === 4) { // DOCUMENT_POSITION_FOLLOWING
            comparison = 1;
        } else if (comparison === 10) { // DOCUMENT_POSITION_CONTAINS
            // c0 contains c2
            o1 = getPositionInContainingNode(c1, c2);
            comparison = (o1 < o2) ? 1 : -1;
        } else { // DOCUMENT_POSITION_CONTAINED_BY
            o2 = getPositionInContainingNode(c2, c1);
            comparison = (o2 < o1) ? -1 : 1;
        }
        return comparison;
    }
    this.comparePoints = comparePoints;

    /**
     * Whether a node contains another node
     * @param {!Node} parent The node that should contain the other node
     * @param {?Node} descendant The node to test presence of
     * @return {!boolean}
     */
    function containsNodeForBrokenWebKit(parent, descendant) {
        // the contains function is not reliable on safari/webkit so use compareDocumentPosition instead
        return parent === descendant ||
            Boolean(parent.compareDocumentPosition(descendant) & Node.DOCUMENT_POSITION_CONTAINED_BY);
    }

    function init(self) {
        var /**@type{?Window}*/window = runtime.getWindow(),
            appVersion, webKitOrSafari;
        if (window === null) {
            return;
        }

        appVersion = window.navigator.appVersion.toLowerCase();
        webKitOrSafari = appVersion.indexOf('chrome') === -1
            && (appVersion.indexOf('applewebkit') !== -1 || appVersion.indexOf('safari') !== -1);

        if (webKitOrSafari) {
            self.containsNode = containsNodeForBrokenWebKit;
        }
    }
    init(this);
};
