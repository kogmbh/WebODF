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

/*global ops, runtime, odf, core, Node, NodeFilter*/

runtime.loadClass("odf.Namespaces");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("core.DomUtils");

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpRemoveText = function OpRemoveText() {
    "use strict";

    var memberid, timestamp,
        /**@type {number}*/
        position,
        /**@type {number}*/
        length,
        odfUtils,
        domUtils,
        editinfons = 'urn:webodf:names:editinfo';

    this.init = function (data) {
        runtime.assert(data.length >= 0, "OpRemoveText only supports positive lengths");
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = parseInt(data.position, 10);
        length = parseInt(data.length, 10);
        odfUtils = new odf.OdfUtils();
        domUtils = new core.DomUtils();
    };

    /**
     * Defines a set of rules for how elements can be collapsed based on whether they contain ODT content (e.g.,
     * text or character elements).
     * @param {!Node} rootNode Root text element of the odtDocument
     * @constructor
     */
    function CollapsingRules(rootNode) {
        /**
         * Returns true if the supplied node contains no text or ODF character elements
         * @param {Node} node
         * @returns {boolean}
         */
        function isEmpty(node) {
            var childNode;
            if (odfUtils.isCharacterElement(node)) {
                return false;
            }
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent.length === 0;
            }
            childNode = node.firstChild;
            while (childNode) {
                if (!isEmpty(childNode)) {
                    return false;
                }
                childNode = childNode.nextSibling;
            }
            return true;
        }
        this.isEmpty = isEmpty;

        /**
         * Returns true if the supplied node should be automatically collapsed (i.e., removed) if it contains no
         * text or ODF character elements. The only element that should always be kept is a paragraph element.
         * Paragraph elements can only be deleted through merging
         * @param node
         * @returns {boolean}
         */
        function isCollapsibleContainer(node) {
            return !odfUtils.isParagraph(node) && node !== rootNode && isEmpty(node);
        }

        /**
         * Merge all child nodes into the node's parent and remove the node entirely
         * @param {Node} node Node to merge into parent
         * @return {!Node} Final parent node collapsing ended at
         */
        function mergeChildrenIntoParent(node) {
            var parent = domUtils.mergeIntoParent(node);
            if (isCollapsibleContainer(parent)) {
                return mergeChildrenIntoParent(parent);
            }
            return parent;
        }
        this.mergeChildrenIntoParent = mergeChildrenIntoParent;
    }

    /**
     * Merges the 'second' paragraph into the 'first' paragraph.
     * If the first paragraph is empty, it will be replaced by the second
     * paragraph instead (all non-odt elements will be migrated however).
     * @param {!Node} first Paragraph to merge content into
     * @param {!Node} second Paragraph to merge content from
     * @param collapseRules
     * @return {!Node} Destination paragraph
     */
    function mergeParagraphs(first, second, collapseRules) {
        var child,
            mergeForward,
            destination = first,
            source = second,
            secondParent,
            insertionPoint;

        if (collapseRules.isEmpty(first)) {
            mergeForward = true;
            if (second.parentNode !== first.parentNode) {
                // We're just about to move the second paragraph in to the right position for the merge.
                // Therefore, we need to remember if the second paragraph is from a different parent in order to clean
                // it up afterwards
                secondParent = second.parentNode;
                first.parentNode.insertBefore(second, first.nextSibling);
            }
            source = first;
            destination = second;
            insertionPoint = destination.getElementsByTagNameNS(editinfons, 'editinfo')[0] || destination.firstChild;
        }

        while (source.hasChildNodes()) {
            child = mergeForward ? source.lastChild : source.firstChild;
            source.removeChild(child);
            if (child.localName !== 'editinfo') {
                destination.insertBefore(child, insertionPoint);
            }
        }

        if (secondParent && collapseRules.isEmpty(secondParent)) {
            // Make sure the second paragraph's original parent is checked to see if it can be cleaned up too
            collapseRules.mergeChildrenIntoParent(secondParent);
        }
        // All children have been migrated, now consume up the source parent chain
        collapseRules.mergeChildrenIntoParent(source);
        return destination;
    }

    function stepsToRange(odtDocument) {
        var iterator,
            filter = odtDocument.getPositionFilter(),
            startContainer, startOffset,
            endContainer, endOffset,
            remainingLength = length,
            range = odtDocument.getDOM().createRange();

        iterator = odtDocument.getIteratorAtPosition(position);
        startContainer = iterator.container();
        startOffset = iterator.unfilteredDomOffset();
        while (remainingLength && iterator.nextPosition()) {
            endContainer = iterator.container();
            endOffset = iterator.unfilteredDomOffset();
            if (filter.acceptPosition(iterator) === NodeFilter.FILTER_ACCEPT) {
                remainingLength -= 1;
            }
        }

        range.setStart(startContainer, startOffset);
        range.setEnd(endContainer, endOffset);
        domUtils.splitBoundaries(range);
        return range;
    }

    this.execute = function (odtDocument) {
        var paragraphElement,
            destinationParagraph,
            range,
            textNodes,
            paragraphs,
            collapseRules = new CollapsingRules(odtDocument.getRootNode());

        odtDocument.upgradeWhitespacesAtPosition(position);
        odtDocument.upgradeWhitespacesAtPosition(position + length);

        range = stepsToRange(odtDocument);
        paragraphElement = odtDocument.getParagraphElement(range.startContainer);
        textNodes = odtDocument.getTextElements(range, true);
        paragraphs = odtDocument.getParagraphElements(range);
        range.detach();

        // Each character element is fully contained within the range, so will be completely removed
        textNodes.forEach(function (element) {
            collapseRules.mergeChildrenIntoParent(element);
        });

        destinationParagraph = paragraphs.reduce(function (destination, paragraph) {
            return mergeParagraphs(destination, paragraph, collapseRules);
        });

        odtDocument.downgradeWhitespacesAtPosition(position);
        odtDocument.fixCursorPositions();
        odtDocument.getOdfCanvas().refreshSize();
        // TODO: signal also the deleted paragraphs, so e.g. SessionView can clean up the EditInfo
        odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
            paragraphElement: destinationParagraph || paragraphElement,
            memberId: memberid,
            timeStamp: timestamp
        });
        odtDocument.emit(ops.OdtDocument.signalCursorMoved, odtDocument.getCursor(memberid));

        odtDocument.getOdfCanvas().rerenderAnnotations();
        return true;
    };

    this.spec = function () {
        return {
            optype: "RemoveText",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length
        };
    };

};
