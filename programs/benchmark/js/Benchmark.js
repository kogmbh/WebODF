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

/*global define, runtime, core, console, odf */

define(["OdfBenchmarkContext"], function (OdfBenchmarkContext) {
        "use strict";

        runtime.loadClass("core.EventNotifier");
        runtime.loadClass("core.Task");
        runtime.loadClass("odf.OdfCanvas");

        /**
         * @constructor
         * @param {!HTMLElement} canvasElement
         */
        function Benchmark(canvasElement) {
            var self = this,
                context = new OdfBenchmarkContext(),
                events = new core.EventNotifier(["start", "complete"]),
                currentActionIndex,
                lastProfileAction;

            function executeNextAction() {
                var currentAction;
                currentActionIndex += 1;
                if (lastProfileAction) {
                    console.profileEnd(lastProfileAction);
                }
                currentAction = self.actions[currentActionIndex];
                if (currentAction) {
                    lastProfileAction = currentAction.state.description;
                    console.profile(lastProfileAction);
                    currentAction.start(context);
                } else {
                    events.emit("complete", {});
                }
            }

            this.subscribe = events.subscribe;
            this.actions = [];

            this.start = function() {
                self.actions.forEach(function(action) {
                    action.subscribe("complete", function() {
                        runtime.setTimeout(executeNextAction, 1);
                    });
                });

                events.emit("start", {});
                core.Task.SUPPRESS_MANUAL_PROCESSING = true;
                context.odfCanvas = new odf.OdfCanvas(canvasElement);
                currentActionIndex = -1;
                executeNextAction();
            };
        }

        return Benchmark;
    }
);
