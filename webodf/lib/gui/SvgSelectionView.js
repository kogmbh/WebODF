/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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
/*global Node, NodeFilter, gui, odf, ops, runtime, core*/

runtime.loadClass("core.Async");
runtime.loadClass("core.DomUtils");
runtime.loadClass("core.ScheduledTask");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("odf.OdfNodeFilter");
runtime.loadClass("gui.SelectionMover");

/**
 *  A GUI class that attaches to a cursor and renders it's selection
 *  as an SVG polygon.
 * @constructor
 * @implements gui.SelectionView
 * @param {!ops.OdtCursor} cursor
 */
gui.SvgSelectionView = function SvgSelectionView(cursor) {
    "use strict";

    var document = cursor.getDocument(),
        documentRoot, // initialized by addOverlay
        /**@type{!Element}*/
        root, // initialized by addOverlays
        doc = document.getDOMDocument(),
        async = new core.Async(),
        svgns = "http://www.w3.org/2000/svg",
        overlay = doc.createElementNS(svgns, 'svg'),
        polygon = doc.createElementNS(svgns, 'polygon'),
        odfUtils = new odf.OdfUtils(),
        domUtils = new core.DomUtils(),
        isVisible = true,
        positionIterator = gui.SelectionMover.createPositionIterator(document.getRootNode()),
        /**@const*/
        FILTER_ACCEPT = NodeFilter.FILTER_ACCEPT,
        /**@const*/
        FILTER_REJECT = NodeFilter.FILTER_REJECT,
        renderTask;

    /**
     * This evil little check is necessary because someone, not mentioning any names *cough*
     * added an extremely hacky undo manager that replaces the root node in order to go back
     * to a prior document state.
     * This makes things very sad, and kills baby kittens.
     * Unfortunately, no-one has had time yet to write a *real* undo stack... so we just need
     * to cope with it for now.
     */
    function addOverlay() {
        var newDocumentRoot = document.getRootNode();
        if (documentRoot !== newDocumentRoot) {
            documentRoot = newDocumentRoot;
            root = /**@type{!Element}*/(documentRoot.parentNode.parentNode.parentNode);
            root.appendChild(overlay);
            overlay.setAttribute('class', 'selectionOverlay');
            overlay.appendChild(polygon);
        }
    }

    /**
     * Takes a rect that is relative to the main viewport, and translates
     * it to be relative to the 'root' rect of the document.
     * Also takes the zoom level into account.
     * @param {!ClientRect|!{top: !number, left: !number, bottom: !number, right: !number, width: !number, height: !number}} rect
     * @return {!{top: !number, left: !number, bottom: !number, right: !number, width: !number, height: !number}}
     */
    function translateRect(rect) {
        var rootRect = domUtils.getBoundingClientRect(root),
            zoomLevel = document.getCanvas().getZoomLevel(),
            resultRect = {};

        resultRect.top = domUtils.adaptRangeDifferenceToZoomLevel(rect.top - rootRect.top, zoomLevel);
        resultRect.left = domUtils.adaptRangeDifferenceToZoomLevel(rect.left  - rootRect.left, zoomLevel);
        resultRect.bottom = domUtils.adaptRangeDifferenceToZoomLevel(rect.bottom - rootRect.top, zoomLevel);
        resultRect.right = domUtils.adaptRangeDifferenceToZoomLevel(rect.right - rootRect.left, zoomLevel);
        resultRect.width = domUtils.adaptRangeDifferenceToZoomLevel(rect.width, zoomLevel);
        resultRect.height = domUtils.adaptRangeDifferenceToZoomLevel(rect.height, zoomLevel);

        return resultRect;
    }

    /**
     * Returns true if the supplied range has 1 or more visible client rectangles.
     * A range might not be visible if it:
     * - contains only hidden nodes
     * - contains only collapsed whitespace (e.g., multiple whitespace characters will only display as 1 character)
     *
     * @param {!Range} range
     * @return {!boolean}
     */
    function isRangeVisible(range) {
        var bcr = range.getBoundingClientRect();
        return Boolean(bcr && bcr.height !== 0);
    }

    /**
     * Set the range to the last visible selection in the text nodes array
     * @param {!Range} range
     * @param {!Array.<!Node>} nodes
     * @return {!boolean}
     */
    function lastVisibleRect(range, nodes) {
        var nextNodeIndex = nodes.length - 1,
            node = nodes[nextNodeIndex],
            startOffset = range.endContainer === node ? range.endOffset : (node.length || node.childNodes.length),
            endOffset = startOffset;
        range.setStart(node, startOffset);
        range.setEnd(node, endOffset);
        while (!isRangeVisible(range)) {
            if (node.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
                // Extending start to cover character node. End offset remains unchanged
                startOffset = 0;
            } else if (node.nodeType === Node.TEXT_NODE && startOffset > 0) {
                // Extending start to include one more text char. End offset remains unchanged
                startOffset -= 1;
            } else if (nodes[nextNodeIndex]) {
                // Moving range to a new node. Start collapsed at last available point
                node = nodes[nextNodeIndex];
                nextNodeIndex -= 1;
                startOffset = endOffset = node.length || node.childNodes.length;
            } else {
                // Iteration complete. No more nodes left to explore
                return false;
            }
            range.setStart(node, startOffset);
            range.setEnd(node, endOffset);
        }
        return true;
    }

    /**
     * Set the range to the first visible selection in the text nodes array
     * @param {!Range} range
     * @param {!Array.<!Node>} nodes
     * @return {!boolean}
     */
    function firstVisibleRect(range, nodes) {
        var nextNodeIndex = 0,
            node = nodes[nextNodeIndex],
            startOffset = range.startContainer === node ? range.startOffset : 0,
            endOffset = startOffset;
        range.setStart(node, startOffset);
        range.setEnd(node, endOffset);
        while (!isRangeVisible(range)) {
            if (node.nodeType === Node.ELEMENT_NODE && endOffset < node.childNodes.length) {
                // Extending end to cover character node. Start offset remains unchanged
                endOffset = node.childNodes.length;
            } else if (node.nodeType === Node.TEXT_NODE && endOffset < node.length) {
                // Extending end to include one more text char. Start offset remains unchanged
                endOffset += 1;
            } else if (nodes[nextNodeIndex]) {
                // Moving range to a new node. Start collapsed at first available point
                node = nodes[nextNodeIndex];
                nextNodeIndex += 1;
                startOffset = endOffset = 0;
            } else {
                // Iteration complete. No more nodes left to explore
                return false;
            }
            range.setStart(node, startOffset);
            range.setEnd(node, endOffset);
        }
        return true;
    }

    /**
     * Returns the 'extreme' ranges for a range.
     * This returns 3 ranges, where the firstRange is attached to the first
     * position in the first text node in the original range,
     * the lastRange is attached to the last text node's last position,
     * and the fillerRange starts at the start of firstRange and ends at the end of
     * lastRange.
     * @param {!Range} range
     * @return {?{firstRange: !Range, lastRange: !Range, fillerRange: !Range}}
     */
    function getExtremeRanges(range) {
        var nodes = odfUtils.getTextElements(range, true, false),
            firstRange = /**@type {!Range}*/(range.cloneRange()),
            lastRange = /**@type {!Range}*/(range.cloneRange()),
            fillerRange = range.cloneRange();

        if (!nodes.length) {
            return null;
        }

        if (!firstVisibleRect(firstRange, nodes)) {
            return null;
        }

        if (!lastVisibleRect(lastRange, nodes)) {
            return null;
        }

        fillerRange.setStart(firstRange.startContainer, firstRange.startOffset);
        fillerRange.setEnd(lastRange.endContainer, lastRange.endOffset);

        return {
            firstRange: firstRange,
            lastRange: lastRange,
            fillerRange: fillerRange
        };
    }

    /**
     * Returns the bounding rectangle of two given rectangles
     * @param {!ClientRect|!{top: !number, left: !number, bottom: !number, right: !number, width: !number, height: !number}} rect1
     * @param {!ClientRect|!{top: !number, left: !number, bottom: !number, right: !number, width: !number, height: !number}} rect2
     * @return {!{top: !number, left: !number, bottom: !number, right: !number, width: !number, height: !number}}
     */
    function getBoundingRect(rect1, rect2) {
        var resultRect = {};
        resultRect.top = Math.min(rect1.top, rect2.top);
        resultRect.left = Math.min(rect1.left, rect2.left);
        resultRect.right = Math.max(rect1.right, rect2.right);
        resultRect.bottom = Math.max(rect1.bottom, rect2.bottom);
        resultRect.width = resultRect.right - resultRect.left;
        resultRect.height = resultRect.bottom - resultRect.top;
        return resultRect;
    }

    /**
     * Checks if the newRect is a collapsed rect, and if it is not,
     * returns the bounding rect of the originalRect and the newRect.
     * If it is collapsed, returns the originalRect.
     * Bad ad-hoc function, but I want to keep the size of the code smaller
     * @param {ClientRect|{top: !number, left: !number, bottom: !number, right: !number, width: !number, height: !number}} originalRect 
     * @param {ClientRect|{top: !number, left: !number, bottom: !number, right: !number, width: !number, height: !number}} newRect
     * @return {?ClientRect|{top: !number, left: !number, bottom: !number, right: !number, width: !number, height: !number}}
     */
    function checkAndGrowOrCreateRect(originalRect, newRect) {
        if (newRect && newRect.width > 0 && newRect.height > 0) {
            if (!originalRect) {
                originalRect = newRect;
            } else {
                originalRect = getBoundingRect(originalRect, newRect);
            }
        }
        return originalRect;
    }

    /**
     * Chrome's implementation of getBoundingClientRect is buggy in that it sometimes
     * includes the ClientRect of a partially covered parent in the bounding rect.
     * Therefore, instead of simply using getBoundingClientRect on the fillerRange,
     * we have to carefully compute our own filler rect.
     * This is done by climbing up the ancestries of both the startContainer and endContainer,
     * to just one level below the commonAncestorContainer. Then, we iterate between the
     * 'firstNode' and 'lastNode' and compute the bounding rect of all the siblings in between.
     * The resulting rect will have the correct width, but the height will be equal or greater than
     * what a correct getBoundingClientRect would give us. This is not a problem though, because
     * we only require the width of this filler rect; the top and bottom of the firstRect and lastRect
     * are enough for the rest.
     * This function also improves upon getBoundingClientRect in another way:
     * it computes the bounding rects of the paragraph nodes between the two ends, instead of the
     * bounding rect of the *range*. This means that unlike gBCR, the bounding rect will not cover absolutely
     * positioned children such as annotation nodes.
     * @param {!Range} fillerRange
     * @return {ClientRect|{top: number, left: number, bottom: number, right: number, width: number, height: number}}
     */
    function getFillerRect(fillerRange) {
        var containerNode = fillerRange.commonAncestorContainer,
            /**@type{!Node}*/
            firstNode = /**@type{!Node}*/(fillerRange.startContainer),
            /**@type{!Node}*/
            lastNode = /**@type{!Node}*/(fillerRange.endContainer),
            firstOffset = fillerRange.startOffset,
            lastOffset = fillerRange.endOffset,
            currentNode,
            lastMeasuredNode,
            firstSibling,
            lastSibling,
            grownRect = null,
            currentRect,
            range = doc.createRange(),
            rootFilter,
            odfNodeFilter = new odf.OdfNodeFilter(),
            treeWalker;

        /**
         * This checks if the node is allowed by the odf filter and the root filter.
         * @param {!Node} node
         * @return {!number}
         */
        function acceptNode(node) {
            positionIterator.setUnfilteredPosition(node, 0);
            if (odfNodeFilter.acceptNode(node) === FILTER_ACCEPT
                    && rootFilter.acceptPosition(positionIterator) === FILTER_ACCEPT) {
                return FILTER_ACCEPT;
            }
            return FILTER_REJECT;
        }

        /**
         * If the node is acceptable, check if the node is a grouping element.
         * If yes, then get it's complete bounding rect (we should use the
         *getBoundingClientRect call on nodes whenever possible, since it is
         * extremely buggy on ranges. This has the added good side-effect of
         * not taking annotations' rects into the bounding rect.
         * @param {!Node} node
         * @return {?ClientRect}
         */
        function getRectFromNodeAfterFiltering(node) {
            var rect = null;
            // If the sibling is acceptable by the odfNodeFilter and the rootFilter,
            // only then take into account it's dimensions
            if (acceptNode(node) === FILTER_ACCEPT) {
                rect = domUtils.getBoundingClientRect(node);
            }
            return rect;
        }


        // If the entire range is for just one node
        // then we can get the bounding rect for the range and be done with it
        if (firstNode === containerNode || lastNode === containerNode) {
            range = fillerRange.cloneRange();
            grownRect = range.getBoundingClientRect();
            range.detach();
            return grownRect;
        }

        // Compute the firstSibling and lastSibling,
        // which are top-level siblings just below the common ancestor node
        firstSibling = firstNode;
        while (firstSibling.parentNode !== containerNode) {
            firstSibling = firstSibling.parentNode;
        }
        lastSibling = lastNode;
        while (lastSibling.parentNode !== containerNode) {
            lastSibling = lastSibling.parentNode;
        }

        // We use a root filter to avoid taking any rects of nodes in other roots
        // into the bounding rect, should it happen that the selection contains
        // nodes from more than one root. Example: Paragraphs containing annotations
        rootFilter = document.createRootFilter(firstNode);

        // Now since this function is called a lot of times,
        // we need to iterate between and not including the
        // first and last top-level siblings (below the common
        // ancestor), and grow our rect from their bounding rects.
        // This is cheap technique, compared to actually iterating
        // over each node in the range.
        currentNode = firstSibling.nextSibling;
        while (currentNode && currentNode !== lastSibling) {
            currentRect = getRectFromNodeAfterFiltering(currentNode);
            grownRect = checkAndGrowOrCreateRect(grownRect, currentRect);
            currentNode = currentNode.nextSibling;
        }

        // If the first top-level sibling is a paragraph, then use it's
        // bounding rect for growing. This is actually not very necessary, but
        // makes our selections look more intuitive and more native-ish.
        // Case in point: If you draw a selection starting on the last (half-full) line of
        // text in a paragraph and ending somewhere in the middle of the first line of
        // the next paragraph, the selection will be only as wide as the distance between
        // the start and end of the selection.
        // This is where we'd prefer full-width selections, therefore using the paragraph
        // width is nicer.
        // We don't need to look deeper into the node, so this is very cheap.
        if (odfUtils.isParagraph(firstSibling)) {
            grownRect = checkAndGrowOrCreateRect(grownRect, domUtils.getBoundingClientRect(firstSibling));
        } else if (firstSibling.nodeType === Node.TEXT_NODE) {
            currentNode = firstSibling;
            range.setStart(currentNode, firstOffset);
            range.setEnd(currentNode, currentNode === lastSibling ? lastOffset : currentNode.length);
            currentRect = range.getBoundingClientRect();
            grownRect = checkAndGrowOrCreateRect(grownRect, currentRect);
        } else {
            // The first top-level sibling was not a paragraph, so we now need to
            // Grow the rect in a detailed manner using the selected area *inside* the first sibling.
            // For that, we start walking over textNodes within the firstSibling,
            // and grow using the the rects of all textnodes that lie including and after the
            // firstNode (the startContainer of the original fillerRange), and stop
            // when either the firstSibling ends or we encounter the lastNode.
            treeWalker = doc.createTreeWalker(firstSibling, NodeFilter.SHOW_TEXT, acceptNode, false);
            currentNode = treeWalker.currentNode = firstNode;
            while (currentNode && currentNode !== lastNode) {
                range.setStart(currentNode, firstOffset);
                range.setEnd(currentNode, currentNode.length);

                currentRect = range.getBoundingClientRect();
                grownRect = checkAndGrowOrCreateRect(grownRect, currentRect);

                // We keep track of the lastMeasuredNode, so that the next block where
                // we iterate backwards can know when to stop.
                lastMeasuredNode = currentNode;
                firstOffset = 0;
                currentNode = treeWalker.nextNode();
            }
        }

        // If there was no lastMeasuredNode, it means that even the firstNode
        // was not iterated over.
        if (!lastMeasuredNode) {
            lastMeasuredNode = firstNode;
        }

        // Just like before, a cheap way to avoid looking deeper into the listSibling
        // if it is a paragraph.
        if (odfUtils.isParagraph(lastSibling)) {
            grownRect = checkAndGrowOrCreateRect(grownRect, domUtils.getBoundingClientRect(lastSibling));
        } else if (lastSibling.nodeType === Node.TEXT_NODE) {
            currentNode = lastSibling;
            range.setStart(currentNode, currentNode === firstSibling ? firstOffset : 0);
            range.setEnd(currentNode, lastOffset);
            currentRect = range.getBoundingClientRect();
            grownRect = checkAndGrowOrCreateRect(grownRect, currentRect);
        } else {
            // Grow the rect using the selected area inside
            // the last sibling, iterating backwards from the lastNode
            // till we reach either the beginning of the lastSibling
            // or encounter the lastMeasuredNode
            treeWalker = doc.createTreeWalker(lastSibling, NodeFilter.SHOW_TEXT, acceptNode, false);
            currentNode = treeWalker.currentNode = lastNode;
            while (currentNode && currentNode !== lastMeasuredNode) {
                range.setStart(currentNode, 0);
                range.setEnd(currentNode, lastOffset);

                currentRect = range.getBoundingClientRect();
                grownRect = checkAndGrowOrCreateRect(grownRect, currentRect);

                currentNode = treeWalker.previousNode();
                if (currentNode) {
                    lastOffset = currentNode.length;
                }
            }
        }

        return grownRect;
    }

    /**
     * Gets the clientRect of a range within a textNode, and
     * collapses the rect to the left or right edge, and returns it
     * @param {!Range} range
     * @param {boolean} useRightEdge
     */
    function getCollapsedRectOfTextRange(range, useRightEdge) {
        var clientRect = range.getBoundingClientRect(),
            collapsedRect = {};

        collapsedRect.width = 0;
        collapsedRect.top = clientRect.top;
        collapsedRect.bottom = clientRect.bottom;
        collapsedRect.height = clientRect.height;
        collapsedRect.left = collapsedRect.right = useRightEdge ? clientRect.right : clientRect.left;
        return collapsedRect;
    }

    /**
     * Resets and grows the polygon from the supplied
     * points.
     * @param {!Array.<{x: !number, y: !number}>} points
     * @return {undefined}
     */
    function setPoints(points) {
        var pointsString = "",
            i;

        for (i = 0; i < points.length; i += 1) {
            pointsString += points[i].x + "," + points[i].y + " ";
        }
        polygon.setAttribute('points', pointsString);
    }

    /**
     * Repositions overlay over the given selected range of the cursor. If the
     * selected range has no visible rectangles (as may happen if the selection only
     * encompasses collapsed whitespace, or does not span any ODT text elements), this
     * function will return false to indicate the overlay element can be hidden.
     *
     * @param {!Range} selectedRange
     * @return {!boolean} Returns true if the selected range is visible (i.e., height +
     *    width are non-zero), otherwise returns false
     */
    function repositionOverlays(selectedRange) {
        var extremes = getExtremeRanges(selectedRange),
            firstRange,
            lastRange,
            fillerRange,
            firstRect,
            fillerRect,
            lastRect,
            left,
            right,
            top,
            bottom;

        // If the range is collapsed (no selection) or no extremes were found, do not show
        // any virtual selections.
        if (extremes) {
            firstRange = extremes.firstRange;
            lastRange = extremes.lastRange;
            fillerRange = extremes.fillerRange;

            firstRect = translateRect(getCollapsedRectOfTextRange(firstRange, false));
            lastRect = translateRect(getCollapsedRectOfTextRange(lastRange, true));
            fillerRect = getFillerRect(fillerRange);

            if (!fillerRect) {
                fillerRect = getBoundingRect(firstRect, lastRect);
            } else {
                fillerRect = translateRect(fillerRect);
            }

            // These are the absolute bounding left, right, top, and bottom coordinates of the
            // entire selection.
            left = fillerRect.left;
            right = firstRect.left + Math.max(0, fillerRect.width - (firstRect.left - fillerRect.left));
            // We will use the topmost 'top' value, because if lastRect.top lies above
            // firstRect.top, then both are most likely on the same line, and font sizes
            // are different, so the selection should be taller.
            top = Math.min(firstRect.top, lastRect.top);
            bottom = lastRect.top + lastRect.height;

            // Now we grow the polygon by adding the corners one by one,
            // and finally we make sure that the last point is the same
            // as the first.

            setPoints([
                { x: firstRect.left,    y: top + firstRect.height   },
                { x: firstRect.left,    y: top                      },
                { x: right,             y: top                      },
                { x: right,             y: bottom - lastRect.height },
                { x: lastRect.right,    y: bottom - lastRect.height },
                { x: lastRect.right,    y: bottom                   },
                { x: left,              y: bottom                   },
                { x: left,              y: top + firstRect.height   },
                { x: firstRect.left,    y: top + firstRect.height   }
            ]);

            firstRange.detach();
            lastRange.detach();
            fillerRange.detach();
        }
        return Boolean(extremes);
    }

    /**
     * Update the visible selection, or hide if it should no
     * longer be visible
     * @return {undefined}
     */
    function rerender() {
        var range = cursor.getSelectedRange(),
            shouldShow;
        shouldShow = isVisible
                        && cursor.getSelectionType() === ops.OdtCursor.RangeSelection
                        && !range.collapsed;
        if (shouldShow) {
            shouldShow = repositionOverlays(range);
        }
        if (shouldShow) {
            overlay.style.display = "block";
            addOverlay();
        } else {
            overlay.style.display = "none";
        }
    }

    /**
     * @inheritDoc
     */
    this.rerender = function() {
        if (isVisible) {
            renderTask.trigger();
        }
    };

    /**
     * @inheritDoc
     */
    this.show = function() {
        isVisible = true;
        renderTask.trigger();
    };

    /**
     * @inheritDoc
     */
    this.hide = function () {
        isVisible = false;
        renderTask.trigger();
    };

    /**
     * @param movedCursor {!gui.ShadowCursor|ops.OdtCursor}
     * @return {undefined}
     */
    function handleCursorMove(movedCursor) {
        if (isVisible && movedCursor === cursor) {
            renderTask.trigger();
        }
    }

    function destroy(callback) {
        root.removeChild(overlay);
        cursor.getDocument().unsubscribe(ops.OdtDocument.signalCursorMoved, handleCursorMove);
        callback();
    }

    /**
     * @inheritDoc
     */
    this.destroy = function (callback) {
        async.destroyAll([renderTask.destroy, destroy], callback);
    };

    function init() {
        var editinfons = 'urn:webodf:names:editinfo',
            memberid = cursor.getMemberId();

        renderTask = new core.ScheduledTask(rerender, 0);
        addOverlay();
        overlay.setAttributeNS(editinfons, 'editinfo:memberid', memberid);
        cursor.getDocument().subscribe(ops.OdtDocument.signalCursorMoved, handleCursorMove);
    }

    init();
};
