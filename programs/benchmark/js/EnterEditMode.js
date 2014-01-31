/**
 * @license
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

define(["BenchmarkAction"], function(BenchmarkAction) {
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
                directParagraphStylingEnabled: true
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
         * @param {!SharedState} sharedState
         */
        this.start = function(sharedState) {
            var session,
                sessionController,
                shadowCursor,
                selectionViewManager,
                caretManager,
                addMember = new ops.OpAddMember();

            action.start();

            session = new ops.Session(sharedState.odfCanvas);
            shadowCursor = new gui.ShadowCursor(session.getOdtDocument());
            sessionController = new gui.SessionController(session, localMemberId, shadowCursor, sessionControllerOptions);
            sessionController.setUndoManager(undoManager);
            caretManager = new gui.CaretManager(sessionController);
            selectionViewManager = new gui.SelectionViewManager(gui.SvgSelectionView);
            new gui.SessionView(viewOptions, localMemberId, session, caretManager, selectionViewManager);
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

            sessionController.startEditing();
            sharedState.sessionController = sessionController;

            action.complete(true);
        };
    }

    return EnterEditMode;
});
