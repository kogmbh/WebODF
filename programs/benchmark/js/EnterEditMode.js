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

/*global define, runtime, gui, ops*/

define(["BenchmarkAction"], function (BenchmarkAction) {
    "use strict";

    runtime.loadClass("ops.Session");
    runtime.loadClass("gui.SessionController");
    runtime.loadClass("gui.CaretManager");
    runtime.loadClass("gui.SvgSelectionView");
    runtime.loadClass("gui.SessionView");
    runtime.loadClass("gui.SelectionViewManager");
    runtime.loadClass("gui.ShadowCursor");
    runtime.loadClass("gui.TrivialUndoManager");
    runtime.loadClass("ops.OpAddMember");

    /**
     * Setup and register all components required to start editing the document
     * @constructor
     */
    function EnterEditMode() {
        var state = {description: "Enter edit mode"},
            action = new BenchmarkAction(state),
            localMemberId = "localmember",
            sessionControllerOptions = {
                directParagraphStylingEnabled: true,
                directTextStylingEnabled: true
            },
            viewOptions = {
                editInfoMarkersInitiallyVisible: false,
                caretAvatarsInitiallyVisible: false,
                caretBlinksOnRangeSelect: true
            },
            undoManager = new gui.TrivialUndoManager();

        this.subscribe = action.subscribe;
        this.state = state;

        /**
         * @param {!OdfBenchmarkContext} context
         */
        this.start = function (context) {
            var session,
                sessionConstraints,
                sessionController,
                shadowCursor,
                selectionViewManager,
                caretManager,
                addMember = new ops.OpAddMember(),
                sessionView;

            action.start();

            session = new ops.Session(context.odfCanvas);
            shadowCursor = new gui.ShadowCursor(session.getOdtDocument());
            sessionController = new gui.SessionController(session, localMemberId, shadowCursor, sessionControllerOptions);
            sessionConstraints = sessionController.getSessionConstraints();
            sessionController.setUndoManager(undoManager);
            caretManager = new gui.CaretManager(sessionController);
            selectionViewManager = new gui.SelectionViewManager(gui.SvgSelectionView);
            sessionView = new gui.SessionView(viewOptions, localMemberId, session, sessionConstraints, caretManager, selectionViewManager);
            if (!sessionView) { // use sessionView so jslint does not complain
                runtime.log("No SessionView was created.");
            }
            selectionViewManager.registerCursor(shadowCursor, true);

            addMember.init({
                memberid: localMemberId,
                setProperties: {
                    fullName: runtime.tr("Unknown Author"),
                    color: "black",
                    imageUrl: "avatar-joe.png"
                }
            });
            session.enqueue([addMember]);

            sessionController.insertLocalCursor();
            sessionController.startEditing();

            context.session = session;
            context.sessionController = sessionController;

            action.stop();
            action.complete(true);
        };
    }

    return EnterEditMode;
});
