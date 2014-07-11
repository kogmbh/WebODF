/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global define, runtime*/

define(["RangeCalculator"], function(RangeCalculator) {
    "use strict";
    /**
     * @constructor
     */
    function OdfBenchmarkContext() {
        var self = this,
            rangeCalculator = new RangeCalculator();

        /**
         * @return {boolean}
         */
        function initialized() {
            return Boolean(self.session && self.sessionController);
        }

        /**
         * @param {!number} length
         * @return {!number}
         */
        function measureSelectionLength(length) {
            var odtDocument = self.session.getOdtDocument(),
                position = odtDocument.getCursorPosition(self.sessionController.getInputMemberId());

            return rangeCalculator.measureTraversedDistance(odtDocument.convertCursorToDomRange(position, length));
        }

        /**
         * @return {!number}
         */
        function measureCurrentSelection() {
            var range = self.session.getOdtDocument().getCursor(self.sessionController.getInputMemberId()).getSelectedRange();
            return rangeCalculator.measureTraversedDistance(range);
        }

        /**
         * @type {?odf.OdfCanvas}
         */
        this.odfCanvas = null;

        /**
         * @type {?ops.Session}
         */
        this.session = null;

        /**
         * @type {?gui.SessionController}
         */
        this.sessionController = null;

        /**
         * Calculate the traveled distance from the supplied length in cursor steps
         * @param {!Object} state
         * @param {!number} length
         * @return {undefined}
         */
        this.recordDistanceFromLength = function(state, length) {
            if (initialized()) {
                state.travelledSteps = Math.abs(length);
                state.horizontalTravelPx = measureSelectionLength(length);
            }
        };

        /**
         * Store the current cursor position onto the provided state
         * @param {!Object} state
         * @return {undefined}
         */
        this.storeCurrentPosition = function(state) {
            var odtDocument;

            if (initialized()) {
                odtDocument = self.session.getOdtDocument();
                state.initialCursorPosition = odtDocument.getCursorPosition(self.sessionController.getInputMemberId());
            }
        };

        /**
         * Calculate the traveled distance from the previously recorded position
         * @param {!Object} state
         * @return {undefined}
         */
        this.recordDistanceFromPreviousPosition = function(state) {
            var odtDocument,
                finalCursorPosition;

            if (initialized()) {
                odtDocument = self.session.getOdtDocument();
                runtime.assert(state.initialCursorPosition !== undefined, "Initial cursor position should first be saved with context.storeCurrentPosition");
                finalCursorPosition = odtDocument.getCursorPosition(self.sessionController.getInputMemberId());
                state.travelledSteps = Math.abs(state.initialCursorPosition - finalCursorPosition);
                state.horizontalTravelPx = measureSelectionLength(state.initialCursorPosition - finalCursorPosition);
            }
        };

        /**
         * Calculate the traveled distance from the current selection
         * @param {!Object} state
         * @return {undefined}
         */
        this.recordDistanceFromCurrentSelection = function(state) {
            var odtDocument,
                selection;

            if (initialized()) {
                odtDocument = self.session.getOdtDocument();
                selection = odtDocument.getCursorSelection(self.sessionController.getInputMemberId());
                state.travelledSteps = Math.abs(selection.length);
                state.horizontalTravelPx = measureCurrentSelection();
            }
        };
    }

    return OdfBenchmarkContext;
});
