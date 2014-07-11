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

/*global define, document*/

define(["HTMLActionResult"], function(HTMLActionResult) {
        "use strict";

        /**
         * @constructor
         * @param {!Benchmark} benchmark
         * @param {!HTMLTableElement} outputTable
         */
        function HTMLResultsRenderer(benchmark, outputTable) {
            var results = [],
                pxPerCm;

            function onStart() {
                benchmark.actions.forEach(function(action, index) {
                    results.push(new HTMLActionResult(action, index, outputTable, pxPerCm));
                });
            }

            /*jslint emptyblock: true*/
            function onComplete() {
            }
            /*jslint emptyblock: false*/

            /**
             * Set the background colour of the benchmark
             * @param {!string} bgColour
             * @return {undefined}
             */
            this.setBackgroundColour = function(bgColour) {
                if (bgColour) {
                    outputTable.style.backgroundColor = bgColour;
                }
            };

            function init() {
                var parent,
                    testChild;

                // Determine how many px per cm on the current screen
                parent = outputTable.parentNode;
                testChild = document.createElement("div");
                testChild.style.width = "1cm";
                testChild.style.height = "1cm";
                parent.appendChild(testChild);
                pxPerCm = testChild.getBoundingClientRect().width;
                parent.removeChild(testChild);

                benchmark.subscribe("start", onStart);
                benchmark.subscribe("complete", onComplete);
            }
            init();
        }

        return HTMLResultsRenderer;
    }
);
