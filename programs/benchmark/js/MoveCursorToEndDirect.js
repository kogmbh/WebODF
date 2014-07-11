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

/*global define*/

define(["BenchmarkAction"], function(BenchmarkAction) {
    "use strict";

    /**
     * Move the cursor to the end of the document using the same interface as the mouse would
     * @constructor
     */
    function MoveCursorToEndDirect() {
        var state = {description: "Move to document end (direct)"},
            action = new BenchmarkAction(state);

        this.subscribe = action.subscribe;
        this.state = state;

        /**
         * @param {!OdfBenchmarkContext} context
         */
        this.start = function(context) {
            var canvasElement,
                range;

            context.storeCurrentPosition(state);
            action.start();

            canvasElement = context.odfCanvas.getElement();
            range = canvasElement.ownerDocument.createRange();
            range.setStart(canvasElement, canvasElement.childNodes.length);
            context.sessionController.getSelectionController().selectRange(range, true, 1);

            action.stop();
            context.recordDistanceFromPreviousPosition(state);
            action.complete(true);
        };
    }

    return MoveCursorToEndDirect;
});
