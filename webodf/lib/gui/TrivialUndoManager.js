/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global gui,ops,core,runtime*/

/**
 * @param {gui.UndoStateRules=} defaultRules
 * @constructor
 * @implements gui.UndoManager
 */
gui.TrivialUndoManager = function TrivialUndoManager(defaultRules) {
    "use strict";

    var self = this,
        cursorns = 'urn:webodf:names:cursor',
        domUtils = core.DomUtils,
        /**@type{?Element}*/
        initialDoc,
        /**@type{!Array.<!ops.Operation>}*/
        initialState = [],
        playFunc,
        /**@type{!ops.Document}*/
        document,
        /**@type{!Array.<!ops.Operation>}*/
        currentUndoState = [],
        /**@type{!Array.<!Array.<!ops.Operation>>}*/
        undoStates = [],
        /**@type{!Array.<!Array.<!ops.Operation>>}*/
        redoStates = [],
        eventNotifier = new core.EventNotifier([
            gui.UndoManager.signalUndoStackChanged,
            gui.UndoManager.signalUndoStateCreated,
            gui.UndoManager.signalUndoStateModified,
            gui.TrivialUndoManager.signalDocumentRootReplaced
        ]),
        undoRules = defaultRules || new gui.UndoStateRules(),
        isExecutingOps = false;

    /**
     * Execute all operations in the supplied array
     * @param {!Array.<!ops.Operation>} operations
     * @return {undefined}
     */
    function executeOperations(operations) {
        if (operations.length > 0) {
            isExecutingOps = true; // Used to ignore operations received whilst performing an undo or redo
            playFunc(operations);
            isExecutingOps = false;
        }
    }

    function emitStackChange() {
        eventNotifier.emit(gui.UndoManager.signalUndoStackChanged, {
            undoAvailable: self.hasUndoStates(),
            redoAvailable: self.hasRedoStates()
        });
    }

    /**
     * @return {!Array.<!ops.Operation>}
     */
    function mostRecentUndoState() {
        return undoStates[undoStates.length - 1];
    }

    /**
     * Pushes the currentUndoState into the undoStates if necessary
     */
    function completeCurrentUndoState() {
        if (currentUndoState !== initialState // Initial state should never be in the undo stack
                && currentUndoState !== mostRecentUndoState()) {
            // undoStates may already contain the current undo state if the user
            // has moved backwards and then forwards in the undo stack
            undoStates.push(currentUndoState);
        }
    }

    /**
     * @param {!Node} node
     */
    function removeNode(node) {
        var sibling = node.previousSibling || node.nextSibling;
        node.parentNode.removeChild(node);
        domUtils.normalizeTextNodes(sibling);
    }

    /**
     * @param {!Element} root
     */
    function removeCursors(root) {
        domUtils.getElementsByTagNameNS(root, cursorns, "cursor").forEach(removeNode);
        domUtils.getElementsByTagNameNS(root, cursorns, "anchor").forEach(removeNode);
    }

    /**
     * Converts an object hash into an unordered array of its values
     * @param {!Object} obj
     * @return {!Array.<Object>}
     */
    function values(obj) {
        return Object.keys(obj).map(function (key) { return obj[key]; });
    }

    /**
     * Reduce the provided undo states to just unique AddCursor followed by
     * MoveCursor commands for each still-present cursor. This is used when
     * restoring the original document state at the start of an undo step
     * @param {!Array.<Array.<!ops.Operation>>} undoStates
     * @return {!Array.<!ops.Operation>}
     */
    function extractCursorStates(undoStates) {
        var addCursor = {},
            moveCursor = {},
            requiredAddOps = {},
            remainingAddOps,
            operations = undoStates.pop();

        document.getMemberIds().forEach(function (memberid) {
            requiredAddOps[memberid] = true;
        });
        remainingAddOps = Object.keys(requiredAddOps).length;

        // Every cursor that is visible on the document will need to be restored
        // Only need the *last* move or add operation for each visible cursor, as the length & position
        // are absolute
        /**
         * @param {!ops.Operation} op
         */
        function processOp(op) {
            var spec = op.spec();
            if (!requiredAddOps[spec.memberid]) {
                return;
            }
            switch (spec.optype) {
            case "AddCursor":
                if (!addCursor[spec.memberid]) {
                    addCursor[spec.memberid] = op;
                    delete requiredAddOps[spec.memberid];
                    remainingAddOps -= 1;
                }
                break;
            case "MoveCursor":
                if (!moveCursor[spec.memberid]) {
                    moveCursor[spec.memberid] = op;
                }
                break;
            }
        }

        while (operations && remainingAddOps > 0) {
            operations.reverse(); // Want the LAST move/add operation seen
            operations.forEach(processOp);
            operations = undoStates.pop();
        }

        return values(addCursor).concat(values(moveCursor));
    }

    /**
     * Subscribe to events related to the undo manager
     * @param {!string} signal
     * @param {!Function} callback
     */
    this.subscribe = function (signal, callback) {
        eventNotifier.subscribe(signal, callback);
    };

    /**
     * Unsubscribe to events related to the undo manager
     * @param {!string} signal
     * @param {!Function} callback
     */
    this.unsubscribe = function (signal, callback) {
        eventNotifier.unsubscribe(signal, callback);
    };

    /**
     * Returns true if there are one or more undo states available
     * @return {boolean}
     */
    this.hasUndoStates = function () {
        return undoStates.length > 0;
    };

    /**
     * Returns true if there are one or more redo states available
     * @return {boolean}
     */
    this.hasRedoStates = function () {
        return redoStates.length > 0;
    };

    /**
     * Set the OdtDocument to operate on
     * @param {!ops.Document} newDocument
     */
    this.setDocument = function (newDocument) {
        document = newDocument;
    };

    /**
     * @inheritDoc
     */
    this.purgeInitialState = function () {
        undoStates.length = 0;
        redoStates.length = 0;
        initialState.length = 0;
        currentUndoState.length = 0;
        initialDoc = null;
        emitStackChange();
    };

    function setInitialState() {
        initialDoc = document.cloneDocumentElement();
        // The current state may contain cursors if the initial state is modified whilst the document is in edit mode.
        // To prevent this issue, immediately purge all cursor nodes after cloning
        removeCursors(initialDoc);
        completeCurrentUndoState();
        // We just threw away the cursors in the snapshot, so need to recover all these operations so the
        // cursor can be re-inserted when an undo is performed
        // TODO the last move state may not reflect a valid position in the document!!!
        // E.g., add cursor, move to end, delete all content + saveInitialState
        currentUndoState = initialState = extractCursorStates([initialState].concat(undoStates));
        undoStates.length = 0;
        redoStates.length = 0;
        emitStackChange();
    }

    /**
     * @inheritDoc
     */
    this.setInitialState = setInitialState;

    /**
     * @inheritDoc
     */
    this.initialize = function () {
        if (!initialDoc) {
            setInitialState();
        }
    };

    /**
     * Sets the playback function to use to re-execute operations from the undo stack.
     * @param {!function(!Array.<!ops.Operation>)} playback_func
     */
    this.setPlaybackFunction = function (playback_func) {
        playFunc = playback_func;
    };

    /**
     * Track the execution of an operation, and add it to the available undo states
     * @param {!ops.Operation} op
     * @return {undefined}
     */
    this.onOperationExecuted = function (op) {
        if (isExecutingOps) {
            return; // Ignore new operations generated whilst performing an undo/redo
        }

        // An edit operation is assumed to indicate the end of the initial state. The user can manually
        // reset the initial state later with setInitialState if desired.
        // Additionally, an edit operation received when in the middle of the undo stack should also create a new state,
        // as the current undo state is effectively "sealed" and shouldn't gain additional document modifications.
        if ((undoRules.isEditOperation(op) && (currentUndoState === initialState || redoStates.length > 0))
                || !undoRules.isPartOfOperationSet(op, currentUndoState)) {
            redoStates.length = 0; // Creating a new undo state should always reset the redo stack
            completeCurrentUndoState();
            currentUndoState = [op];
            // Every undo state *MUST* contain an edit for it to be valid for undo or redo
            undoStates.push(currentUndoState);
            eventNotifier.emit(gui.UndoManager.signalUndoStateCreated, { operations: currentUndoState });
            emitStackChange();
        } else {
            currentUndoState.push(op);
            eventNotifier.emit(gui.UndoManager.signalUndoStateModified, { operations: currentUndoState });
        }
    };

    /**
     * Move forward the desired number of states. Will stop when the number of
     * states is reached, or no more redo states are available.
     * @param {!number} states
     * @return {!number} Returns the number of states actually moved
     */
    this.moveForward = function (states) {
        var moved = 0,
            redoOperations;

        while (states && redoStates.length) {
            redoOperations = redoStates.pop();
            undoStates.push(redoOperations);
            executeOperations(redoOperations);
            states -= 1;
            moved += 1;
        }

        if (moved) {
            // There is at least one undo stack now available due to the move forward
            // Reset the most recent undo state to receive new (non-edit) commands again
            currentUndoState = mostRecentUndoState();
            // Only report the stack has modified if moveForward actually did something
            emitStackChange();
        }
        return moved;
    };

    /**
     * Move backward the desired number of states. Will stop when the number of
     * states is reached, or no more undo states are available.
     * @param {!number} states
     * @return {!number} Returns the number of states actually moved
     */
    this.moveBackward = function (states) {
        var moved = 0;

        while (states && undoStates.length) {
            redoStates.push(undoStates.pop());
            states -= 1;
            moved += 1;
        }

        if (moved) {
            // Need to reset the odt document cursor list back to nil so new cursors are correctly re-registered
            document.getMemberIds().forEach(function (memberid) {
                document.removeCursor(memberid);
            });
            // Only do actual work if moveBackward does something to the undo stacks
            document.setDocumentElement(/**@type{!Element}*/(initialDoc.cloneNode(true)));
            eventNotifier.emit(gui.TrivialUndoManager.signalDocumentRootReplaced, { });
            executeOperations(initialState);
            undoStates.forEach(executeOperations);

            // On a move back command, new ops should be subsequently
            // evaluated for inclusion in the initial state again. This will
            // collect other cursor movement events and store them.
            // Without this step, an undo will always reset cursor position
            // back to the start of the document
            currentUndoState = mostRecentUndoState() || initialState;
            emitStackChange();
        }
        return moved;
    };
};

/**@const*/ gui.TrivialUndoManager.signalDocumentRootReplaced = "documentRootReplaced";
