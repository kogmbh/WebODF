/**
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

/*global runtime, core, gui, Node, ops, odf */

runtime.loadClass("core.DomUtils");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("odf.ObjectNameGenerator");
runtime.loadClass("ops.OpAddCursor");
runtime.loadClass("ops.OpRemoveCursor");
runtime.loadClass("ops.OpMoveCursor");
runtime.loadClass("ops.OpInsertText");
runtime.loadClass("ops.OpRemoveText");
runtime.loadClass("ops.OpSplitParagraph");
runtime.loadClass("ops.OpSetParagraphStyle");
runtime.loadClass("ops.OpRemoveAnnotation");
runtime.loadClass("gui.Clipboard");
runtime.loadClass("gui.KeyboardHandler");
runtime.loadClass("gui.DirectTextStyler");
runtime.loadClass("gui.DirectParagraphStyler");
runtime.loadClass("gui.ImageManager");
runtime.loadClass("gui.TextManipulator");
runtime.loadClass("gui.EventManager");

/**
 * @constructor
 * @param {!ops.Session} session
 * @param {!string} inputMemberId
 * @param {!{directStylingEnabled:boolean}=} args
 * @return {?}
 */
gui.SessionController = (function () {
    "use strict";

    var /**@const*/FILTER_ACCEPT = core.PositionFilter.FilterResult.FILTER_ACCEPT;

    /**
     * @constructor
     * @param {!ops.Session} session
     * @param {!string} inputMemberId
     * @param {!{directStylingEnabled:boolean}=} args
     * @return {?}
     */
    gui.SessionController = function SessionController(session, inputMemberId, args) {
        var /**@type{!Window}*/window = /**@type{!Window}*/(runtime.getWindow()),
            odtDocument = session.getOdtDocument(),
            domUtils = new core.DomUtils(),
            odfUtils = new odf.OdfUtils(),
            clipboard = new gui.Clipboard(),
            keyDownHandler = new gui.KeyboardHandler(),
            keyPressHandler = new gui.KeyboardHandler(),
            keyboardMovementsFilter = new core.PositionFilterChain(),
            baseFilter = odtDocument.getPositionFilter(),
            clickStartedWithinContainer = false,
            objectNameGenerator = new odf.ObjectNameGenerator(odtDocument.getOdfCanvas().odfContainer(), inputMemberId),
            undoManager = null,
            imageManager = new gui.ImageManager(session, inputMemberId, objectNameGenerator),
            textManipulator = new gui.TextManipulator(session, inputMemberId),
            eventManager = new gui.EventManager(odtDocument),
            directTextStyler = args && args.directStylingEnabled ? new gui.DirectTextStyler(session, inputMemberId) : null,
            directParagraphStyler = args && args.directStylingEnabled ? new gui.DirectParagraphStyler(session, inputMemberId, objectNameGenerator) : null;

        runtime.assert(window !== null,
            "Expected to be run in an environment which has a global window, like a browser.");

        keyboardMovementsFilter.addFilter('BaseFilter', baseFilter);
        keyboardMovementsFilter.addFilter('RootFilter', odtDocument.createRootFilter(inputMemberId));

        /**
         * @param {!Event} event
         * @return {undefined}
         */
        function cancelEvent(event) {
            if (event.preventDefault) {
                event.preventDefault();
            } else {
                event.returnValue = false;
            }
        }

        /**
         * @param {!Event} e
         * @return {undefined}
         */
        function dummyHandler(e) {
            // runtime.log("ignore event " + e.type);
            cancelEvent(e);
        }

        /**
         * @param {!number} position
         * @param {!number} length
         * @return {!ops.Operation}
         */
        function createOpMoveCursor(position, length) {
            var op = new ops.OpMoveCursor();
            op.init({memberid: inputMemberId, position: position, length: length || 0});
            return op;
        }

        /**
         * @param {?Node} targetNode
         * @param {!number} targetOffset
         * @return {?number}
         */
        function countStepsToNode(targetNode, targetOffset) {
            var iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
                canvasElement = odtDocument.getOdfCanvas().getElement(),
                node;

            // check that the node or one of its parent nodes til the canvas are
            // not belonging to a cursor, like e.g. the caret and the cursor
            // avatarflag are.
            node = targetNode;
            if (!node) {
                return null;
            }
            while (node !== canvasElement) {
                if ((node.namespaceURI === 'urn:webodf:names:cursor'
                     && node.localName === 'cursor')
                        || (node.namespaceURI === 'urn:webodf:names:editinfo'
                            && node.localName === 'editinfo')) {
                    break;
                }
                node = node.parentNode;

                // Sometimes when we click outside the canvasElement, the ancestry
                // will never reach canvasElement, and the node will eventually become null. In that case,
                // return.
                if (!node) {
                    return null;
                }
            }

            if (node !== canvasElement && targetNode !== node) {
                // This happens when the click event has been captured by a cursor or editinfo.
                // In that case, put the cursor in the capturer's container, just after it.
                targetNode = node.parentNode;
                targetOffset = Array.prototype.indexOf.call(targetNode.childNodes, node);
            }

            // create a move op with the distance to that position
            iterator.setUnfilteredPosition(targetNode, targetOffset);
            return odtDocument.getDistanceFromCursor(inputMemberId, iterator.container(), iterator.unfilteredDomOffset());
        }

        /**
         * @param {!number} x
         * @param {!number} y
         * @return {?{container:!Node, offset:!number}}
         */
        function caretPositionFromPoint(x, y) {
            var doc = odtDocument.getDOM(),
                result;

            if (doc.caretRangeFromPoint) {
                result = doc.caretRangeFromPoint(x, y);
                return {
                    container : result.startContainer,
                    offset : result.startOffset
                };
            }
            if (doc.caretPositionFromPoint) {
                result = doc.caretPositionFromPoint(x, y);
                return {
                    container : result.offsetNode,
                    offset : result.offset
                };
            }
            return null;
        }

        /**
         * @param {!Node} node
         * @return {!{node:!Node, offset:!number}}
         */
        function findClosestPosition(node) {
            var canvasElement = odtDocument.getOdfCanvas().getElement(),
                newNode = odtDocument.getRootNode(),
                newOffset = 0,
                beforeCanvas, iterator;

            /*jslint bitwise: true*/
            beforeCanvas = canvasElement.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING;
            /*jslint bitwise: false*/
            if (!beforeCanvas) {
                iterator = gui.SelectionMover.createPositionIterator(newNode);
                iterator.moveToEnd();
                newNode = iterator.container();
                newOffset = iterator.unfilteredDomOffset();
            }
            return {
                node: newNode,
                offset: newOffset
            };
        }

        /**
         * @param {!Node} node
         * @return {!boolean}
         */
        function isTextSpan(node) {
            return node.namespaceURI === odf.Namespaces.textns && node.localName === 'span';
        }

        /**
         * Expands the supplied selection to the nearest word boundaries
         * @param {{anchorNode: !Node, anchorOffset: !number, focusNode: !Node, focusOffset: !number}} selection
         */
        function expandToWordBoundaries(selection) {
            var alphaNumeric = /[A-Za-z0-9]/,
                iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
                isForwardSelection = domUtils.comparePoints(selection.anchorNode, selection.anchorOffset,
                                                            selection.focusNode, selection.focusOffset) > 0,
                startPoint, endPoint,
                currentNode, c;

            if (isForwardSelection) {
                startPoint = {node: selection.anchorNode, offset: selection.anchorOffset};
                endPoint = {node: selection.focusNode, offset: selection.focusOffset};
            } else {
                startPoint = {node: selection.focusNode, offset: selection.focusOffset};
                endPoint = {node: selection.anchorNode, offset: selection.anchorOffset};
            }

            iterator.setUnfilteredPosition(startPoint.node, startPoint.offset);
            while (iterator.previousPosition()) {
                currentNode = iterator.getCurrentNode();
                if (currentNode.nodeType === Node.TEXT_NODE) {
                    c = currentNode.data[iterator.unfilteredDomOffset()];
                    if (!alphaNumeric.test(c)) {
                        break;
                    }
                } else if (!isTextSpan(currentNode)) {
                    break;
                }
                startPoint.node = iterator.container();
                startPoint.offset = iterator.unfilteredDomOffset();
            }

            iterator.setUnfilteredPosition(endPoint.node, endPoint.offset);
            do {
                currentNode = iterator.getCurrentNode();
                if (currentNode.nodeType === Node.TEXT_NODE) {
                    c = currentNode.data[iterator.unfilteredDomOffset()];
                    if (!alphaNumeric.test(c)) {
                        break;
                    }
                } else if (!isTextSpan(currentNode)) {
                    break;
                }
            } while (iterator.nextPosition());
            endPoint.node = iterator.container();
            endPoint.offset = iterator.unfilteredDomOffset();

            if (isForwardSelection) {
                selection.anchorNode = startPoint.node;
                selection.anchorOffset = startPoint.offset;
                selection.focusNode = endPoint.node;
                selection.focusOffset = endPoint.offset;
            } else {
                selection.focusNode = startPoint.node;
                selection.focusOffset = startPoint.offset;
                selection.anchorNode = endPoint.node;
                selection.anchorOffset = endPoint.offset;
            }
        }

        /**
         * Expands the supplied selection to the nearest paragraph boundaries
         * @param {{anchorNode: !Node, anchorOffset: !number, focusNode: !Node, focusOffset: !number}} selection
         */
        function expandToParagraphBoundaries(selection) {
            var anchorParagraph = odtDocument.getParagraphElement(selection.anchorNode),
                focusParagraph = odtDocument.getParagraphElement(selection.focusNode);

            if (anchorParagraph) {
                selection.anchorNode = anchorParagraph;
                selection.anchorOffset = 0;
            }

            if (focusParagraph) {
                selection.focusNode = focusParagraph;
                selection.focusOffset = focusParagraph.childNodes.length;
            }
        }

        function mutableSelection(selection) {
            return {
                anchorNode: selection.anchorNode,
                anchorOffset: selection.anchorOffset,
                focusNode: selection.focusNode,
                focusOffset: selection.focusOffset
            };
        }

        /**
         * @param {!UIEvent} e
         * @return {?{anchorNode:!Node, anchorOffset:!number, focusNode:!Node, focusOffset:!number}}
         */
        function getSelection (e) {
            var canvasElement = odtDocument.getOdfCanvas().getElement(),
                selection = mutableSelection(window.getSelection()),
                clickCount = e.detail, // See http://www.w3.org/TR/DOM-Level-3-Events/#event-type-mouseup
                anchorNodeInsideCanvas, focusNodeInsideCanvas, caretPos, node;

            if (selection.anchorNode === null && selection.focusNode === null) { // chrome & safari
                caretPos = caretPositionFromPoint(e.clientX, e.clientY);
                if (!caretPos) {
                    return null;
                }

                selection.anchorNode = /**@type{!Node}*/(caretPos.container);
                selection.anchorOffset = caretPos.offset;
                selection.focusNode = selection.anchorNode;
                selection.focusOffset = selection.anchorOffset;
            }

            runtime.assert(selection.anchorNode !== null && selection.focusNode !== null,
                "anchorNode is null or focusNode is null");

            anchorNodeInsideCanvas = domUtils.containsNode(canvasElement, selection.anchorNode);
            focusNodeInsideCanvas = domUtils.containsNode(canvasElement, selection.focusNode);
            if (!anchorNodeInsideCanvas && !focusNodeInsideCanvas) {
                return null;
            }
            if (!anchorNodeInsideCanvas) {
                node = findClosestPosition(selection.anchorNode);
                selection.anchorNode = node.node;
                selection.anchorOffset = node.offset;
            }
            if (!focusNodeInsideCanvas) {
                node = findClosestPosition(selection.focusNode);
                selection.focusNode = node.node;
                selection.focusOffset = node.offset;
            }

            if (clickCount === 2) {
                expandToWordBoundaries(selection);
            } else if (clickCount === 3) {
                expandToParagraphBoundaries(selection);
            }

            // canvas element won't have focus if user click somewhere outside the canvas then drag and
            // release click inside the canvas.
            eventManager.focus();

            return selection;
        }

        /**
         * Returns the first filtered walkable position in the node
         * @param {!Node} node
         * @return {!number}
         */
        function getFirstWalkablePositionInNode(node) {
            var position = 0,
                iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
                watch = new core.LoopWatchDog(1000),
                inside = false;

            while (iterator.nextPosition()) {
                watch.check();

                /*jslint bitwise: true*/
                inside = Boolean(node.compareDocumentPosition(iterator.container()) & Node.DOCUMENT_POSITION_CONTAINED_BY);

                if (baseFilter.acceptPosition(iterator) === FILTER_ACCEPT) {
                    if (inside) {
                        break;
                    }
                    position += 1;
                }
            }

            return position;
        }

        /**
         * Returns the walkable length of the node
         * @param {!Node} node
         * @return {!number}
         */
        function getWalkableNodeLength(node) {
            var length = 0,
                iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
                inside = false;

            iterator.setUnfilteredPosition(node, 0);
            do {
                /*jslint bitwise: true*/
                inside = Boolean(node.compareDocumentPosition(iterator.container()) & Node.DOCUMENT_POSITION_CONTAINED_BY);
                if (!inside && node !== iterator.container()) {
                    break;
                }
                if (baseFilter.acceptPosition(iterator) === FILTER_ACCEPT) {
                    length += 1;
                }
            } while (iterator.nextPosition());

            return length;
        }

        /**
         * @param {!Node} annotationNode
         * @return {undefined}
         */
        function removeAnnotation(annotationNode) {
            var position, length, op;

            position = getFirstWalkablePositionInNode(annotationNode);
            length = getWalkableNodeLength(annotationNode);

            op = new ops.OpRemoveAnnotation();
            op.init({
                memberid: inputMemberId,
                position: position,
                length: length
            });
            session.enqueue([op]);
        }

        /**
         * @param {!UIEvent} e
         * @return {undefined}
         */
        function selectRange(e) {
            // When click somewhere within already selected text, call window.getSelection() straight away results
            // the previous selection get returned. Set 0 timeout here so the newly clicked position can be updated
            // by the browser. Unfortunately this is only working in Firefox. For other browsers, we have to work
            // out the caret position from two coordinates.
            runtime.setTimeout(function () {
                var selection = getSelection(e),
                    oldPosition, stepsToAnchor, stepsToFocus, op;

                if (selection === null) {
                    return;
                }

                stepsToAnchor = countStepsToNode(selection.anchorNode, selection.anchorOffset);
                if (selection.focusNode === selection.anchorNode
                    && selection.focusOffset === selection.anchorOffset) {
                    stepsToFocus = stepsToAnchor;
                } else {
                    stepsToFocus = countStepsToNode(selection.focusNode, selection.focusOffset);
                }

                if ((stepsToFocus !== null && stepsToFocus !== 0 ) ||
                    (stepsToAnchor !== null && stepsToAnchor !== 0)) {
                    oldPosition = odtDocument.getCursorPosition(inputMemberId);
                    op = createOpMoveCursor(oldPosition + stepsToAnchor, stepsToFocus - stepsToAnchor);
                    session.enqueue([op]);
                }
            }, 0);
        }

        function handleContextMenu(e) {
            // TODO Various browsers have different default behaviours on right click
            // We can detect this at runtime without doing any kind of platform sniffing
            // simply by observing what the browser has tried to do on right-click.
            // - OSX: Safari/Chrome - Expand to word boundary
            // - OSX: Firefox - No expansion
            // - Windows: Safari/Chrome/Firefox - No expansion
            selectRange(e);
        }

        /**
         * @param {!number} lengthAdjust   length adjustment
         * @return {undefined}
         */
        function extendCursorByAdjustment(lengthAdjust) {
            var selection = odtDocument.getCursorSelection(inputMemberId),
                stepCounter = odtDocument.getCursor(inputMemberId).getStepCounter(),
                newLength;
            if (lengthAdjust !== 0) {
                lengthAdjust = (lengthAdjust > 0)
                    ? stepCounter.convertForwardStepsBetweenFilters(lengthAdjust, keyboardMovementsFilter, baseFilter)
                    : -stepCounter.convertBackwardStepsBetweenFilters(-lengthAdjust, keyboardMovementsFilter, baseFilter);

                newLength = selection.length + lengthAdjust;
                session.enqueue([createOpMoveCursor(selection.position, newLength)]);
            }
        }

        /**
         * @param {!number} positionAdjust   position adjustment
         * @return {undefined}
         */
        function moveCursorByAdjustment(positionAdjust) {
            var position = odtDocument.getCursorPosition(inputMemberId),
                stepCounter = odtDocument.getCursor(inputMemberId).getStepCounter();
            if (positionAdjust !== 0) {
                positionAdjust = (positionAdjust > 0)
                    ? stepCounter.convertForwardStepsBetweenFilters(positionAdjust, keyboardMovementsFilter, baseFilter)
                    : -stepCounter.convertBackwardStepsBetweenFilters(-positionAdjust, keyboardMovementsFilter, baseFilter);

                position = position + positionAdjust;
                session.enqueue([createOpMoveCursor(position, 0)]);
            }
        }

        /**
         * @return {!boolean}
         */
        function moveCursorToLeft() {
            moveCursorByAdjustment(-1);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function moveCursorToRight() {
            moveCursorByAdjustment(1);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionToLeft() {
            extendCursorByAdjustment(-1);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionToRight() {
            extendCursorByAdjustment(1);
            return true;
        }

        /**
         * @param {!number} direction -1 for upwards 1 for downwards
         * @param {!boolean} extend
         * @return {undefined}
         */
        function moveCursorByLine(direction, extend) {
            var paragraphNode = odtDocument.getParagraphElement(odtDocument.getCursor(inputMemberId).getNode()),
                steps;

            runtime.assert(Boolean(paragraphNode), "SessionController: Cursor outside paragraph");
            steps = odtDocument.getCursor(inputMemberId).getStepCounter().countLinesSteps(direction, keyboardMovementsFilter);
            if (extend) {
                extendCursorByAdjustment(steps);
            } else {
                moveCursorByAdjustment(steps);
            }
        }

        /**
         * @return {!boolean}
         */
        function moveCursorUp() {
            moveCursorByLine(-1, false);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function moveCursorDown() {
            moveCursorByLine(1, false);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionUp() {
            moveCursorByLine(-1, true);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionDown() {
            moveCursorByLine(1, true);
            return true;
        }

        /**
         * @param {!number} direction -1 for beginning 1 for end
         * @param {!boolean} extend
         * @return {undefined}
         */
        function moveCursorToLineBoundary(direction, extend) {
            var steps = odtDocument.getCursor(inputMemberId).getStepCounter().countStepsToLineBoundary(
                direction,
                keyboardMovementsFilter
            );
            if (extend) {
                extendCursorByAdjustment(steps);
            } else {
                moveCursorByAdjustment(steps);
            }
        }

        /**
         * @return {!boolean}
         */
        function moveCursorToLineStart() {
            moveCursorToLineBoundary(-1, false);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function moveCursorToLineEnd() {
            moveCursorToLineBoundary(1, false);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionToLineStart() {
            moveCursorToLineBoundary(-1, true);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionToLineEnd() {
            moveCursorToLineBoundary(1, true);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionToParagraphStart() {
            var paragraphNode = odtDocument.getParagraphElement(odtDocument.getCursor(inputMemberId).getNode()),
                iterator,
                node,
                steps;

            runtime.assert(Boolean(paragraphNode), "SessionController: Cursor outside paragraph");
            steps = odtDocument.getDistanceFromCursor(inputMemberId, paragraphNode, 0);
            iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode());
            iterator.setUnfilteredPosition(paragraphNode, 0);

            while (steps === 0 && iterator.previousPosition()) {
                node = iterator.getCurrentNode();

                if (odfUtils.isParagraph(node)) {
                    steps = odtDocument.getDistanceFromCursor(inputMemberId, node, 0);
                }
            }
            extendCursorByAdjustment(steps);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionToParagraphEnd() {
            var paragraphNode = odtDocument.getParagraphElement(odtDocument.getCursor(inputMemberId).getNode()),
                iterator,
                node,
                steps;

            runtime.assert(Boolean(paragraphNode), "SessionController: Cursor outside paragraph");
            iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode());
            iterator.moveToEndOfNode(paragraphNode);
            steps = odtDocument.getDistanceFromCursor(
                inputMemberId,
                iterator.container(),
                iterator.unfilteredDomOffset()
            );

            while (steps === 0 && iterator.nextPosition()) {
                node = iterator.getCurrentNode();

                if (odfUtils.isParagraph(node)) {
                    iterator.moveToEndOfNode(node);
                    steps = odtDocument.getDistanceFromCursor(
                        inputMemberId,
                        iterator.container(),
                        iterator.unfilteredDomOffset()
                    );
                }
            }
            extendCursorByAdjustment(steps);
            return true;
        }

        /**
         * @param {!number} direction -1 for beginning, 1 for end
         * @param {!boolean=} extend
         * @return {undefined}
         */
        function moveCursorToDocumentBoundary(direction, extend) {
            var iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
                steps;
            if (direction > 0) {
                iterator.moveToEnd();
            }

            steps = odtDocument.getDistanceFromCursor(
                inputMemberId,
                iterator.container(),
                iterator.unfilteredDomOffset()
            );
            if (extend) {
                extendCursorByAdjustment(steps);
            } else {
                moveCursorByAdjustment(steps);
            }
        }

        /**
         * @return {!boolean}
         */
        function moveCursorToDocumentStart() {
            moveCursorToDocumentBoundary(-1, false);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function moveCursorToDocumentEnd() {
            moveCursorToDocumentBoundary(1, false);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionToDocumentStart() {
            moveCursorToDocumentBoundary(-1, true);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionToDocumentEnd() {
            moveCursorToDocumentBoundary(1, true);
            return true;
        }

        /**
         * @return {!boolean}
         */
        function extendSelectionToEntireDocument() {
            var iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
                steps;
            // The root node is always before the cursor, therefore the returned number of steps is always negative
            steps = -odtDocument.getDistanceFromCursor(inputMemberId, iterator.container(), iterator.unfilteredDomOffset());

            iterator.moveToEnd();
            steps += odtDocument.getDistanceFromCursor(inputMemberId, iterator.container(), iterator.unfilteredDomOffset());
            session.enqueue([createOpMoveCursor(0, steps)]);
            return true;
        }

        /**
         * TODO: This method and associated event subscriptions really belong in SessionView
         * As this implementation relies on the current browser selection, only a single
         * cursor can be highlighted at a time. Eventually, when virtual selection & cursors are
         * implemented, this limitation will be eliminated
         * @return {undefined}
         */
        function maintainCursorSelection() {
            var cursor = odtDocument.getCursor(inputMemberId),
                selection = window.getSelection();

            if (eventManager.hasFocus() && cursor) {
                // May have just processed our own remove cursor operation...
                // Probably not a good idea to try and update our selected range in this case ;-)
                selection.removeAllRanges();
                selection.addRange(cursor.getSelectedRange().cloneRange());
            }
        }

        /**
         * The focus event will sometimes update the window's current selection after all
         * event handlers have been called (observed on FF24, OSX).
         */
        function delayedMaintainCursor() {
            runtime.setTimeout(maintainCursorSelection, 50);
        }

        /**
         * @param {!Event} event
         * @return {?string}
         */
        function stringFromKeyPress(event) {
            if (event.which === null) {
                return String.fromCharCode(event.keyCode); // IE
            }
            if (event.which !== 0 && event.charCode !== 0) {
                return String.fromCharCode(event.which);   // the rest
            }
            return null; // special key
        }

        /**
         * Handle the cut operation request
         * @param {!Event} e
         * @return {undefined}
         */
        function handleCut(e) {
            var cursor = odtDocument.getCursor(inputMemberId),
                selectedRange = cursor.getSelectedRange();

            if (selectedRange.collapsed) {
                // Modifying the clipboard data will clear any existing data,
                // so cut shouldn't touch the clipboard if there is nothing selected
                return;
            }

            // The document is readonly, so the data will never get placed on the clipboard in
            // most browsers unless we do it ourselves.
            if (clipboard.setDataFromRange(e, cursor.getSelectedRange())) {
                textManipulator.removeCurrentSelection();
            } else {
                // TODO What should we do if cut isn't supported?
                runtime.log("Cut operation failed");
            }
        }

        /**
         * Tell the browser that it's ok to perform a cut action on our read-only body
         * @returns {!boolean}
         */
        function handleBeforeCut() {
            var cursor = odtDocument.getCursor(inputMemberId),
                selectedRange = cursor.getSelectedRange();
            return selectedRange.collapsed !== false; // return false to enable cut menu... straightforward right?!
        }

        /**
         * Handle the copy operation request
         * @param {!Event} e
         * @return {undefined}
         */
        function handleCopy(e) {
            var cursor = odtDocument.getCursor(inputMemberId),
                selectedRange = cursor.getSelectedRange();

            if (selectedRange.collapsed) {
                // Modifying the clipboard data will clear any existing data,
                // so cut shouldn't touch the clipboard if there is nothing selected
                return;
            }

            // Place the data on the clipboard ourselves to ensure consistency with cut behaviours
            if (!clipboard.setDataFromRange(e, cursor.getSelectedRange())) {
                // TODO What should we do if cut isn't supported?
                runtime.log("Cut operation failed");
            }
        }

        /**
         * @param {!Event} e
         * @return {undefined}
         */
        function handlePaste(e) {
            var plainText;

            if (window.clipboardData && window.clipboardData.getData) { // IE
                plainText = window.clipboardData.getData('Text');
            } else if (e.clipboardData && e.clipboardData.getData) { // the rest
                plainText = e.clipboardData.getData('text/plain');
            }

            if (plainText) {
                textManipulator.insertText(plainText);
                cancelEvent(e);
            }
        }

        /**
         * Tell the browser that it's ok to perform a paste action on our read-only body
         * @returns {!boolean}
         */
        function handleBeforePaste() {
            return false;
        }

        /**
         * @param {!ops.Operation} op
         * @return {undefined}
         */
        function updateUndoStack(op) {
            if (undoManager) {
                undoManager.onOperationExecuted(op);
            }
        }

        /**
         * @param {?Event} e
         * @return {undefined}
         */
        function forwardUndoStackChange(e) {
            odtDocument.emit(ops.OdtDocument.signalUndoStackChanged, e);
        }

        /**
         * @return {!boolean}
         */
        function undo() {
            if (undoManager) {
                undoManager.moveBackward(1);
                maintainCursorSelection();
                return true;
            }

            return false;
        }

        /**
         * @return {!boolean}
         */
        function redo() {
            if (undoManager) {
                undoManager.moveForward(1);
                maintainCursorSelection();
                return true;
            }

            return false;
        }

        /**
         * Updates a flag indicating whether the mouse down event occurred within the OdfCanvas element.
         * This is necessary because the mouse-up binding needs to be global in order to handle mouse-up
         * events that occur when the user releases the mouse button outside the canvas.
         * This filter limits selection changes to mouse down events that start inside the canvas
         * @param e
         */
        function filterMouseClicks(e) {
            clickStartedWithinContainer = e.target && domUtils.containsNode(odtDocument.getOdfCanvas().getElement(), e.target);
        }

        function handleMouseUp(event) {
            var target = event.target,
                annotationNode = null;
            if (target.className === "annotationRemoveButton") {
                annotationNode = domUtils.getElementsByTagNameNS(target.parentNode, odf.Namespaces.officens, 'annotation')[0];
                removeAnnotation(annotationNode);
            } else if (clickStartedWithinContainer) {
                selectRange(event);
            }
            // Expect that each mouse-up event is preceded by a mouse down that will update clickStartedWithinContainer
        }

        /**
         * @return {undefined}
         */
        this.startEditing = function () {
            var op;

            eventManager.subscribe("keydown", keyDownHandler.handleEvent);
            eventManager.subscribe("keypress", keyPressHandler.handleEvent);
            eventManager.subscribe("keyup", dummyHandler);
            eventManager.subscribe("beforecut", handleBeforeCut);
            eventManager.subscribe("cut", handleCut);
            eventManager.subscribe("copy", handleCopy);
            eventManager.subscribe("beforepaste", handleBeforePaste);
            eventManager.subscribe("paste", handlePaste);
            eventManager.subscribe("mousedown", filterMouseClicks);
            eventManager.subscribe("mouseup", handleMouseUp);
            eventManager.subscribe("contextmenu", handleContextMenu);
            eventManager.subscribe("focus", delayedMaintainCursor);

            // start maintaining the cursor selection now
            odtDocument.subscribe(ops.OdtDocument.signalOperationExecuted, maintainCursorSelection);
            odtDocument.subscribe(ops.OdtDocument.signalOperationExecuted, updateUndoStack);

            op = new ops.OpAddCursor();
            op.init({memberid: inputMemberId});
            session.enqueue([op]);

            if (undoManager) {
                // For most undo managers, the initial state is a clean document *with* a cursor present
                undoManager.saveInitialState();
            }
        };

        /**
         * @return {undefined}
         */
        this.endEditing = function () {
            var op;

            odtDocument.unsubscribe(ops.OdtDocument.signalOperationExecuted, updateUndoStack);
            odtDocument.unsubscribe(ops.OdtDocument.signalOperationExecuted, maintainCursorSelection);

            eventManager.unsubscribe("keydown", keyDownHandler.handleEvent);
            eventManager.unsubscribe("keypress", keyPressHandler.handleEvent);
            eventManager.unsubscribe("keyup", dummyHandler);
            eventManager.unsubscribe("cut", handleCut);
            eventManager.unsubscribe("beforecut", handleBeforeCut);
            eventManager.unsubscribe("copy", handleCopy);
            eventManager.unsubscribe("paste", handlePaste);
            eventManager.unsubscribe("beforepaste", handleBeforePaste);
            eventManager.unsubscribe("mousedown", filterMouseClicks);
            eventManager.unsubscribe("mouseup", handleMouseUp);
            eventManager.unsubscribe("contextmenu", handleContextMenu);
            eventManager.unsubscribe("focus", delayedMaintainCursor);

            op = new ops.OpRemoveCursor();
            op.init({memberid: inputMemberId});
            session.enqueue([op]);

            if (undoManager) {
                undoManager.resetInitialState();
            }
        };

        /**
         * @return {!string}
         */
        this.getInputMemberId = function () {
            return inputMemberId;
        };

        /**
         * @return {!ops.Session}
         */
        this.getSession = function () {
            return session;
        };

        /**
         * @param {?gui.UndoManager} manager
         * @return {undefined}
         */
        this.setUndoManager = function (manager) {
            if (undoManager) {
                undoManager.unsubscribe(gui.UndoManager.signalUndoStackChanged, forwardUndoStackChange);
            }

            undoManager = manager;
            if (undoManager) {
                undoManager.setOdtDocument(odtDocument);
                // As per gui.UndoManager, this should NOT fire any signals or report
                // events being executed back to the undo manager.
                undoManager.setPlaybackFunction(function (op) {
                    op.execute(odtDocument);
                });
                undoManager.subscribe(gui.UndoManager.signalUndoStackChanged, forwardUndoStackChange);
            }
        };

        /**
         * @returns {?gui.UndoManager}
         */
        this.getUndoManager = function () {
            return undoManager;
        };


        /**
         * @returns {?gui.DirectTextStyler}
         */
        this.getDirectTextStyler = function () {
            return directTextStyler;
        };

        /**
         * @returns {?gui.DirectParagraphStyler}
         */
        this.getDirectParagraphStyler = function () {
            return directParagraphStyler;
        };

        /**
         * @returns {!gui.ImageManager}
         */
        this.getImageManager = function () {
            return imageManager;
        };

        /**
         * @returns {!gui.TextManipulator}
         */
        this.getTextManipulator = function() {
            return textManipulator;
        };

        /**
         * @returns {!gui.EventManager}
         */
        this.getEventManager = function() {
            return eventManager;
        };

        /**
         * Return the keyboard event handlers
         * @returns {{keydown: gui.KeyboardHandler, keypress: gui.KeyboardHandler}}
         */
        this.getKeyboardHandlers = function() {
            return {
                keydown: keyDownHandler,
                keypress: keyPressHandler
            };
        };

        /**
         * @param {!function(!Object=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function(callback) {
            var destroyDirectTextStyler = directTextStyler ? directTextStyler.destroy : function(cb) { cb(); },
                destroyDirectParagraphStyler = directParagraphStyler ? directParagraphStyler.destroy : function(cb) { cb(); };
            // TODO: check if anything else needs to be cleaned up
            destroyDirectTextStyler(function(err) {
                if (err) {
                    callback(err);
                } else {
                    destroyDirectParagraphStyler(callback);
                }
            });
        };

        /**
         * Executes the provided function and returns true
         * Used to swallow events regardless of whether an operation was created
         * @param {!Function} fn
         * @returns {!Function}
         */
        function returnTrue(fn) {
            return function() {
                fn();
                return true;
            };
        }

        function init() {
            var isMacOS = window.navigator.appVersion.toLowerCase().indexOf("mac") !== -1,
                modifier = gui.KeyboardHandler.Modifier,
                keyCode = gui.KeyboardHandler.KeyCode;

            keyDownHandler.bind(keyCode.Tab, modifier.None, function () {
                textManipulator.insertText("\t");
                return true;
            });
            keyDownHandler.bind(keyCode.Left, modifier.None, moveCursorToLeft);
            keyDownHandler.bind(keyCode.Right, modifier.None, moveCursorToRight);
            keyDownHandler.bind(keyCode.Up, modifier.None, moveCursorUp);
            keyDownHandler.bind(keyCode.Down, modifier.None, moveCursorDown);
            // Most browsers will go back one page when given an unhandled backspace press
            // To prevent this, the event handler for this key should always return true
            keyDownHandler.bind(keyCode.Backspace, modifier.None, returnTrue(textManipulator.removeTextByBackspaceKey));
            keyDownHandler.bind(keyCode.Delete, modifier.None, textManipulator.removeTextByDeleteKey);
            keyDownHandler.bind(keyCode.Left, modifier.Shift, extendSelectionToLeft);
            keyDownHandler.bind(keyCode.Right, modifier.Shift, extendSelectionToRight);
            keyDownHandler.bind(keyCode.Up, modifier.Shift, extendSelectionUp);
            keyDownHandler.bind(keyCode.Down, modifier.Shift, extendSelectionDown);

            keyDownHandler.bind(keyCode.Home, modifier.None, moveCursorToLineStart);
            keyDownHandler.bind(keyCode.End, modifier.None, moveCursorToLineEnd);
            keyDownHandler.bind(keyCode.Home, modifier.Ctrl, moveCursorToDocumentStart);
            keyDownHandler.bind(keyCode.End, modifier.Ctrl, moveCursorToDocumentEnd);
            keyDownHandler.bind(keyCode.Home, modifier.Shift, extendSelectionToLineStart);
            keyDownHandler.bind(keyCode.End, modifier.Shift, extendSelectionToLineEnd);
            keyDownHandler.bind(keyCode.Up, modifier.CtrlShift, extendSelectionToParagraphStart);
            keyDownHandler.bind(keyCode.Down, modifier.CtrlShift, extendSelectionToParagraphEnd);
            keyDownHandler.bind(keyCode.Home, modifier.CtrlShift, extendSelectionToDocumentStart);
            keyDownHandler.bind(keyCode.End, modifier.CtrlShift, extendSelectionToDocumentEnd);

            if (isMacOS) {
                keyDownHandler.bind(keyCode.Clear, modifier.None, textManipulator.removeCurrentSelection);
                keyDownHandler.bind(keyCode.Left, modifier.Meta, moveCursorToLineStart);
                keyDownHandler.bind(keyCode.Right, modifier.Meta, moveCursorToLineEnd);
                keyDownHandler.bind(keyCode.Home, modifier.Meta, moveCursorToDocumentStart);
                keyDownHandler.bind(keyCode.End, modifier.Meta, moveCursorToDocumentEnd);
                keyDownHandler.bind(keyCode.Left, modifier.MetaShift, extendSelectionToLineStart);
                keyDownHandler.bind(keyCode.Right, modifier.MetaShift, extendSelectionToLineEnd);
                keyDownHandler.bind(keyCode.Up, modifier.AltShift, extendSelectionToParagraphStart);
                keyDownHandler.bind(keyCode.Down, modifier.AltShift, extendSelectionToParagraphEnd);
                keyDownHandler.bind(keyCode.Up, modifier.MetaShift, extendSelectionToDocumentStart);
                keyDownHandler.bind(keyCode.Down, modifier.MetaShift, extendSelectionToDocumentEnd);
                keyDownHandler.bind(keyCode.A, modifier.Meta, extendSelectionToEntireDocument);
                if (directTextStyler) {
                    keyDownHandler.bind(keyCode.B, modifier.Meta, directTextStyler.toggleBold);
                    keyDownHandler.bind(keyCode.I, modifier.Meta, directTextStyler.toggleItalic);
                    keyDownHandler.bind(keyCode.U, modifier.Meta, directTextStyler.toggleUnderline);
                }
                if (directParagraphStyler) {
                    keyDownHandler.bind(keyCode.L, modifier.MetaShift, directParagraphStyler.alignParagraphLeft);
                    keyDownHandler.bind(keyCode.E, modifier.MetaShift, directParagraphStyler.alignParagraphCenter);
                    keyDownHandler.bind(keyCode.R, modifier.MetaShift, directParagraphStyler.alignParagraphRight);
                    keyDownHandler.bind(keyCode.J, modifier.MetaShift, directParagraphStyler.alignParagraphJustified);
                }
                keyDownHandler.bind(keyCode.Z, modifier.Meta, undo);
                keyDownHandler.bind(keyCode.Z, modifier.MetaShift, redo);
            } else {
                keyDownHandler.bind(keyCode.A, modifier.Ctrl, extendSelectionToEntireDocument);
                if (directTextStyler) {
                    keyDownHandler.bind(keyCode.B, modifier.Ctrl, directTextStyler.toggleBold);
                    keyDownHandler.bind(keyCode.I, modifier.Ctrl, directTextStyler.toggleItalic);
                    keyDownHandler.bind(keyCode.U, modifier.Ctrl, directTextStyler.toggleUnderline);
                }
                if (directParagraphStyler) {
                    keyDownHandler.bind(keyCode.L, modifier.CtrlShift, directParagraphStyler.alignParagraphLeft);
                    keyDownHandler.bind(keyCode.E, modifier.CtrlShift, directParagraphStyler.alignParagraphCenter);
                    keyDownHandler.bind(keyCode.R, modifier.CtrlShift, directParagraphStyler.alignParagraphRight);
                    keyDownHandler.bind(keyCode.J, modifier.CtrlShift, directParagraphStyler.alignParagraphJustified);
                }
                keyDownHandler.bind(keyCode.Z, modifier.Ctrl, undo);
                keyDownHandler.bind(keyCode.Z, modifier.CtrlShift, redo);
            }

            // the default action is to insert text into the document
            keyPressHandler.setDefault(function (e) {
                var text = stringFromKeyPress(e);
                if (text && !(e.altKey || e.ctrlKey || e.metaKey)) {
                    textManipulator.insertText(text);
                    return true;
                }
                return false;
            });
            keyPressHandler.bind(keyCode.Enter, modifier.None, textManipulator.enqueueParagraphSplittingOps);
        }

        init();
    };

    return gui.SessionController;
}());
// vim:expandtab
