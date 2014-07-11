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

/*global define, runtime, core*/

define(function () {
    "use strict";

    runtime.loadClass("core.EventNotifier");

    /**
     * @constructor
     */
    function BenchmarkAction(state) {
        var startedAt,
            events = new core.EventNotifier(["start", "complete"]);

        this.subscribe = events.subscribe;

        this.start = function () {
            state.status = undefined;
            state.elapsedTime = undefined;
            events.emit("start", state);
            startedAt = new Date().getTime();
        };

        this.stop = function () {
            state.elapsedTime = new Date().getTime() - startedAt;
        };

        /**
         * @param {!boolean} result
         */
        this.complete = function (result) {
            state.status = result;
            events.emit("complete", state);
        };
    }
    return BenchmarkAction;
});
