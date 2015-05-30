/**
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, core, gui, Node, ops, odf */

/**
 * @constructor
 * @struct
 */
gui.SessionControllerOptions = function () {
    "use strict";

    /**
     * Sets whether direct paragraph styling should be enabled.
     * @type {!boolean}
     */
    this.directTextStylingEnabled = false;
    /**
     * Sets whether direct paragraph styling should be enabled.
     * @type {!boolean}
     */
    this.directParagraphStylingEnabled = false;
    /**
     * Sets whether annotation creation/deletion should be enabled.
     * @type {!boolean}
     */
    this.annotationsEnabled = false;
};

(function () {
    "use strict";

    var /**@const*/FILTER_ACCEPT = core.PositionFilter.FilterResult.FILTER_ACCEPT;

    /**
     * @constructor
     * @implements {core.Destroyable}
     * @param {!ops.Session} session
     * @param {!string} inputMemberId
     * @param {!ops.OdtCursor} shadowCursor
     * @param {!gui.SessionControllerOptions} args
     */
    gui.SessionController = function SessionController(session, inputMemberId, shadowCursor, args) {
        var /**@type{!Window}*/window = /**@type{!Window}*/(runtime.getWindow()),
            odtDocument = session.getOdtDocument(),
            sessionConstraints = new gui.SessionConstraints(),
            sessionContext = new gui.SessionContext(session, inputMemberId),
            domUtils = core.DomUtils,
            odfUtils = odf.OdfUtils,
            mimeDataExporter = new gui.MimeDataExporter(),
            clipboard = new gui.Clipboard(mimeDataExporter),
            keyDownHandler = new gui.KeyboardHandler(),
            keyPressHandler = new gui.KeyboardHandler(),
            keyUpHandler = new gui.KeyboardHandler(),
            /**@type{boolean}*/
            clickStartedWithinCanvas = false,
            objectNameGenerator = new odf.ObjectNameGenerator(odtDocument.getOdfCanvas().odfContainer(), inputMemberId),
            isMouseMoved = false,
            /**@type{core.PositionFilter}*/
            mouseDownRootFilter = null,
            handleMouseClickTimeoutId,
            undoManager = null,
            eventManager = new gui.EventManager(odtDocument),
            annotationsEnabled = args.annotationsEnabled,
            annotationController = new gui.AnnotationController(session, sessionConstraints, inputMemberId),
            directFormattingController = new gui.DirectFormattingController(session, sessionConstraints, sessionContext, inputMemberId, objectNameGenerator,
                                                                            args.directTextStylingEnabled, args.directParagraphStylingEnabled),
            createCursorStyleOp = /**@type {function (!number, !number, !boolean):ops.Operation}*/ (directFormattingController.createCursorStyleOp),
            createParagraphStyleOps = /**@type {function (!number):!Array.<!ops.Operation>}*/ (directFormattingController.createParagraphStyleOps),
            textController = new gui.TextController(session, sessionConstraints, sessionContext, inputMemberId, createCursorStyleOp, createParagraphStyleOps),
            imageController = new gui.ImageController(session, sessionConstraints, sessionContext, inputMemberId, objectNameGenerator),
            imageSelector = new gui.ImageSelector(odtDocument.getOdfCanvas()),
            shadowCursorIterator = odtDocument.createPositionIterator(odtDocument.getRootNode()),
            /**@type{!core.ScheduledTask}*/
            drawShadowCursorTask,
            /**@type{!core.ScheduledTask}*/
            redrawRegionSelectionTask,
            pasteController = new gui.PasteController(session, sessionConstraints, sessionContext, inputMemberId),
            inputMethodEditor = new gui.InputMethodEditor(inputMemberId, eventManager),
            /**@type{number}*/
            clickCount = 0,
            hyperlinkClickHandler = new gui.HyperlinkClickHandler(odtDocument.getOdfCanvas().getElement,
                                                                    keyDownHandler, keyUpHandler),
            hyperlinkController = new gui.HyperlinkController(session, sessionConstraints, sessionContext, inputMemberId),
            selectionController = new gui.SelectionController(session, inputMemberId),
            metadataController = new gui.MetadataController(session, inputMemberId),
            modifier = gui.KeyboardHandler.Modifier,
            keyCode = gui.KeyboardHandler.KeyCode,
            isMacOS = window.navigator.appVersion.toLowerCase().indexOf("mac") !== -1,
            isIOS = ["iPad", "iPod", "iPhone"].indexOf(window.navigator.platform) !== -1,
            /**@type{?gui.IOSSafariSupport}*/
            iOSSafariSupport;

        runtime.assert(window !== null,
            "Expected to be run in an environment which has a global window, like a browser.");

        /**
         * @param {!Event} e
         * @return {Node}
         */
        function getTarget(e) {
            // e.srcElement because IE10 likes to be different...
            return /**@type{Node}*/(e.target) || e.srcElement || null;
        }

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
         * @param {!number} x
         * @param {!number} y
         * @return {?{container:!Node, offset:!number}}
         */
        function caretPositionFromPoint(x, y) {
            var doc = odtDocument.getDOMDocument(),
                c,
                result = null;

            if (doc.caretRangeFromPoint) {
                c = doc.caretRangeFromPoint(x, y);
                result = {
                    container: /**@type{!Node}*/(c.startContainer),
                    offset: c.startOffset
                };
            } else if (doc.caretPositionFromPoint) {
                c = doc.caretPositionFromPoint(x, y);
                if (c && c.offsetNode) {
                    result = {
                        container: c.offsetNode,
                        offset: c.offset
                    };
                }
            }
            return result;
        }

        /**
         * If the user's current selection is region selection (e.g., an image), any executed operations
         * could cause the picture to shift relative to the selection rectangle.
         * @return {undefined}
         */
        function redrawRegionSelection() {
            var cursor = odtDocument.getCursor(inputMemberId),
                imageElement;

            if (cursor && cursor.getSelectionType() === ops.OdtCursor.RegionSelection) {
                imageElement = odfUtils.getImageElements(cursor.getSelectedRange())[0];
                if (imageElement) {
                    imageSelector.select(/**@type{!Element}*/(imageElement.parentNode));
                    return;
                }
            }

            // May have just processed our own remove cursor operation...
            // In this case, clear any image selection chrome to prevent user confusion
            imageSelector.clearSelection();
        }

        /**
         * @param {!Event} event
         * @return {?string}
         */
        function stringFromKeyPress(event) {
            if (event.which === null || event.which === undefined) {
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
                e.preventDefault();
                return;
            }

            // The document is readonly, so the data will never get placed on
            // the clipboard in most browsers unless we do it ourselves.
            if (clipboard.setDataFromRange(e, selectedRange)) {
                textController.removeCurrentSelection();
            } else {
                // TODO What should we do if cut isn't supported?
                runtime.log("Cut operation failed");
            }
        }

        /**
         * Tell the browser that it's ok to perform a cut action on our read-only body
         * @return {!boolean}
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
                // so copy shouldn't touch the clipboard if there is nothing
                // selected
                e.preventDefault();
                return;
            }

            // Place the data on the clipboard ourselves to ensure consistency
            // with cut behaviours
            if (!clipboard.setDataFromRange(e, selectedRange)) {
                // TODO What should we do if copy isn't supported?
                runtime.log("Copy operation failed");
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
                textController.removeCurrentSelection();
                pasteController.paste(plainText);
            }
            cancelEvent(e);
        }

        /**
         * Tell the browser that it's ok to perform a paste action on our read-only body
         * @return {!boolean}
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
            var hadFocusBefore;

            if (undoManager) {
                hadFocusBefore = eventManager.hasFocus();
                undoManager.moveBackward(1);
                if (hadFocusBefore) {
                    eventManager.focus();
                }
                return true;
            }

            return false;
        }
        // TODO it will soon be time to grow an UndoController
        this.undo = undo;

        /**
         * @return {!boolean}
         */
        function redo() {
            var hadFocusBefore;
            if (undoManager) {
                hadFocusBefore = eventManager.hasFocus();
                undoManager.moveForward(1);
                if (hadFocusBefore) {
                    eventManager.focus();
                }
                return true;
            }

            return false;
        }
        // TODO it will soon be time to grow an UndoController
        this.redo = redo;

        /**
         * This processes our custom drag events and if they are on
         * a selection handle (with the attribute 'end' denoting the left
         * or right handle), updates the shadow cursor's selection to
         * be on those endpoints.
         * @param {!Event} event
         * @return {undefined}
         */
        function extendSelectionByDrag(event) {
            var position,
                cursor = odtDocument.getCursor(inputMemberId),
                selectedRange = cursor.getSelectedRange(),
                newSelectionRange,
                /**@type{!string}*/
                handleEnd = /**@type{!Element}*/(getTarget(event)).getAttribute('end');

            if (selectedRange && handleEnd) {
                position = caretPositionFromPoint(event.clientX, event.clientY);
                if (position) {
                    shadowCursorIterator.setUnfilteredPosition(position.container, position.offset);
                    if (mouseDownRootFilter.acceptPosition(shadowCursorIterator) === FILTER_ACCEPT) {
                        newSelectionRange = /**@type{!Range}*/(selectedRange.cloneRange());
                        if (handleEnd === 'left') {
                            newSelectionRange.setStart(shadowCursorIterator.container(), shadowCursorIterator.unfilteredDomOffset());
                        } else {
                            newSelectionRange.setEnd(shadowCursorIterator.container(), shadowCursorIterator.unfilteredDomOffset());
                        }
                        shadowCursor.setSelectedRange(newSelectionRange, handleEnd === 'right');
                        odtDocument.emit(ops.Document.signalCursorMoved, shadowCursor);
                    }
                }
            }
        }

        function updateCursorSelection() {
            selectionController.selectRange(shadowCursor.getSelectedRange(), shadowCursor.hasForwardSelection(), 1);
        }

        function updateShadowCursor() {
            var selection = window.getSelection(),
                selectionRange = selection.rangeCount > 0 && selectionController.selectionToRange(selection);

            if (clickStartedWithinCanvas && selectionRange) {
                isMouseMoved = true;

                imageSelector.clearSelection();
                shadowCursorIterator.setUnfilteredPosition(/**@type {!Node}*/(selection.focusNode), selection.focusOffset);
                if (mouseDownRootFilter.acceptPosition(shadowCursorIterator) === FILTER_ACCEPT) {
                    if (clickCount === 2) {
                        selectionController.expandToWordBoundaries(selectionRange.range);
                    } else if (clickCount >= 3) {
                        selectionController.expandToParagraphBoundaries(selectionRange.range);
                    }
                    shadowCursor.setSelectedRange(selectionRange.range, selectionRange.hasForwardSelection);
                    odtDocument.emit(ops.Document.signalCursorMoved, shadowCursor);
                }
            }
        }

        /**
         * In order for drag operations to work, the browser needs to have it's current
         * selection set. This is called on mouse down to synchronize the user's last selection
         * to the browser selection
         * @param {ops.OdtCursor} cursor
         * @return {undefined}
         */
        function synchronizeWindowSelection(cursor) {
            var selection = window.getSelection(),
                range = cursor.getSelectedRange();

            if (selection.extend) {
                if (cursor.hasForwardSelection()) {
                    selection.collapse(range.startContainer, range.startOffset);
                    selection.extend(range.endContainer, range.endOffset);
                } else {
                    selection.collapse(range.endContainer, range.endOffset);
                    selection.extend(range.startContainer, range.startOffset);
                }
            } else {
                // Internet explorer does provide any method for
                // preserving the range direction
                // See http://msdn.microsoft.com/en-us/library/ie/ff974359%28v=vs.85%29.aspx
                // Unfortunately, clearing the range will also blur the current focus.
                selection.removeAllRanges();
                selection.addRange(range.cloneRange());
            }
        }

        /**
         * Return the number of mouse clicks if the mouse event is for the primary button. Otherwise return 0.
         * @param {!UIEvent} event
         * @return {!number}
         */
        function computeClickCount(event) {
            // According to the spec, button === 0 indicates the primary button (the left button by default, or the
            // right button if the user has switched their mouse buttons around).
            return event.button === 0 ? event.detail : 0;
        }

        /**
         * Updates a flag indicating whether the mouse down event occurred within the OdfCanvas element.
         * This is necessary because the mouse-up binding needs to be global in order to handle mouse-up
         * events that occur when the user releases the mouse button outside the canvas.
         * This filter limits selection changes to mouse down events that start inside the canvas
         * @param {!UIEvent} e
         */
        function handleMouseDown(e) {
            var target = getTarget(e),
                cursor = odtDocument.getCursor(inputMemberId),
                rootNode;
            clickStartedWithinCanvas = target !== null && domUtils.containsNode(odtDocument.getOdfCanvas().getElement(), target);
            if (clickStartedWithinCanvas) {
                isMouseMoved = false;
                rootNode = odtDocument.getRootElement(/**@type{!Node}*/(target)) || odtDocument.getRootNode();
                mouseDownRootFilter = odtDocument.createRootFilter(rootNode);
                clickCount = computeClickCount(e);
                if (cursor && e.shiftKey) {
                    // Firefox seems to get rather confused about the window selection when shift+extending it.
                    // Help this poor browser by resetting the window selection back to the anchor node if the user
                    // is holding shift.
                    window.getSelection().collapse(cursor.getAnchorNode(), 0);
                } else {
                    synchronizeWindowSelection(cursor);
                }
                if (clickCount > 1) {
                    updateShadowCursor();
                }
            }
        }

        /**
         * Return a mutable version of a selection-type object.
         * @param {?Selection} selection
         * @return {?{anchorNode: ?Node, anchorOffset: !number, focusNode: ?Node, focusOffset: !number}}
         */
        function mutableSelection(selection) {
            if (selection) {
                return {
                    anchorNode: selection.anchorNode,
                    anchorOffset: selection.anchorOffset,
                    focusNode: selection.focusNode,
                    focusOffset: selection.focusOffset
                };
            }
            return null;
        }

        /**
         * Gets the next walkable position after the given node.
         * @param {!Node} node
         * @return {?{container:!Node, offset:!number}}
         */
        function getNextWalkablePosition(node) {
            var root = odtDocument.getRootElement(node),
                rootFilter = odtDocument.createRootFilter(root),
                stepIterator = odtDocument.createStepIterator(node, 0, [rootFilter, odtDocument.getPositionFilter()], root);
            stepIterator.setPosition(node, node.childNodes.length);
            if (!stepIterator.roundToNextStep()) {
                return null;
            }
            return {
                container: stepIterator.container(),
                offset: stepIterator.offset()
            };
        }

        /**
         * Causes a cursor movement to the position hinted by a mouse click
         * event.
         * @param {!UIEvent} event
         * @return {undefined}
         */
        function moveByMouseClickEvent(event) {
            var selection = mutableSelection(window.getSelection()),
                isCollapsed = window.getSelection().isCollapsed,
                position,
                selectionRange,
                rect,
                frameNode;

            if (!selection.anchorNode && !selection.focusNode) {
                // chrome & safari will report null for focus and anchor nodes after a right-click in text selection
                position = caretPositionFromPoint(event.clientX, event.clientY);
                if (position) {
                    selection.anchorNode = /**@type{!Node}*/(position.container);
                    selection.anchorOffset = position.offset;
                    selection.focusNode = selection.anchorNode;
                    selection.focusOffset = selection.anchorOffset;
                }
            }

            if (odfUtils.isImage(selection.focusNode) && selection.focusOffset === 0
                && odfUtils.isCharacterFrame(selection.focusNode.parentNode)) {
                // In FireFox if an image has no text around it, click on either side of the
                // image resulting the same selection get returned. focusNode: image, focusOffset: 0
                // Move the cursor to the next walkable position when clicking on the right side of an image
                frameNode = /**@type{!Element}*/(selection.focusNode.parentNode);
                rect = frameNode.getBoundingClientRect();
                if (event.clientX > rect.left) {
                    // On OSX, right-clicking on an image at the end of a range selection will hit
                    // this particular branch. The image should remain selected if the right-click occurs on top
                    // of it as technically it's the same behaviour as right clicking on an existing text selection.
                    position = getNextWalkablePosition(frameNode);
                    if (position) {
                        selection.focusNode = position.container;
                        selection.focusOffset = position.offset;
                        if (isCollapsed) {
                            // See above comment for the circumstances when the range might not be collapsed
                            selection.anchorNode = selection.focusNode;
                            selection.anchorOffset = selection.focusOffset;
                        }
                    }
                }
            } else if (odfUtils.isImage(selection.focusNode.firstChild) && selection.focusOffset === 1
                && odfUtils.isCharacterFrame(selection.focusNode)) {
                // When click on the right side of an image that has no text elements, non-FireFox browsers
                // will return focusNode: frame, focusOffset: 1 as the selection. Since this is not a valid cursor
                // position, move the cursor to the next walkable position after the frame node.

                // To activate this branch (only applicable on OSX + Linux WebKit-derived browsers AFAIK):
                // 1. With a paragraph containing some text followed by an inline image and no trailing text,
                //    select from the start of paragraph to the end.
                // 2. Now click once to the right hand side of the image. The cursor *should* jump to the right side
                position = getNextWalkablePosition(selection.focusNode);
                if (position) {
                    // This should only ever be hit when the selection is intended to become collapsed
                    selection.anchorNode = selection.focusNode = position.container;
                    selection.anchorOffset = selection.focusOffset = position.offset;
                }
            }

            // Need to check the selection again in case the caret position didn't return any result
            if (selection.anchorNode && selection.focusNode) {
                selectionRange = selectionController.selectionToRange(selection);
                selectionController.selectRange(selectionRange.range,
                    selectionRange.hasForwardSelection, computeClickCount(event));
            }
            eventManager.focus(); // Mouse clicks often cause focus to shift. Recapture this straight away
        }

        /**
         * @param {!Event} event
         * @return {undefined}
         */
        function selectWordByLongPress(event) {
            var /**@type{?{anchorNode: ?Node, anchorOffset: !number, focusNode: ?Node, focusOffset: !number}}*/
                selection,
                position,
                selectionRange,
                container, offset;

            position = caretPositionFromPoint(event.clientX, event.clientY);
            if (position) {
                container = /**@type{!Node}*/(position.container);
                offset = position.offset;

                selection = {
                    anchorNode: container,
                    anchorOffset: offset,
                    focusNode: container,
                    focusOffset: offset
                };

                selectionRange = selectionController.selectionToRange(selection);
                selectionController.selectRange(selectionRange.range,
                selectionRange.hasForwardSelection, 2);
                eventManager.focus();
            }
        }

        /**
         * @param {!UIEvent} event
         * @return {undefined}
         */
        function handleMouseClickEvent(event) {
            var target = getTarget(event),
                clickEvent,
                range,
                wasCollapsed,
                frameNode,
                pos;

            drawShadowCursorTask.processRequests(); // Resynchronise the shadow cursor before processing anything else

            if (clickStartedWithinCanvas) {
                // Each mouse down event should only ever result in a single mouse click being processed.
                // This is to cope with there being no hard rules about whether a contextmenu
                // should be followed by a mouseup as well according to the HTML5 specs.
                // See http://www.whatwg.org/specs/web-apps/current-work/multipage/interactive-elements.html#context-menus

                // We don't want to just select the image if it is a range selection hence ensure the selection is collapsed.
                if (odfUtils.isImage(target) && odfUtils.isCharacterFrame(target.parentNode) && window.getSelection().isCollapsed) {
                    selectionController.selectImage(/**@type{!Node}*/(target.parentNode));
                    eventManager.focus(); // Mouse clicks often cause focus to shift. Recapture this straight away
                } else if (imageSelector.isSelectorElement(target)) {
                    eventManager.focus(); // Mouse clicks often cause focus to shift. Recapture this straight away
                } else if (isMouseMoved) {
                    range = shadowCursor.getSelectedRange();
                    wasCollapsed = range.collapsed;
                    // Resets the endContainer and endOffset when a forward selection end up on an image;
                    // Otherwise the image will not be selected because endContainer: image, endOffset 0 is not a valid
                    // cursor position.
                    if (odfUtils.isImage(range.endContainer) && range.endOffset === 0
                            && odfUtils.isCharacterFrame(range.endContainer.parentNode)) {
                        frameNode = /**@type{!Element}*/(range.endContainer.parentNode);
                        pos = getNextWalkablePosition(frameNode);
                        if (pos) {
                            range.setEnd(pos.container, pos.offset);
                            if (wasCollapsed) {
                                range.collapse(false); // collapses the range to its end
                            }
                        }
                    }
                    selectionController.selectRange(range, shadowCursor.hasForwardSelection(), computeClickCount(event));
                    eventManager.focus(); // Mouse clicks often cause focus to shift. Recapture this straight away
                } else {
                    // Clicking in already selected text won't update window.getSelection() until just after
                    // the click is processed. Set 0 timeout here so the newly clicked position can be updated
                    // by the browser. Unfortunately this is only working in Firefox. For other browsers, we have to work
                    // out the caret position from two coordinates.
                    // In iOS, however, it is not possible to assign focus within a timeout. But in that case
                    // we do not even need a timeout, because we do not use native selections at all there,
                    // therefore for that platform, just directly move by the mouse click and give focus.
                    if (isIOS) {
                        moveByMouseClickEvent(event);
                    } else {
                        // IE10 destructs event objects once the event handler is done, so create a copy of the data.
                        // "The event object is only available during an event; that is, you can use it in event handlers but not in other code"
                        // (from http://msdn.microsoft.com/en-us/library/ie/aa703876(v=vs.85).aspx)
                        // TODO: IE10 on a test machine does not have the "detail" property set on "mouseup" events here,
                        // even if the docs claim it should exist, cmp. http://msdn.microsoft.com/en-au/library/ie/ff974344(v=vs.85).aspx
                        // So doubleclicks will not be detected on (some?) IE currently.
                        clickEvent = /**@type{!UIEvent}*/(domUtils.cloneEvent(event));
                        handleMouseClickTimeoutId = runtime.setTimeout(function () {
                            moveByMouseClickEvent(clickEvent);
                        }, 0);
                    }
                }
                // TODO assumes the mouseup/contextmenu is the same button as the mousedown that initialized the clickCount
                clickCount = 0;
                clickStartedWithinCanvas = false;
                isMouseMoved = false;
            }
        }

        /**
         * @param {!MouseEvent} e
         * @return {undefined}
         */
        function handleDragStart(e) {
            var cursor = odtDocument.getCursor(inputMemberId),
                selectedRange = cursor.getSelectedRange();

            if (selectedRange.collapsed) {
                return;
            }

            mimeDataExporter.exportRangeToDataTransfer(/**@type{!DataTransfer}*/(e.dataTransfer), selectedRange);
        }

        function handleDragEnd() {
            // Drag operations consume the corresponding mouse up event.
            // If this happens, the selection should still be reset.
            if (clickStartedWithinCanvas) {
                eventManager.focus();
            }
            clickCount = 0;
            clickStartedWithinCanvas = false;
            isMouseMoved = false;
        }

        /**
         * @param {!UIEvent} e
         */
        function handleContextMenu(e) {
            // TODO Various browsers have different default behaviours on right click
            // We can detect this at runtime without doing any kind of platform sniffing
            // simply by observing what the browser has tried to do on right-click.
            // - OSX: Safari/Chrome - Expand to word boundary
            // - OSX: Firefox - No expansion
            // - Windows: Safari/Chrome/Firefox - No expansion
            handleMouseClickEvent(e);
        }

        /**
         * @param {!UIEvent} event
         */
        function handleMouseUp(event) {
            var target = /**@type{!Element}*/(getTarget(event)),
                annotationNode = null;

            if (target.className === "annotationRemoveButton") {
                runtime.assert(annotationsEnabled, "Remove buttons are displayed on annotations while annotation editing is disabled in the controller.");
                annotationNode = /**@type{!Element}*/(target.parentNode).getElementsByTagNameNS(odf.Namespaces.officens, 'annotation').item(0);
                annotationController.removeAnnotation(/**@type{!Element}*/(annotationNode));
                eventManager.focus();
            } else {
                if (target.getAttribute('class') !== 'webodf-draggable') {
                    handleMouseClickEvent(event);
                }
            }
        }

        /**
         * Handle composition end event. If there is data specified, treat this as text
         * to be inserted into the document.
         * @param {!CompositionEvent} e
         */
        function insertNonEmptyData(e) {
            // https://dvcs.w3.org/hg/dom3events/raw-file/tip/html/DOM3-Events.html#event-type-compositionend
            var input = e.data;
            if (input) {
                if (input.indexOf("\n") === -1) {
                    textController.insertText(input);
                } else {
                    // Multi-line input should be handled as if it was pasted, rather than inserted as one giant
                    // single string.
                    pasteController.paste(input);
                }
            }
        }

        /**
         * Executes the provided function and returns true
         * Used to swallow events regardless of whether an operation was created
         * @param {!Function} fn
         * @return {!Function}
         */
        function returnTrue(fn) {
            return function () {
                fn();
                return true;
            };
        }

        /**
         * Executes the given function on range selection only
         * @param {function(T):(boolean|undefined)} fn
         * @return {function(T):(boolean|undefined)}
         * @template T
         */
        function rangeSelectionOnly(fn) {
            /**
             * @param {*} e
             * @return {!boolean|undefined}
             */
            function f(e) {
                var selectionType = odtDocument.getCursor(inputMemberId).getSelectionType();
                if (selectionType === ops.OdtCursor.RangeSelection) {
                    return fn(e);
                }
                return true;
            }
            return f;
        }

        /**
         * Inserts the local cursor.
         * @return {undefined}
         */
        function insertLocalCursor() {
            runtime.assert(session.getOdtDocument().getCursor(inputMemberId) === undefined, "Inserting local cursor a second time.");

            var op = new ops.OpAddCursor();
            op.init({memberid: inputMemberId});
            session.enqueue([op]);
            // Immediately capture focus when the local cursor is inserted
            eventManager.focus();
        }
        this.insertLocalCursor = insertLocalCursor;


        /**
         * Removes the local cursor.
         * @return {undefined}
         */
        function removeLocalCursor() {
            runtime.assert(session.getOdtDocument().getCursor(inputMemberId) !== undefined, "Removing local cursor without inserting before.");

            var op = new ops.OpRemoveCursor();
            op.init({memberid: inputMemberId});
            session.enqueue([op]);
        }
        this.removeLocalCursor = removeLocalCursor;

        /**
         * @return {undefined}
         */
        this.startEditing = function () {
            inputMethodEditor.subscribe(gui.InputMethodEditor.signalCompositionStart, textController.removeCurrentSelection);
            inputMethodEditor.subscribe(gui.InputMethodEditor.signalCompositionEnd, insertNonEmptyData);

            eventManager.subscribe("beforecut", handleBeforeCut);
            eventManager.subscribe("cut", handleCut);
            eventManager.subscribe("beforepaste", handleBeforePaste);
            eventManager.subscribe("paste", handlePaste);

            if (undoManager) {
                // For most undo managers, the initial state is a clean document *with* a cursor present
                undoManager.initialize();
            }

            eventManager.setEditing(true);
            hyperlinkClickHandler.setModifier(isMacOS ? modifier.Meta : modifier.Ctrl);
            // Most browsers will go back one page when given an unhandled backspace press
            // To prevent this, the event handler for this key should always return true
            keyDownHandler.bind(keyCode.Backspace, modifier.None, returnTrue(textController.removeTextByBackspaceKey), true);
            keyDownHandler.bind(keyCode.Delete, modifier.None, textController.removeTextByDeleteKey);

            // TODO: deselect the currently selected image when press Esc
            // TODO: move the image selection box to next image/frame when press tab on selected image
            keyDownHandler.bind(keyCode.Tab, modifier.None, rangeSelectionOnly(function () {
                textController.insertText("\t");
                return true;
            }));

            if (isMacOS) {
                keyDownHandler.bind(keyCode.Clear, modifier.None, textController.removeCurrentSelection);
                keyDownHandler.bind(keyCode.B, modifier.Meta, rangeSelectionOnly(directFormattingController.toggleBold));
                keyDownHandler.bind(keyCode.I, modifier.Meta, rangeSelectionOnly(directFormattingController.toggleItalic));
                keyDownHandler.bind(keyCode.U, modifier.Meta, rangeSelectionOnly(directFormattingController.toggleUnderline));
                keyDownHandler.bind(keyCode.L, modifier.MetaShift, rangeSelectionOnly(directFormattingController.alignParagraphLeft));
                keyDownHandler.bind(keyCode.E, modifier.MetaShift, rangeSelectionOnly(directFormattingController.alignParagraphCenter));
                keyDownHandler.bind(keyCode.R, modifier.MetaShift, rangeSelectionOnly(directFormattingController.alignParagraphRight));
                keyDownHandler.bind(keyCode.J, modifier.MetaShift, rangeSelectionOnly(directFormattingController.alignParagraphJustified));
                if (annotationsEnabled) {
                    keyDownHandler.bind(keyCode.C, modifier.MetaShift, annotationController.addAnnotation);
                }
                keyDownHandler.bind(keyCode.Z, modifier.Meta, undo);
                keyDownHandler.bind(keyCode.Z, modifier.MetaShift, redo);
            } else {
                keyDownHandler.bind(keyCode.B, modifier.Ctrl, rangeSelectionOnly(directFormattingController.toggleBold));
                keyDownHandler.bind(keyCode.I, modifier.Ctrl, rangeSelectionOnly(directFormattingController.toggleItalic));
                keyDownHandler.bind(keyCode.U, modifier.Ctrl, rangeSelectionOnly(directFormattingController.toggleUnderline));
                keyDownHandler.bind(keyCode.L, modifier.CtrlShift, rangeSelectionOnly(directFormattingController.alignParagraphLeft));
                keyDownHandler.bind(keyCode.E, modifier.CtrlShift, rangeSelectionOnly(directFormattingController.alignParagraphCenter));
                keyDownHandler.bind(keyCode.R, modifier.CtrlShift, rangeSelectionOnly(directFormattingController.alignParagraphRight));
                keyDownHandler.bind(keyCode.J, modifier.CtrlShift, rangeSelectionOnly(directFormattingController.alignParagraphJustified));
                if (annotationsEnabled) {
                    keyDownHandler.bind(keyCode.C, modifier.CtrlAlt, annotationController.addAnnotation);
                }
                keyDownHandler.bind(keyCode.Z, modifier.Ctrl, undo);
                keyDownHandler.bind(keyCode.Z, modifier.CtrlShift, redo);
            }

            // the default action is to insert text into the document
            /**
             * @param {!KeyboardEvent} e
             * @return {boolean|undefined}
             */
            function handler(e) {
                var text = stringFromKeyPress(e);
                if (text && !(e.altKey || e.ctrlKey || e.metaKey)) {
                    textController.insertText(text);
                    return true;
                }
                return false;
            }
            keyPressHandler.setDefault(rangeSelectionOnly(handler));
            keyPressHandler.bind(keyCode.Enter, modifier.None, rangeSelectionOnly(textController.enqueueParagraphSplittingOps));
        };

        /**
         * @return {undefined}
         */
        this.endEditing = function () {
            inputMethodEditor.unsubscribe(gui.InputMethodEditor.signalCompositionStart, textController.removeCurrentSelection);
            inputMethodEditor.unsubscribe(gui.InputMethodEditor.signalCompositionEnd, insertNonEmptyData);

            eventManager.unsubscribe("cut", handleCut);
            eventManager.unsubscribe("beforecut", handleBeforeCut);
            eventManager.unsubscribe("paste", handlePaste);
            eventManager.unsubscribe("beforepaste", handleBeforePaste);

            eventManager.setEditing(false);
            hyperlinkClickHandler.setModifier(modifier.None);
            keyDownHandler.bind(keyCode.Backspace, modifier.None, function () { return true; }, true);
            keyDownHandler.unbind(keyCode.Delete, modifier.None);
            keyDownHandler.unbind(keyCode.Tab, modifier.None);

            if (isMacOS) {
                keyDownHandler.unbind(keyCode.Clear, modifier.None);
                keyDownHandler.unbind(keyCode.B, modifier.Meta);
                keyDownHandler.unbind(keyCode.I, modifier.Meta);
                keyDownHandler.unbind(keyCode.U, modifier.Meta);
                keyDownHandler.unbind(keyCode.L, modifier.MetaShift);
                keyDownHandler.unbind(keyCode.E, modifier.MetaShift);
                keyDownHandler.unbind(keyCode.R, modifier.MetaShift);
                keyDownHandler.unbind(keyCode.J, modifier.MetaShift);
                if (annotationsEnabled) {
                    keyDownHandler.unbind(keyCode.C, modifier.MetaShift);
                }
                keyDownHandler.unbind(keyCode.Z, modifier.Meta);
                keyDownHandler.unbind(keyCode.Z, modifier.MetaShift);
            } else {
                keyDownHandler.unbind(keyCode.B, modifier.Ctrl);
                keyDownHandler.unbind(keyCode.I, modifier.Ctrl);
                keyDownHandler.unbind(keyCode.U, modifier.Ctrl);
                keyDownHandler.unbind(keyCode.L, modifier.CtrlShift);
                keyDownHandler.unbind(keyCode.E, modifier.CtrlShift);
                keyDownHandler.unbind(keyCode.R, modifier.CtrlShift);
                keyDownHandler.unbind(keyCode.J, modifier.CtrlShift);
                if (annotationsEnabled) {
                    keyDownHandler.unbind(keyCode.C, modifier.CtrlAlt);
                }
                keyDownHandler.unbind(keyCode.Z, modifier.Ctrl);
                keyDownHandler.unbind(keyCode.Z, modifier.CtrlShift);
            }

            keyPressHandler.setDefault(null);
            keyPressHandler.unbind(keyCode.Enter, modifier.None);
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
         * @return {!gui.SessionConstraints}
         */
        this.getSessionConstraints = function () {
            return sessionConstraints;
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
                undoManager.setDocument(odtDocument);
                // As per gui.UndoManager, this should NOT fire any signals or report
                // events being executed back to the undo manager.
                undoManager.setPlaybackFunction(session.enqueue);
                undoManager.subscribe(gui.UndoManager.signalUndoStackChanged, forwardUndoStackChange);
            }
        };

        /**
         * @return {?gui.UndoManager}
         */
        this.getUndoManager = function () {
            return undoManager;
        };

        /**
         * @return {!gui.MetadataController}
         */
        this.getMetadataController = function () {
            return metadataController;
        };

        /**
         * @return {?gui.AnnotationController}
         */
        this.getAnnotationController = function () {
            return annotationController;
        };

        /**
         * @return {!gui.DirectFormattingController}
         */
        this.getDirectFormattingController = function () {
            return directFormattingController;
        };

        /**
         * @return {!gui.HyperlinkClickHandler}
         */
        this.getHyperlinkClickHandler = function () {
            return hyperlinkClickHandler;
        };

        /**
         * @return {!gui.HyperlinkController}
         */
        this.getHyperlinkController = function () {
            return hyperlinkController;
        };

        /**
         * @return {!gui.ImageController}
         */
        this.getImageController = function () {
            return imageController;
        };

        /**
         * @return {!gui.SelectionController}
         */
        this.getSelectionController = function () {
            return selectionController;
        };

        /**
         * @return {!gui.TextController}
         */
        this.getTextController = function () {
            return textController;
        };

        /**
         * @return {!gui.EventManager}
         */
        this.getEventManager = function() {
            return eventManager;
        };

        /**
         * Return the keyboard event handlers
         * @return {{keydown: gui.KeyboardHandler, keypress: gui.KeyboardHandler}}
         */
        this.getKeyboardHandlers = function () {
            return {
                keydown: keyDownHandler,
                keypress: keyPressHandler
            };
        };

        /**
         * @param {!function(!Object=)} callback passing an error object in case of error
         * @return {undefined}
         */
        function destroy(callback) {
            eventManager.unsubscribe("keydown", keyDownHandler.handleEvent);
            eventManager.unsubscribe("keypress", keyPressHandler.handleEvent);
            eventManager.unsubscribe("keyup", keyUpHandler.handleEvent);
            eventManager.unsubscribe("copy", handleCopy);
            eventManager.unsubscribe("mousedown", handleMouseDown);
            eventManager.unsubscribe("mousemove", drawShadowCursorTask.trigger);
            eventManager.unsubscribe("mouseup", handleMouseUp);
            eventManager.unsubscribe("contextmenu", handleContextMenu);
            eventManager.unsubscribe("dragstart", handleDragStart);
            eventManager.unsubscribe("dragend", handleDragEnd);
            eventManager.unsubscribe("click", hyperlinkClickHandler.handleClick);
            eventManager.unsubscribe("longpress", selectWordByLongPress);
            eventManager.unsubscribe("drag", extendSelectionByDrag);
            eventManager.unsubscribe("dragstop", updateCursorSelection);

            odtDocument.unsubscribe(ops.OdtDocument.signalOperationEnd, redrawRegionSelectionTask.trigger);
            odtDocument.unsubscribe(ops.Document.signalCursorAdded, inputMethodEditor.registerCursor);
            odtDocument.unsubscribe(ops.Document.signalCursorRemoved, inputMethodEditor.removeCursor);
            odtDocument.unsubscribe(ops.OdtDocument.signalOperationEnd, updateUndoStack);

            callback();
        }

        /**
         * @param {!function(!Error=)} callback passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function (callback) {
            var destroyCallbacks = [
                drawShadowCursorTask.destroy,
                redrawRegionSelectionTask.destroy,
                directFormattingController.destroy,
                inputMethodEditor.destroy,
                eventManager.destroy,
                hyperlinkClickHandler.destroy,
                hyperlinkController.destroy,
                metadataController.destroy,
                selectionController.destroy,
                textController.destroy,
                destroy
            ];

            if (iOSSafariSupport) {
                destroyCallbacks.unshift(iOSSafariSupport.destroy);
            }

            runtime.clearTimeout(handleMouseClickTimeoutId);
            core.Async.destroyAll(destroyCallbacks, callback);
        };

        function init() {
            drawShadowCursorTask = core.Task.createRedrawTask(updateShadowCursor);
            redrawRegionSelectionTask = core.Task.createRedrawTask(redrawRegionSelection);

            keyDownHandler.bind(keyCode.Left, modifier.None, rangeSelectionOnly(selectionController.moveCursorToLeft));
            keyDownHandler.bind(keyCode.Right, modifier.None, rangeSelectionOnly(selectionController.moveCursorToRight));
            keyDownHandler.bind(keyCode.Up, modifier.None, rangeSelectionOnly(selectionController.moveCursorUp));
            keyDownHandler.bind(keyCode.Down, modifier.None, rangeSelectionOnly(selectionController.moveCursorDown));
            keyDownHandler.bind(keyCode.Left, modifier.Shift, rangeSelectionOnly(selectionController.extendSelectionToLeft));
            keyDownHandler.bind(keyCode.Right, modifier.Shift, rangeSelectionOnly(selectionController.extendSelectionToRight));
            keyDownHandler.bind(keyCode.Up, modifier.Shift, rangeSelectionOnly(selectionController.extendSelectionUp));
            keyDownHandler.bind(keyCode.Down, modifier.Shift, rangeSelectionOnly(selectionController.extendSelectionDown));
            keyDownHandler.bind(keyCode.Home, modifier.None, rangeSelectionOnly(selectionController.moveCursorToLineStart));
            keyDownHandler.bind(keyCode.End, modifier.None, rangeSelectionOnly(selectionController.moveCursorToLineEnd));
            keyDownHandler.bind(keyCode.Home, modifier.Ctrl, rangeSelectionOnly(selectionController.moveCursorToDocumentStart));
            keyDownHandler.bind(keyCode.End, modifier.Ctrl, rangeSelectionOnly(selectionController.moveCursorToDocumentEnd));
            keyDownHandler.bind(keyCode.Home, modifier.Shift, rangeSelectionOnly(selectionController.extendSelectionToLineStart));
            keyDownHandler.bind(keyCode.End, modifier.Shift, rangeSelectionOnly(selectionController.extendSelectionToLineEnd));
            keyDownHandler.bind(keyCode.Up, modifier.CtrlShift, rangeSelectionOnly(selectionController.extendSelectionToParagraphStart));
            keyDownHandler.bind(keyCode.Down, modifier.CtrlShift, rangeSelectionOnly(selectionController.extendSelectionToParagraphEnd));
            keyDownHandler.bind(keyCode.Home, modifier.CtrlShift, rangeSelectionOnly(selectionController.extendSelectionToDocumentStart));
            keyDownHandler.bind(keyCode.End, modifier.CtrlShift, rangeSelectionOnly(selectionController.extendSelectionToDocumentEnd));

            if (isMacOS) {
                keyDownHandler.bind(keyCode.Left, modifier.Alt, rangeSelectionOnly(selectionController.moveCursorBeforeWord));
                keyDownHandler.bind(keyCode.Right, modifier.Alt, rangeSelectionOnly(selectionController.moveCursorPastWord));
                keyDownHandler.bind(keyCode.Left, modifier.Meta, rangeSelectionOnly(selectionController.moveCursorToLineStart));
                keyDownHandler.bind(keyCode.Right, modifier.Meta, rangeSelectionOnly(selectionController.moveCursorToLineEnd));
                keyDownHandler.bind(keyCode.Home, modifier.Meta, rangeSelectionOnly(selectionController.moveCursorToDocumentStart));
                keyDownHandler.bind(keyCode.End, modifier.Meta, rangeSelectionOnly(selectionController.moveCursorToDocumentEnd));
                keyDownHandler.bind(keyCode.Left, modifier.AltShift, rangeSelectionOnly(selectionController.extendSelectionBeforeWord));
                keyDownHandler.bind(keyCode.Right, modifier.AltShift, rangeSelectionOnly(selectionController.extendSelectionPastWord));
                keyDownHandler.bind(keyCode.Left, modifier.MetaShift, rangeSelectionOnly(selectionController.extendSelectionToLineStart));
                keyDownHandler.bind(keyCode.Right, modifier.MetaShift, rangeSelectionOnly(selectionController.extendSelectionToLineEnd));
                keyDownHandler.bind(keyCode.Up, modifier.AltShift, rangeSelectionOnly(selectionController.extendSelectionToParagraphStart));
                keyDownHandler.bind(keyCode.Down, modifier.AltShift, rangeSelectionOnly(selectionController.extendSelectionToParagraphEnd));
                keyDownHandler.bind(keyCode.Up, modifier.MetaShift, rangeSelectionOnly(selectionController.extendSelectionToDocumentStart));
                keyDownHandler.bind(keyCode.Down, modifier.MetaShift, rangeSelectionOnly(selectionController.extendSelectionToDocumentEnd));
                keyDownHandler.bind(keyCode.A, modifier.Meta, rangeSelectionOnly(selectionController.extendSelectionToEntireDocument));
            } else {
                keyDownHandler.bind(keyCode.Left, modifier.Ctrl, rangeSelectionOnly(selectionController.moveCursorBeforeWord));
                keyDownHandler.bind(keyCode.Right, modifier.Ctrl, rangeSelectionOnly(selectionController.moveCursorPastWord));
                keyDownHandler.bind(keyCode.Left, modifier.CtrlShift, rangeSelectionOnly(selectionController.extendSelectionBeforeWord));
                keyDownHandler.bind(keyCode.Right, modifier.CtrlShift, rangeSelectionOnly(selectionController.extendSelectionPastWord));
                keyDownHandler.bind(keyCode.A, modifier.Ctrl, rangeSelectionOnly(selectionController.extendSelectionToEntireDocument));
            }

            if (isIOS) {
                iOSSafariSupport = new gui.IOSSafariSupport(eventManager);
            }

            eventManager.subscribe("keydown", keyDownHandler.handleEvent);
            eventManager.subscribe("keypress", keyPressHandler.handleEvent);
            eventManager.subscribe("keyup", keyUpHandler.handleEvent);
            eventManager.subscribe("copy", handleCopy);
            eventManager.subscribe("mousedown", handleMouseDown);
            eventManager.subscribe("mousemove", drawShadowCursorTask.trigger);
            eventManager.subscribe("mouseup", handleMouseUp);
            eventManager.subscribe("contextmenu", handleContextMenu);
            eventManager.subscribe("dragstart", handleDragStart);
            eventManager.subscribe("dragend", handleDragEnd);
            eventManager.subscribe("click", hyperlinkClickHandler.handleClick);
            eventManager.subscribe("longpress", selectWordByLongPress);
            eventManager.subscribe("drag", extendSelectionByDrag);
            eventManager.subscribe("dragstop", updateCursorSelection);

            odtDocument.subscribe(ops.OdtDocument.signalOperationEnd, redrawRegionSelectionTask.trigger);
            odtDocument.subscribe(ops.Document.signalCursorAdded, inputMethodEditor.registerCursor);
            odtDocument.subscribe(ops.Document.signalCursorRemoved, inputMethodEditor.removeCursor);
            odtDocument.subscribe(ops.OdtDocument.signalOperationEnd, updateUndoStack);
        }

        init();
    };
}());
// vim:expandtab
