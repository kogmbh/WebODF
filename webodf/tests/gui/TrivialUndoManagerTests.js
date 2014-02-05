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
/*global runtime, core, gui, ops*/
runtime.loadClass("ops.OpMoveCursor");
runtime.loadClass("ops.OpInsertText");
runtime.loadClass("ops.OpSplitParagraph");
runtime.loadClass("ops.OpRemoveText");
runtime.loadClass("gui.TrivialUndoManager");
/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
gui.TrivialUndoManagerTests = function TrivialUndoManagerTests(runner) {
    "use strict";
    var t, testarea,
        r = runner;

    function cursor(id) {
        return { getMemberId: function () { return id; } };
    }

    /**
     * @param rootElement
     * @constructor
     * @implements {ops.Document}
     */
    function AdaptiveMock(rootElement) {
        var self = this;
        /*jslint emptyblock: true*/
        function noOp() { }
        function noOp2() { return true; }
        /*jslint emptyblock: false*/
        function returnThis() { return self; }
        this.rootElement = rootElement;

        this.getCanvas = returnThis;
        this.odfContainer = returnThis;
        this.getAnnotationViewManager = returnThis;
        this.forgetAnnotations = noOp;
        this.refreshAnnotations = noOp;
        this.refreshCSS = noOp;
        this.setRootElement = noOp;
        this.setOdfContainer = noOp;
        this.cursors = [cursor("1")];
        this.getMemberIds = function () {
            return self.cursors.map(function (cursor) {
                return cursor.getMemberId();
            });
        };
        this.getDocumentElement = function () { return rootElement; };
        this.getRootNode = function () { return rootElement; };
        this.getDOMDocument = function () { return rootElement.ownerDocument; };
        this.cloneDocumentElement = function () { return rootElement; };
        this.setDocumentElement = noOp;
        this.removeCursor = noOp2;
        this.subscribe = noOp;
        this.unsubscribe = noOp;
    }

    this.setUp = function () {
        testarea = core.UnitTest.provideTestAreaDiv();
        t = {
            manager : new gui.TrivialUndoManager(),
            mock : new AdaptiveMock(testarea),
            ops : []
        };
        t.manager.setDocument(t.mock);
        t.manager.setPlaybackFunction(function (ops) {
            ops.forEach(function (op) {
                t.ops.push(op.spec().timestamp);
            });
        });
    };
    this.tearDown = function () {
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };

    function create(operation, args) {
        args.memberid = args.memberid || 1;
        operation.init(args);
        return operation;
    }

    function hasUndoStates_OnlyMovesBackValidStates() {
        t.manager.initialize();

        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1}));
        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.moveBackward(1)", "0");

        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 3}));
        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.moveBackward(1)", "0");

        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 4}));
        r.shouldBe(t, "t.manager.hasUndoStates()", "true");
        r.shouldBe(t, "t.manager.moveBackward(1)", "1");

        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.moveBackward(1)", "0");
    }

    function hasRedoStates_OnlyMovesForwardValidStates() {
        t.manager.initialize();

        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1}));
        r.shouldBe(t, "t.manager.hasRedoStates()", "false");
        r.shouldBe(t, "t.manager.moveForward(1)", "0");

        t.manager.moveBackward(1);
        r.shouldBe(t, "t.manager.hasRedoStates()", "false");
        r.shouldBe(t, "t.manager.moveForward(1)", "0");

        // Create something that can be undone
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 4}));
        t.manager.moveBackward(1);
        r.shouldBe(t, "t.manager.hasRedoStates()", "true");
        r.shouldBe(t, "t.manager.moveForward(1)", "1");

        r.shouldBe(t, "t.manager.hasRedoStates()", "false");
        r.shouldBe(t, "t.manager.moveForward(1)", "0");
    }

    function setInitialState_SavesMostRecentCursorState() {
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 2}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 3}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 4}));

        t.manager.setInitialState();

        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.hasRedoStates()", "false");

        // Now make something that can be undone
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));
        r.shouldBe(t, "t.manager.hasUndoStates()", "true");

        // And then undo it
        t.manager.moveBackward(1); // Should be back at origin

        r.shouldBe(t, "t.ops", "[3]");
    }

    function setInitialState_AllCursorsMaintainedWhenCalledMultipleTimes() {
        t.mock.cursors.push(cursor(2));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1, memberid: 1}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 2, memberid: 2}));
        t.manager.setInitialState();

        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 3}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 4, memberid: 2}));
        t.manager.setInitialState();
        t.manager.setInitialState();
        t.manager.setInitialState();

        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.hasRedoStates()", "false");

        // Now make something that can be undone
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));
        r.shouldBe(t, "t.manager.hasUndoStates()", "true");

        // And then undo it
        t.manager.moveBackward(1); // Should be back at origin

        // Internally move operations are stored as object keys. This results in independent
        // move operations being ordered unpredictably across implementations (e.g., this failed in qtruntime)
        // As the timestamps are unique, and the order is irrelevant due to these being independent cursors,
        // this can just be sorted to ensure a deterministic order.
        t.ops.sort();
        r.shouldBe(t, "t.ops", "[1,4]");
    }

    function initialize_WhenNotInitialized_SavesInitialState() {
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 2}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 3}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 4}));

        t.manager.initialize();

        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.hasRedoStates()", "false");

        // Now make something that can be undone
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));
        r.shouldBe(t, "t.manager.hasUndoStates()", "true");

        // And then undo it
        t.manager.moveBackward(1); // Should be back at origin

        r.shouldBe(t, "t.ops", "[3]");
    }

    function initialize_WhenAlreadyInitialized_DoesNothing() {
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 2}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 3}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 4}));

        t.manager.initialize();

        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.hasRedoStates()", "false");

        // Now make something that can be undone
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));

        // Now re-initialize and ensure nothing else happens
        t.manager.initialize();
        r.shouldBe(t, "t.manager.hasUndoStates()", "true");

        // And then undo it
        t.manager.moveBackward(1); // Should be back at origin

        r.shouldBe(t, "t.ops", "[3]");
    }

    function purgeInitialState_ClearsAllStacks() {
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 2}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 3}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 4}));

        t.manager.setInitialState();

        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 6}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 7}));
        t.manager.moveBackward(1);

        // Get to the worst possible state ever
        r.shouldBe(t, "t.manager.hasUndoStates()", "true");
        r.shouldBe(t, "t.manager.hasRedoStates()", "true");

        t.ops = [];
        // Now make something that can be undone
        // And now reset it
        t.manager.purgeInitialState();
        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.hasRedoStates()", "false");
        r.shouldBe(t, "t.manager.moveBackward(1)", "0");
        r.shouldBe(t, "t.manager.moveForward(1)", "0");

        t.manager.setInitialState();
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 8}));
        t.manager.moveBackward(1);
        r.shouldBe(t, "t.ops", "[]");
    }

    function moveBackward_MovesBack_InUndoQueue() {
        t.manager.initialize();

        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 10}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 20}));
        t.manager.moveBackward(1);

        r.shouldBe(t, "t.ops", "[5, 10]");
    }

    function moveBackward_NextOperationEdit_ClearsRedo() {
        t.manager.initialize();

        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));
        t.manager.moveBackward(1); // Now to 0 undo states available
        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.hasRedoStates()", "true");

        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 1}));
        r.shouldBe(t, "t.manager.hasRedoStates()", "false");
        r.shouldBe(t, "t.manager.moveForward(1)", "0");
    }

    function moveBackward_NextOperationNonEdit_LeavesRedoInTact() {
        t.manager.initialize();

        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));
        t.manager.moveBackward(1); // Now to 0 undo states available
        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.hasRedoStates()", "true");

        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1}));
        r.shouldBe(t, "t.manager.hasRedoStates()", "true");
        r.shouldBe(t, "t.manager.moveForward(1)", "1");
    }

    function moveBackward_BoundaryCheck_InitialDocumentState() {
        t.manager.initialize();

        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));
        t.manager.moveBackward(1); // Now to 0 undo states available
        r.shouldBe(t, "t.manager.hasUndoStates()", "false");

        t.ops = [];
        // Want to ensure the OpMoveCursor is still applied if rewound back to initial state
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1}));
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 6}));
        t.manager.moveBackward(1); // Now to 0 undo states available again
        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.ops", "[1]");
    }

    function moveBackward_ResetsMostRecentCursorState_ForVisibleCursors() {
        t.manager.onOperationExecuted(create(new ops.OpAddCursor(), {timestamp: 1, memberid: 1}));
        t.manager.onOperationExecuted(create(new ops.OpAddCursor(), {timestamp: 2, memberid: 2}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 3, memberid: 1}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 4, memberid: 1}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 5, memberid: 1}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 6, memberid: 2}));

        t.mock.cursors = [cursor(2)];
        t.manager.initialize();

        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.hasRedoStates()", "false");

        // Now make something that can be undone
        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 8}));
        r.shouldBe(t, "t.manager.hasUndoStates()", "true");

        // And then undo it
        t.manager.moveBackward(1); // Should be back at origin

        r.shouldBe(t, "t.ops", "[2, 6]");
    }

    function undoState_ConsumesTrailingNonEditOps() {
        t.manager.initialize();

        t.manager.onOperationExecuted(create(new ops.OpInsertText(), {timestamp: 5}));
        t.manager.onOperationExecuted(create(new ops.OpMoveCursor(), {timestamp: 1}));
        t.manager.moveBackward(1); // Now to 0 undo states available
        r.shouldBe(t, "t.manager.hasUndoStates()", "false");
        r.shouldBe(t, "t.manager.hasRedoStates()", "true");
        r.shouldBe(t, "t.ops", "[]");
    }

    this.tests = function () {
        return r.name([
            hasUndoStates_OnlyMovesBackValidStates,
            hasRedoStates_OnlyMovesForwardValidStates,
            setInitialState_SavesMostRecentCursorState,
            setInitialState_AllCursorsMaintainedWhenCalledMultipleTimes,
            initialize_WhenNotInitialized_SavesInitialState,
            initialize_WhenAlreadyInitialized_DoesNothing,
            purgeInitialState_ClearsAllStacks,
            moveBackward_MovesBack_InUndoQueue,
            moveBackward_NextOperationEdit_ClearsRedo,
            moveBackward_NextOperationNonEdit_LeavesRedoInTact,
            moveBackward_BoundaryCheck_InitialDocumentState,
            moveBackward_ResetsMostRecentCursorState_ForVisibleCursors,
            undoState_ConsumesTrailingNonEditOps
        ]);
    };
    this.asyncTests = function () {
        return [
        ];
    };
};
gui.TrivialUndoManagerTests.prototype.description = function () {
    "use strict";
    return "Test the TrivialUndoManager class.";
};
(function () {
    "use strict";
    return gui.TrivialUndoManagerTests;
}());
