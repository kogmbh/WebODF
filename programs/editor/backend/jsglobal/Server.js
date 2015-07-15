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

/*global define, window, runtime, core*/

define("webodf/editor/backend/jsglobal/Server", [], function () {
    "use strict";

    /**
     * @constructor
     * @implements ops.Server
     */
    return function JsGlobalServer() {
        var jsGlobalInstance;

        this.getGenesisUrl = function () {
            return "welcome.odt";
        };

        this.getJsGlobalServer = function() {
            return jsGlobalInstance;
        };

        /*jslint unparam: true*/
        /**
         * @param {!number} timeout in milliseconds
         * @param {!function(!string)} callback
         * @return {undefined}
         */
        this.connect = function (timeout, callback) {
            var interval = window.setInterval(function() {
                if (window.jsGlobalInstance) {
                    jsGlobalInstance = window.jsGlobalInstance;
                    window.clearInterval(interval);
                    callback("ready");
                }
                // TODO properly timeout
            }, 100);
        };
        /*jslint unparam: false*/

        /**
         * @return {!string}
         */
        this.networkStatus = function () {
            return "ready";
        };

        /**
         * @param {!string} login
         * @param {!string} password
         * @param {function(!Object)} successCb
         * @param {function(!string)} failCb
         * @return {undefined}
         */
        this.login = function (login, password, successCb, failCb) {
            jsGlobalInstance.login(login, password, successCb, failCb);
        };

        /**
         * @param {!string} userId
         * @param {!string} sessionId
         * @param {!function(!string)} successCb
         * @param {!function()} failCb
         * @return {undefined}
         */
        this.joinSession = function (userId, sessionId, successCb, failCb) {
            jsGlobalInstance.joinSession(userId, sessionId, successCb, failCb);
        };

        /**
         * @param {!string} sessionId
         * @param {!string} memberId
         * @param {!function()} successCb
         * @param {!function()} failCb
         * @return {undefined}
         */
        this.leaveSession = function (sessionId, memberId, successCb, failCb) {
            jsGlobalInstance.leaveSession(sessionId, memberId, successCb, failCb);
        };
    };
});
