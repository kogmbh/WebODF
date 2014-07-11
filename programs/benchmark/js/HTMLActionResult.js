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

/*global define, document*/

define(function () {
        "use strict";

        /**
         * @constructor
         * @param {!Object} action
         * @param {!number} index
         * @param {!HTMLTableElement} outputTable
         * @param {!number} pxPerCm
         */
        function HTMLActionResult(action, index, outputTable, pxPerCm) {
            var descriptionCell = document.createElement('td'),
                statusCell = document.createElement('td'),
                elapsedMsCell = document.createElement('td'),
                speedCell  = document.createElement('td'),
                pagesPerHr  = document.createElement('td');

            function formatNumber(number) {
                if (number > 1000000) {
                    return (number / 1000000).toFixed(2) + " mill";
                }
                return number.toFixed(2);
            }

            function pxPerMsToKmPerHr(pxPerMs) {
                // Google knows!
                // https://www.google.com.au/search?q=centimeters%20per%20millisecond%20to%20kilometers%20per%20hour
                var cmPerSecond = (pxPerMs / pxPerCm),
                    kmsPerHr = (cmPerSecond * 36);
                return formatNumber(kmsPerHr);
            }

            function toPagesPerMin(stepsPerMs) {
                // http://anycount.com/WordCountBlog/how-many-words-in-one-page/
                var pagesPH = (stepsPerMs / 3838) * 1000 * 60 * 60;
                return formatNumber(pagesPH);
            }

            function start() {
                statusCell.textContent = "running";
                elapsedMsCell.textContent = "";
                speedCell.textContent = "";
            }

            function complete(state) {
                statusCell.textContent = state.status ? "done" : "failed";
                elapsedMsCell.textContent = state.elapsedTime;
                if (state.horizontalTravelPx !== undefined) {
                    speedCell.classList.add("active");
                    speedCell.textContent = pxPerMsToKmPerHr(state.horizontalTravelPx / state.elapsedTime);
                }
                if (state.travelledSteps !== undefined) {
                    pagesPerHr.classList.add("active");
                    pagesPerHr.textContent = toPagesPerMin(state.travelledSteps / state.elapsedTime);
                }
            }

            function init() {
                var tr = document.createElement('tr');

                descriptionCell.className = "action";
                statusCell.className = "status";
                elapsedMsCell.className = "elapsed";
                speedCell.className = "speed";
                pagesPerHr.className = "pages";

                [descriptionCell, statusCell, elapsedMsCell, speedCell, pagesPerHr].forEach(function(cell) {
                    tr.appendChild(cell);
                });

                outputTable.appendChild(tr);
                descriptionCell.textContent = (index + 1) + ". " + action.state.description;

                action.subscribe("start", start);
                action.subscribe("complete", complete);
            }
            init();
        }

        return HTMLActionResult;
    }
);
