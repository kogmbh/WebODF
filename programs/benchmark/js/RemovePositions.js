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
     * Remove the last character in the document via backspace or delete
     * @constructor
     * @param {!number} times Number of times to delete a character
     * @param {!boolean} useBackspace Remove character via backspace or delete
     */
    function RemovePositions(times, useBackspace) {
        var state = {description: "Remove characters (x" + times + ", " + (useBackspace ? "backspace" : "delete") + ")"},
            action = new BenchmarkAction(state);

        this.subscribe = action.subscribe;
        this.state = state;

        /**
         * @param {!OdfBenchmarkContext} context
         */
        this.start = function(context) {
            var count;
            context.recordDistanceFromLength(state, useBackspace ? -times : times);
            action.start();
            for (count = 0; count < times; count += 1) {
                if (useBackspace) {
                    context.sessionController.getTextController().removeTextByBackspaceKey();
                } else {
                    context.sessionController.getTextController().removeTextByDeleteKey();
                }
            }
            action.stop();
            action.complete(true);
        };
    }

    return RemovePositions;
});
