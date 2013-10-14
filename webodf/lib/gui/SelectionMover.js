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
/*global Node, NodeFilter, runtime, core, gui, odf, XMLSerializer*/
runtime.loadClass("core.Cursor");
runtime.loadClass("core.DomUtils");
runtime.loadClass("core.PositionIterator");
runtime.loadClass("core.PositionFilter");
runtime.loadClass("core.LoopWatchDog");
runtime.loadClass("odf.OdfUtils");

/**
 * This class modifies the selection in different ways.
 * @constructor
 * @param {core.Cursor} cursor
 * @param {!Node} rootNode
 */
gui.SelectionMover = function SelectionMover(cursor, rootNode) {
    "use strict";
    var odfUtils,
        domUtils,
        positionIterator,
        cachedXOffset,
        timeoutHandle,
        /**@const*/FILTER_ACCEPT = core.PositionFilter.FilterResult.FILTER_ACCEPT;

    /**
     * Resets the positionIterator back to the current cursor position and
     * returns the iterator.
     * @return {!core.PositionIterator}
     */
    function getIteratorAtCursor() {
        // This call relies on setUnfilteredPosition magic. After this call, the
        // iterator position will be just after the cursor because a position
        // in the cursor is not allowed. So this only works because the filter
        // in this instance of PositionIterator disallows positions in the
        // cursor.
        positionIterator.setUnfilteredPosition(cursor.getNode(), 0);
        return positionIterator;
    }

    /**
     * Gets the maximum available offset for a given node. For a text node, this is text length,
     * for element nodes, this will be childNodes.length
     * @param {!Node} node
     * @returns {!number}
     */
    function getMaximumNodePosition(node) {
        return node.nodeType === Node.TEXT_NODE ? node.textContent.length : node.childNodes.length;
    }

    /**
     * Get the first or last client rectangle based on the useRightEdge flag. If useRightEdge is
     * set to true, this will return the right-most offset of the last available rectangle
     * @param {ClientRectList} clientRectangles
     * @param {!boolean} useRightEdge
     * @returns {?{top: !number, left: !number, bottom: !number}}
     */
    function getClientRect(clientRectangles, useRightEdge) {
        var rectangle,
            simplifiedRectangle = null;

        if (clientRectangles) {
            rectangle = useRightEdge ? clientRectangles[clientRectangles.length - 1] : clientRectangles[0];
        }

        if (rectangle) {
            simplifiedRectangle = {
                top: rectangle.top,
                left: useRightEdge ? rectangle.right : rectangle.left,
                bottom: rectangle.bottom
            };
        }
        return simplifiedRectangle;
    }

    /**
     * Gets the client rect of a position specified by the container and an
     * offset. If this is not possible with a range, then the last element's coordinates
     * are used to guesstimate the position.
     * @param {!Node} container
     * @param {!number} offset
     * @param {!Range} range
     * @param {boolean=} useRightEdge Default value is false. Used when searching for the closest visually equivalent
     *  rectangle, starting at the specified container offset. In these circumstances, the right-side of the last
     *  client rectangle actually defines the visual position
     * @return {{top: !number, left: !number, bottom: !number}}
     */
    function getVisibleRect(container, offset, range, useRightEdge) {
        var rectangle,
            nodeType = container.nodeType;

        // There are various places where the list of client rects will be empty:
        // - Empty text nodes
        // - Non-visible elements (e.g., collapsed or wrapped whitespace, hidden elements etc.)
        // - Non-visible coordinates (e.g., the last position of a paragraph is a selection position, but not a rendered character)
        // In each case, we need to find the visually equivalent rectangle just preceding this container+offset

        // Step 1 - Select just the collapsed point
        range.setStart(container, offset);
        range.collapse(!useRightEdge);
        rectangle = getClientRect(range.getClientRects(), useRightEdge === true);

        if (!rectangle && offset > 0) {
            // Fallback 1 - Select the offset & preceding if available
            range.setStart(container, offset - 1);
            range.setEnd(container, offset);
            rectangle = getClientRect(range.getClientRects(), true);
        }

        if (!rectangle) {
            if (nodeType === Node.ELEMENT_NODE && container.childNodes[offset - 1]) {
                // Fallback 2 - there are other child nodes directly preceding this offset. Try those
                rectangle = getVisibleRect(container, offset - 1, range, true);
            } else if (container.nodeType === Node.TEXT_NODE && offset > 0) {
                // Fallback 3 - this is a text node, so is either in an invisible container, or is collapsed whitespace, see if an adjacent character is visible
                rectangle = getVisibleRect(container, offset - 1, range, true);
            } else if (container.previousSibling) {
                // Fallback 4 - Has a previous sibling, try using that
                rectangle = getVisibleRect(container.previousSibling, getMaximumNodePosition(container.previousSibling), range, true);
            } else if (container.parentNode && container.parentNode !== rootNode) {
                // Fallback 5 - try using the parent container. Had no previous siblings, so look for the first offset
                rectangle = getVisibleRect(container.parentNode, 0, range, false);
            } else {
                // Fallback 6 - no previous siblings have been found, try and return the root node's bounding container
                // Assert container === rootNode
                range.selectNode(rootNode);
                rectangle = getClientRect(range.getClientRects(), false);
            }
        }
        runtime.assert(Boolean(rectangle), "No visible rectangle found");
        return /**@type{{top: !number, left: !number, bottom: !number}}*/(rectangle);
    }

    /**
     * @param {!number} positions
     * @param {!boolean} extend
     * @param {!function():boolean} move
     * @returns {!number} Number of positions successfully moved. Will be less than the requested
     * number if there are not enough positions available in the specified direction
     */
    function doMove(positions, extend, move) {
        var left = positions,
            iterator = getIteratorAtCursor(),
            initialRect,
            range = /**@type{!Range}*/(rootNode.ownerDocument.createRange()),
            selectionRange = cursor.getSelectedRange() ? cursor.getSelectedRange().cloneRange() : (rootNode.ownerDocument.createRange()),
            newRect,
            horizontalMovement,
            o, c,
            isForwardSelection,
            /**@type{?Window}*/window = runtime.getWindow();

        initialRect = getVisibleRect(iterator.container(), iterator.unfilteredDomOffset(), range);
        while (left > 0 && move()) {
            left -= 1;
        }

        if (extend) {
            c = iterator.container();
            o = iterator.unfilteredDomOffset();
            if (selectionRange.comparePoint(c, o) === -1) {
                selectionRange.setStart(c, o);
                isForwardSelection = false;
            } else {
                selectionRange.setEnd(c, o);
            }
        } else {
            selectionRange.setStart(iterator.container(), iterator.unfilteredDomOffset());
            selectionRange.collapse(true);
        }
        cursor.setSelectedRange(selectionRange, isForwardSelection);

        iterator = getIteratorAtCursor(); // Need to get the first walkable position at the cursor
        // The cursor node itself is not a walkable position, and will cause strange behaviours if used
        newRect = getVisibleRect(iterator.container(), iterator.unfilteredDomOffset(), range);

        horizontalMovement = (newRect.top === initialRect.top) ? true : false;
        if (horizontalMovement || cachedXOffset === undefined) {
            cachedXOffset = newRect.left;
        }
        window.clearTimeout(timeoutHandle);
        timeoutHandle = window.setTimeout(function () {
            cachedXOffset = undefined;
        }, 2000);

        range.detach();
        return positions - left;
    }
    /**
     * Move selection forward the requested number of positions.
     * @param {!number} positions
     * @param {boolean=} extend true if range is to be expanded from the current
     *                         point
     * @returns {!number} Number of positions successfully moved. Will be less than the requested
     * number if there are not enough positions available in the specified direction
     **/
    this.movePointForward = function (positions, extend) {
        return doMove(positions, extend || false, positionIterator.nextPosition);
    };
    /**
     * Move selection backward the requested number of positions.
     * @param {!number} positions
     * @param {boolean=} extend true if range is to be expanded from the current
     *                         point
     * @returns {!number} Number of positions successfully moved. Will be less than the requested
     * number if there are not enough positions available in the specified direction
     **/
    this.movePointBackward = function (positions, extend) {
        return doMove(positions, extend || false, positionIterator.previousPosition);
    };

    /**
     * Returns if the current position is walkable according to the
     * specified filter. Useful when the position becomes unwalkable after, for example,
     * text removal.
     * @param {!core.PositionFilter} filter
     * @return {boolean}
     */
    function isPositionWalkable(filter) {
        var iterator = getIteratorAtCursor();

        if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
            return true;
        }
        return false;
    }

    /**
     * Returns the number of positions the given (step, filter) pair is 
     * equivalent to in unfiltered space.
     * @param {!number} steps
     * @param {!core.PositionFilter} filter
     * @return {!number} Number of positions required to move the requested number of filtered steps
     */
    function countForwardSteps(steps, filter) {
        var iterator = getIteratorAtCursor(),
            watch = new core.LoopWatchDog(1000),
            positionCount = 0,
            positions = 0;
        while (steps > 0 && iterator.nextPosition()) {
            positionCount += 1;
            watch.check();
            if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                positions += positionCount;
                positionCount = 0;
                steps -= 1;
            }
        }
        return positions;
    }
    /**
     * Returns the number of positions to the right the (steps, filter1) pair
     * is equivalent to in filter2 space.
     * @param {!number} stepsFilter1 Number of filter1 steps to count
     * @param {!core.PositionFilter} filter1
     * @param {!core.PositionFilter} filter2
     * @return {!number} Equivalent steps in filter2 space
     */
    function convertForwardStepsBetweenFilters(stepsFilter1, filter1, filter2) {
        var iterator = getIteratorAtCursor(),
            watch = new core.LoopWatchDog(1000),
            pendingStepsFilter2 = 0,
            stepsFilter2 = 0;
        while (stepsFilter1 > 0 && iterator.nextPosition()) {
            watch.check();
            if (filter2.acceptPosition(iterator) === FILTER_ACCEPT) {
                pendingStepsFilter2 += 1;
                if (filter1.acceptPosition(iterator) === FILTER_ACCEPT) {
                    stepsFilter2 += pendingStepsFilter2;
                    pendingStepsFilter2 = 0;
                    stepsFilter1 -= 1;
                }
            }
        }
        return stepsFilter2;
    }
    /**
     * Returns the number of positions to the left the (steps, filter1) pair
     * is equivalent to in filter2 space.
     * @param {!number} stepsFilter1 Number of filter1 steps to count
     * @param {!core.PositionFilter} filter1
     * @param {!core.PositionFilter} filter2
     * @return {!number} Equivalent steps in filter2 space
     */
    function convertBackwardStepsBetweenFilters(stepsFilter1, filter1, filter2) {
        var iterator = getIteratorAtCursor(),
            watch = new core.LoopWatchDog(1000),
            pendingStepsFilter2 = 0,
            stepsFilter2 = 0;
        while (stepsFilter1 > 0 && iterator.previousPosition()) {
            watch.check();
            if (filter2.acceptPosition(iterator) === FILTER_ACCEPT) {
                pendingStepsFilter2 += 1;
                if (filter1.acceptPosition(iterator) === FILTER_ACCEPT) {
                    stepsFilter2 += pendingStepsFilter2;
                    pendingStepsFilter2 = 0;
                    stepsFilter1 -= 1;
                }
            }
        }
        return stepsFilter2;
    }
 
    /**
     * Return the number of positions moved to pass the requested number of filtered steps.
     * The return value is always greater than or equal to the number of filtered steps, as
     * each position can be at most one step (and it may take multiple positions to reach the
     * next accepted step)
     * @param {!number} steps
     * @param {!core.PositionFilter} filter
     * @return {!number} Number of positions required to move the requested number of filtered steps
     */
    function countBackwardSteps(steps, filter) {
        var iterator = getIteratorAtCursor(),
            watch = new core.LoopWatchDog(1000),
            positionCount = 0,
            positions = 0;
        while (steps > 0 && iterator.previousPosition()) {
            positionCount += 1;
            watch.check();
            if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                positions += positionCount;
                positionCount = 0;
                steps -= 1;
            }
        }
        return positions;
    }

    /**
     * Finds the most appropriate valid position to move the cursor to. Attempts to keep
     * the cursor within the same paragraph, so that cursors near the front or end of a paragraph do not
     * incorrectly jump to the next or previous paragraph.
     * @param {!core.PositionFilter} filter
     * @returns {!number} positions Number of positions to the nearest step
     */
    function countPositionsToClosestStep(filter) {
        var iterator = getIteratorAtCursor(),
            paragraphNode = odfUtils.getParagraphElement(iterator.getCurrentNode()),
            count;

        count = -countBackwardSteps(1, filter);
        if (count === 0 || (paragraphNode && paragraphNode !== odfUtils.getParagraphElement(iterator.getCurrentNode()))) {
            count = countForwardSteps(1, filter);
        }
        return count;
    }
    /**
     * Return the number of steps needed to move across one line in the specified direction.
     * If it is not possible to move across one line, then 0 is returned.
     *
     * @param {!number} direction -1 for upwards, +1 for downwards
     * @param {!core.PositionFilter} filter
     * @param {!core.PositionIterator} iterator
     * @return {!number} steps
     */
    function countLineSteps(filter, direction, iterator) {
        var c = iterator.container(),
            steps = 0,
            bestContainer = null,
            bestOffset,
            bestXDiff = 10,
            xDiff,
            bestCount = 0,
            top,
            left,
            lastTop,
            rect,
            range = /**@type{!Range}*/(rootNode.ownerDocument.createRange()),
            watch = new core.LoopWatchDog(1000);

        // Get the starting position
        rect = getVisibleRect(c, iterator.unfilteredDomOffset(), range);

        top = rect.top;
        if (cachedXOffset === undefined) {
            left = rect.left;
        } else {
            left = cachedXOffset;
        }
        lastTop = top;

        while ((direction < 0 ? iterator.previousPosition() : iterator.nextPosition()) === true) {
            watch.check();
            if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                steps += 1;

                c = iterator.container();
                rect = getVisibleRect(c, iterator.unfilteredDomOffset(), range);

                if (rect.top !== top) { // Not on the initial line anymore
                    if (rect.top !== lastTop && lastTop !== top) { // Not even on the next line
                        break;
                    }
                    lastTop = rect.top;
                    xDiff = Math.abs(left - rect.left);
                    if (bestContainer === null || xDiff < bestXDiff) {
                        bestContainer = c;
                        bestOffset = iterator.unfilteredDomOffset();
                        bestXDiff = xDiff;
                        bestCount = steps;
                    }
                }
            }
        }

        if (bestContainer !== null) {
            iterator.setUnfilteredPosition(bestContainer, /**@type {!number}*/(bestOffset));
            steps = bestCount;
        } else {
            steps = 0;
        }

        range.detach();
        return steps;
    }
    /**
     * @param {!number} lines negative number for upwards, positive number for downwards
     * @param {!core.PositionFilter} filter
     * @return {!number} steps
     */
    function countLinesSteps(lines, filter) {
        var iterator = getIteratorAtCursor(),
            stepCount = 0,
            steps = 0,
            direction =  lines < 0 ? -1 : 1;

        lines = Math.abs(lines);
        // move back in the document, until a position is found for which the
        // top is smaller than initially and the left is closest
        while (lines > 0) {
            stepCount += countLineSteps(filter, direction, iterator);
            if (stepCount === 0) {
                break;
            }
            steps += stepCount;
            lines -= 1;
        }
        return steps * direction;
    }
    /**
     * Returns the number of steps needed to move to the beginning/end of the
     * line.
     * @param {!number} direction -1 for beginning of the line, 1 for end of the
     *                  line
     * @param {!core.PositionFilter} filter
     * @return {!number} steps
     */
    function countStepsToLineBoundary(direction, filter) {
        var fnNextPos, increment,
            lastRect, rect, onSameLine,
            iterator = getIteratorAtCursor(),
            paragraphNode = odfUtils.getParagraphElement(iterator.getCurrentNode()),
            steps = 0,
            range = /**@type{!Range}*/(rootNode.ownerDocument.createRange());

        if (direction < 0) {
            fnNextPos = iterator.previousPosition;
            increment = -1;
        } else {
            fnNextPos = iterator.nextPosition;
            increment = 1;
        }

        lastRect = getVisibleRect(iterator.container(), iterator.unfilteredDomOffset(), range);
        while (fnNextPos.call(iterator)) {
            if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                // hit another paragraph node, so won't be the same line
                if (odfUtils.getParagraphElement(iterator.getCurrentNode()) !== paragraphNode) {
                    break;
                }

                rect = getVisibleRect(iterator.container(), iterator.unfilteredDomOffset(), range);
                if (rect.bottom !== lastRect.bottom) { // most cases it means hit the line above/below
                    // if top and bottom overlaps, assume they are on the same line
                    onSameLine = (rect.top >= lastRect.top && rect.bottom < lastRect.bottom)
                        || (rect.top <= lastRect.top && rect.bottom > lastRect.bottom);
                    if (!onSameLine) {
                        break;
                    }
                }

                steps += increment;
                lastRect = rect;
            }
        }

        range.detach();
        return steps;
    }
    /**
     * Returns the position difference between the cursor and the supplied point (element + offset). Note, this is NOT
     * the same as the number of valid positions between the cursor and supplied point.
     * Computationally, this is equivalent to: (# steps from root to point) - (# steps from root to cursor)
     *
     * Example scenario:
     *      <p>|A|B|<span>C|D|</span></p>
     * Assuming the cursor is at the 4th vertical bar (position = 3, just after C), countStepsToPosition(span, 0)
     * should return 1. If it returns 0, consumers would incorrectly assume that the cursor is at the same position
     * as the passed in point. This is clearly not the case as can be seen by counting from the start of the
     * document to each point. The span starts at position 2, meaning there is actually 1 step difference
     * between the cursor and the supplied point
     *
     * @param {!Node} targetNode    Target node to iterate to
     * @param {!number} targetOffset  offset in unfiltered DOM world
     * @param {!core.PositionFilter} filter
     * @return {!number} steps
     */
    function countStepsToPosition(targetNode, targetOffset, filter) {
        runtime.assert(targetNode !== null, "SelectionMover.countStepsToPosition called with element===null");
        // first figure out how to get to the element
        // really dumb/inefficient implementation
        var iterator = getIteratorAtCursor(),
            c = iterator.container(),
            o = iterator.unfilteredDomOffset(),
            steps = 0,
            watch = new core.LoopWatchDog(1000),
            comparison;

        // the iterator may interpret the positions as given by the range
        // differently than the dom positions, so we normalize them by calling
        // setPosition with these values
        iterator.setUnfilteredPosition(targetNode, targetOffset);
        // The below counting logic relies on the iterators initially being in accepted positions.
        // This is achieved by rewinding both the iterator and the cursor back to the last acceptable position
        // before, or equal to, the requested the point.
        // Failure to do this rewinding will result in the counting results being off-by-one occasionally when counting backwards
        while (filter.acceptPosition(iterator) !== FILTER_ACCEPT && iterator.previousPosition()) {
            watch.check();
        }
        targetNode = iterator.container();
        runtime.assert(Boolean(targetNode), "SelectionMover.countStepsToPosition: positionIterator.container() returned null");
        targetOffset = iterator.unfilteredDomOffset();

        iterator.setUnfilteredPosition(c, o);
        // See previous comment on rewinding. This prevents off-by-one when counting in reverse
        while (filter.acceptPosition(iterator) !== FILTER_ACCEPT && iterator.previousPosition()) {
            watch.check();
        }

        comparison = domUtils.comparePoints(targetNode, targetOffset, iterator.container(), iterator.unfilteredDomOffset());
        if (comparison < 0) {
            while (iterator.nextPosition()) {
                watch.check();
                if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                    steps += 1;
                }
                if (iterator.container() === targetNode && iterator.unfilteredDomOffset() === targetOffset) {
                    return steps;
                }
            }
        } else if (comparison > 0) {
            while (iterator.previousPosition()) {
                watch.check();
                if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                    steps -= 1;
                    // Every point from the root node to the *first* valid position is effectively position = 0
                    // Therefore, when counting steps backwards we need to count to the earliest position preceding (or equal)
                    // to the supplied point
                    if (iterator.container() === targetNode && iterator.unfilteredDomOffset() === targetOffset) {
                        break;
                    }
                }
            }
        }
        return steps;
    }

    this.getStepCounter = function () {
        return {
            countForwardSteps: countForwardSteps,
            countBackwardSteps: countBackwardSteps,
            convertForwardStepsBetweenFilters: convertForwardStepsBetweenFilters,
            convertBackwardStepsBetweenFilters: convertBackwardStepsBetweenFilters,
            countLinesSteps: countLinesSteps,
            countStepsToLineBoundary: countStepsToLineBoundary,
            countStepsToPosition: countStepsToPosition,
            isPositionWalkable: isPositionWalkable,
            countPositionsToNearestStep: countPositionsToClosestStep
        };
    };
    function init() {
        odfUtils = new odf.OdfUtils();
        domUtils = new core.DomUtils();
        positionIterator = gui.SelectionMover.createPositionIterator(rootNode);
        var range = rootNode.ownerDocument.createRange();
        range.setStart(positionIterator.container(), positionIterator.unfilteredDomOffset());
        range.collapse(true);
        cursor.setSelectedRange(range);
    }
    init();
};
/**
 * @param {!Node} rootNode
 * @return {!core.PositionIterator}
 */
gui.SelectionMover.createPositionIterator = function (rootNode) {
    "use strict";
    /**
     * @constructor
     * @extends NodeFilter
      */
    function CursorFilter() {
        /**
         * @param {!Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            if (node.namespaceURI === "urn:webodf:names:cursor" ||
                    node.namespaceURI === "urn:webodf:names:editinfo") {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        };
    }
    var filter = new CursorFilter();
    return new core.PositionIterator(rootNode, 5, filter, false);
};
(function () {
    "use strict";
    return gui.SelectionMover;
}());
