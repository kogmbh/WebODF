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

/*global runtime, core, gui, Node, ops, odf */

(function () {
    "use strict";

    var /**@const*/FILTER_ACCEPT = core.PositionFilter.FilterResult.FILTER_ACCEPT;

    /**
     * @constructor
     * @implements {core.Destroyable}
     * @param {!ops.Session} session
     * @param {!string} inputMemberId
     * @param {!ops.OdtCursor} shadowCursor
     * @param {!{directParagraphStylingEnabled:boolean}=} args
     */
    gui.SessionController = function SessionController(session, inputMemberId, shadowCursor, args) {
        var /**@type{!Window}*/window = /**@type{!Window}*/(runtime.getWindow()),
            odtDocument = session.getOdtDocument(),
            async = new core.Async(),
            /**@type{!core.DomUtils}*/
            domUtils = new core.DomUtils(),
            odfUtils = new odf.OdfUtils(),
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
            annotationController = new gui.AnnotationController(session, inputMemberId),
            directFormattingController = new gui.DirectFormattingController(session, inputMemberId, objectNameGenerator, args.directParagraphStylingEnabled),
            createCursorStyleOp = /**@type {function (!number, !number, !boolean):ops.Operation}*/ (directFormattingController.createCursorStyleOp),
            createParagraphStyleOps = /**@type {function (!number):!Array.<!ops.Operation>}*/ (directFormattingController.createParagraphStyleOps),
            textController = new gui.TextController(session, inputMemberId, createCursorStyleOp, createParagraphStyleOps),
            imageController = new gui.ImageController(session, inputMemberId, objectNameGenerator),
            imageSelector = new gui.ImageSelector(odtDocument.getOdfCanvas()),
            shadowCursorIterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
            /**@type{!core.ScheduledTask}*/
            drawShadowCursorTask,
            /**@type{!core.ScheduledTask}*/
            redrawRegionSelectionTask,
            pasteHandler = new gui.PlainTextPasteboard(odtDocument, inputMemberId),
            inputMethodEditor = new gui.InputMethodEditor(inputMemberId, odtDocument, eventManager),
            /**@type{number}*/
            clickCount = 0,
            hyperlinkClickHandler = new gui.HyperlinkClickHandler(odtDocument.getRootNode),
            hyperlinkController = new gui.HyperlinkController(session, inputMemberId),
            selectionController = new gui.SelectionController(session, inputMemberId),
            modifier = gui.KeyboardHandler.Modifier,
            keyCode = gui.KeyboardHandler.KeyCode,
            isMacOS = window.navigator.appVersion.toLowerCase().indexOf("mac") !== -1;

        runtime.assert(window !== null,
            "Expected to be run in an environment which has a global window, like a browser.");

        /**
         * param {{target:(!Element|undefined),srcElement:(!Element|undefined)}} e
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
                session.enqueue(pasteHandler.createPasteOps(plainText));
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
            if (undoManager) {
                undoManager.moveBackward(1);
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
                return true;
            }

            return false;
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
                    odtDocument.emit(ops.OdtDocument.signalCursorMoved, shadowCursor);
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
         * Updates a flag indicating whether the mouse down event occurred within the OdfCanvas element.
         * This is necessary because the mouse-up binding needs to be global in order to handle mouse-up
         * events that occur when the user releases the mouse button outside the canvas.
         * This filter limits selection changes to mouse down events that start inside the canvas
         * @param {!Event} e
         */
        function handleMouseDown(e) {
            var target = getTarget(e),
                cursor = odtDocument.getCursor(inputMemberId);
            clickStartedWithinCanvas = target !== null && domUtils.containsNode(odtDocument.getOdfCanvas().getElement(), target);
            if (clickStartedWithinCanvas) {
                isMouseMoved = false;
                mouseDownRootFilter = odtDocument.createRootFilter(/**@type{!Node}*/(target));
                clickCount = e.detail;
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
         * @param {!Event} event
         */
        function moveByMouseClickEvent(event) {
            var selection = mutableSelection(window.getSelection()),
                selectionRange,
                position,
                frameNode,
                rect;
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

            if (odfUtils.isImage(selection.focusNode) && selection.focusOffset === 0) {
                // In FireFox if an image has no text around it, click on either side of the
                // image resulting the same selection get returned. focusNode: image, focusOffset: 0
                // Move the cursor to the next walkable position when clicking on the right side of an image
                frameNode = /**@type{!Element}*/(selection.anchorNode.parentNode);
                rect = frameNode.getBoundingClientRect();
                if (event.clientX > rect.right) {
                    position = getNextWalkablePosition(frameNode);
                    if (position) {
                        selection.anchorNode = selection.focusNode = position.container;
                        selection.anchorOffset = selection.focusOffset = position.offset;
                    }
                }
            } else if (odfUtils.isImage(selection.focusNode.firstChild) && selection.focusOffset === 1) {
                // When click on the right side of an image that has no text elements, non-FireFox browsers
                // will return focusNode: frame, focusOffset: 1 as the selection. Since this is not a valid cursor
                // position, move the cursor to the next walkable position after the frame node.
                position = getNextWalkablePosition(selection.focusNode);
                if (position) {
                    selection.anchorNode = selection.focusNode = position.container;
                    selection.anchorOffset = selection.focusOffset = position.offset;
                }
            }

            // Need to check the selection again in case the caret position didn't return any result
            if (selection.anchorNode && selection.focusNode) {
                selectionRange = selectionController.selectionToRange(selection);
                selectionController.selectRange(selectionRange.range,
                    selectionRange.hasForwardSelection, event.detail);
            }
            eventManager.focus(); // Mouse clicks often cause focus to shift. Recapture this straight away
        }

        /**
         * @param {!Event} event
         */
        function handleMouseClickEvent(event) {
            var target = getTarget(event),
                p = runtime.getWindow().navigator.platform;
            drawShadowCursorTask.processRequests(); // Resynchronise the shadow cursor before processing anything else
            if (odfUtils.isImage(target) && odfUtils.isCharacterFrame(target.parentNode)) {
                selectionController.selectImage(/**@type{!Node}*/(target.parentNode));
                eventManager.focus(); // Mouse clicks often cause focus to shift. Recapture this straight away
            } else if (imageSelector.isSelectorElement(target)) {
                eventManager.focus(); // Mouse clicks often cause focus to shift. Recapture this straight away
            } else if (clickStartedWithinCanvas) {
                if (isMouseMoved) {
                    selectionController.selectRange(shadowCursor.getSelectedRange(),
                        shadowCursor.hasForwardSelection(), event.detail);
                    eventManager.focus(); // Mouse clicks often cause focus to shift. Recapture this straight away
                } else {
                    // Clicking in already selected text won't update window.getSelection() until just after
                    // the click is processed. Set 0 timeout here so the newly clicked position can be updated
                    // by the browser. Unfortunately this is only working in Firefox. For other browsers, we have to work
                    // out the caret position from two coordinates.
                    // On iOS Safari however, you cannot trigger focus on the event manager within a timeout.
                    if (p === 'iPad' || p === 'iPhone' || p === 'iPod') {
                        moveByMouseClickEvent(event);
                    } else {
                        handleMouseClickTimeoutId = runtime.setTimeout(function () {
                            moveByMouseClickEvent(event);
                        }, 0);
                    }
                }
            }
            clickCount = 0;
            clickStartedWithinCanvas = false;
            isMouseMoved = false;
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
         * @param {!Event} e
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
         * @param {!Event} event
         */
        function handleMouseUp(event) {
            var target = /**@type{!Element}*/(getTarget(event)),
                annotationNode = null;

            if (target.className === "annotationRemoveButton") {
                annotationNode = domUtils.getElementsByTagNameNS(/**@type{!Element}*/(target.parentNode), odf.Namespaces.officens, 'annotation')[0];
                annotationController.removeAnnotation(annotationNode);
                eventManager.focus();
            } else {
                handleMouseClickEvent(event);
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
                textController.insertText(input);
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
             * return {function(*):(boolean|undefined)
             */
            return function (e) {
                var selectionType = odtDocument.getCursor(inputMemberId).getSelectionType();
                if (selectionType === ops.OdtCursor.RangeSelection) {
                    return fn(e);
                }
                return true;
            };
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
            // eventManager will bind focus event on both eventTrap and window which changes the cursor style to text
            // straight after cmd+click on MacOs. So bind to window object directly here.
            window.addEventListener("focus", hyperlinkClickHandler.showTextCursor, false);

            if (undoManager) {
                // For most undo managers, the initial state is a clean document *with* a cursor present
                undoManager.initialize();
            }

            inputMethodEditor.setEditing(true);
            hyperlinkClickHandler.setModifier(isMacOS ? gui.HyperlinkClickHandler.Modifier.Meta : gui.HyperlinkClickHandler.Modifier.Ctrl);
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
                keyDownHandler.bind(keyCode.C, modifier.MetaShift, annotationController.addAnnotation);
                keyDownHandler.bind(keyCode.Z, modifier.Meta, undo);
                keyDownHandler.bind(keyCode.Z, modifier.MetaShift, redo);
                keyDownHandler.bind(keyCode.LeftMeta, modifier.Meta, hyperlinkClickHandler.showPointerCursor);
                keyDownHandler.bind(keyCode.MetaInMozilla, modifier.Meta, hyperlinkClickHandler.showPointerCursor);

                // event.ctrlKey and event.metaKey are always equal false in keyup event. Cannot really refer a source,
                // but seem this is how all browsers behave. Probably because there is no such need in this event.
                keyUpHandler.bind(keyCode.LeftMeta, modifier.None, hyperlinkClickHandler.showTextCursor);
                keyUpHandler.bind(keyCode.MetaInMozilla, modifier.None, hyperlinkClickHandler.showTextCursor);
            } else {
                keyDownHandler.bind(keyCode.B, modifier.Ctrl, rangeSelectionOnly(directFormattingController.toggleBold));
                keyDownHandler.bind(keyCode.I, modifier.Ctrl, rangeSelectionOnly(directFormattingController.toggleItalic));
                keyDownHandler.bind(keyCode.U, modifier.Ctrl, rangeSelectionOnly(directFormattingController.toggleUnderline));
                keyDownHandler.bind(keyCode.L, modifier.CtrlShift, rangeSelectionOnly(directFormattingController.alignParagraphLeft));
                keyDownHandler.bind(keyCode.E, modifier.CtrlShift, rangeSelectionOnly(directFormattingController.alignParagraphCenter));
                keyDownHandler.bind(keyCode.R, modifier.CtrlShift, rangeSelectionOnly(directFormattingController.alignParagraphRight));
                keyDownHandler.bind(keyCode.J, modifier.CtrlShift, rangeSelectionOnly(directFormattingController.alignParagraphJustified));
                keyDownHandler.bind(keyCode.C, modifier.CtrlAlt, annotationController.addAnnotation);
                keyDownHandler.bind(keyCode.Z, modifier.Ctrl, undo);
                keyDownHandler.bind(keyCode.Z, modifier.CtrlShift, redo);
                keyDownHandler.bind(keyCode.Ctrl, modifier.Ctrl, hyperlinkClickHandler.showPointerCursor);

                // event.ctrlKey and event.metaKey are always equal false in keyup event. Cannot really refer a source,
                // but seem this is how all browsers behave. Probably because there is no such need in this event.
                keyUpHandler.bind(keyCode.Ctrl, modifier.None, hyperlinkClickHandler.showTextCursor);
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
            window.removeEventListener("focus", hyperlinkClickHandler.showTextCursor, false);

            inputMethodEditor.setEditing(false);
            hyperlinkClickHandler.setModifier(gui.HyperlinkClickHandler.Modifier.None);
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
                keyDownHandler.unbind(keyCode.C, modifier.MetaShift);
                keyDownHandler.unbind(keyCode.Z, modifier.Meta);
                keyDownHandler.unbind(keyCode.Z, modifier.MetaShift);
                keyDownHandler.unbind(keyCode.LeftMeta, modifier.Meta);
                keyDownHandler.unbind(keyCode.MetaInMozilla, modifier.Meta);

                keyUpHandler.unbind(keyCode.LeftMeta, modifier.None);
                keyUpHandler.unbind(keyCode.MetaInMozilla, modifier.None);
            } else {
                keyDownHandler.unbind(keyCode.B, modifier.Ctrl);
                keyDownHandler.unbind(keyCode.I, modifier.Ctrl);
                keyDownHandler.unbind(keyCode.U, modifier.Ctrl);
                keyDownHandler.unbind(keyCode.L, modifier.CtrlShift);
                keyDownHandler.unbind(keyCode.E, modifier.CtrlShift);
                keyDownHandler.unbind(keyCode.R, modifier.CtrlShift);
                keyDownHandler.unbind(keyCode.J, modifier.CtrlShift);
                keyDownHandler.unbind(keyCode.C, modifier.CtrlAlt);
                keyDownHandler.unbind(keyCode.Z, modifier.Ctrl);
                keyDownHandler.unbind(keyCode.Z, modifier.CtrlShift);
                keyDownHandler.unbind(keyCode.Ctrl, modifier.Ctrl);

                keyUpHandler.unbind(keyCode.Ctrl, modifier.None);
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

            odtDocument.unsubscribe(ops.OdtDocument.signalOperationEnd, redrawRegionSelectionTask.trigger);
            odtDocument.unsubscribe(ops.OdtDocument.signalCursorAdded, inputMethodEditor.registerCursor);
            odtDocument.unsubscribe(ops.OdtDocument.signalCursorRemoved, inputMethodEditor.removeCursor);
            odtDocument.unsubscribe(ops.OdtDocument.signalOperationEnd, updateUndoStack);

            callback();
        }

        /**
         * @param {!function(!Object=)} callback passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function (callback) {
            var destroyCallbacks = [
                drawShadowCursorTask.destroy,
                redrawRegionSelectionTask.destroy,
                directFormattingController.destroy,
                inputMethodEditor.destroy,
                eventManager.destroy,
                destroy];
            runtime.clearTimeout(handleMouseClickTimeoutId);
            async.destroyAll(destroyCallbacks, callback);
        };

        function init() {
            drawShadowCursorTask = new core.ScheduledTask(updateShadowCursor, 0);
            redrawRegionSelectionTask = new core.ScheduledTask(redrawRegionSelection, 0);

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

            odtDocument.subscribe(ops.OdtDocument.signalOperationEnd, redrawRegionSelectionTask.trigger);
            odtDocument.subscribe(ops.OdtDocument.signalCursorAdded, inputMethodEditor.registerCursor);
            odtDocument.subscribe(ops.OdtDocument.signalCursorRemoved, inputMethodEditor.removeCursor);
            odtDocument.subscribe(ops.OdtDocument.signalOperationEnd, updateUndoStack);
        }

        init();
    };

    return gui.SessionController;
}());
// vim:expandtab
