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

/*global define, runtime, core, XMLHttpRequest*/

define("webodf/editor/backend/pullbox/Server", [], function () {
    "use strict";

    runtime.loadClass("core.Base64");

    /**
     * @constructor
     * @implements ops.Server
     * @param {{url:string}} args
     */
    return function PullBoxServer(args) {

        var self = this,
            token,
            /**@const*/serverCallTimeout = 10000,
            base64 = new core.Base64();

        args = args || {};
        args.url = args.url || "/WSER";
        args.sessionStateToFileUrl = args.sessionStateToFileUrl || "/SS2F";

        this.getGenesisUrl = function (sessionId) {
            return "/session/" + sessionId + "/genesis";
        };

        /**
         * @param {!Object} message
         * @param {!function(!string)} cb
         * @param {!function(!number,!string)} cbError  passes the status number
         *     and the statustext, or -1 if there was an exception on sending
         * @return {undefined}
         */
        function call(message, cb, cbError) {
            var xhr = new XMLHttpRequest(),
                messageString = JSON.stringify(message);

            function handleResult() {
                if (xhr.readyState === 4) {
                    if (xhr.status < 200 || xhr.status >= 300) {
                        // report error
                        runtime.log("Status " + String(xhr.status) + ": " +
                                xhr.responseText || xhr.statusText);
                        cbError(xhr.status, xhr.statusText);
                    } else {
                        runtime.log("Status " + String(xhr.status) + ": " +
                                xhr.responseText || xhr.statusText);
                        cb(xhr.responseText);
                    }
                }
            }

            runtime.log("Sending message to server: " + messageString);
            // create body data for request from metadata and payload

            // do the request
            xhr.open('POST', args.url, true);
            if (token) {
                xhr.setRequestHeader("requesttoken", token);
            }
            xhr.setRequestHeader("content-type", "application/json");
            xhr.onreadystatechange = handleResult;
            xhr.timeout = serverCallTimeout;
            // TODO: seems handleResult is called on timeout as well, with xhr.status === 0
//             xhr.ontimeout = handleTimeout;
            try {
                xhr.send(messageString);
            } catch (e) {
                runtime.log("Problem with calling server: " + e);
                cbError(-1, e.message);
            }
        }

        this.call = call;

        this.getToken = function () {
            return token;
        };

        /**
         * for pre-authenticated use
         */
        this.setToken = function (a_token) {
            token = a_token;
        };


        /*jslint unparam: true*/
        /**
         * @param {!number} timeout in milliseconds
         * @param {!function(!string)} callback
         * @return {undefined}
         */
        this.connect = function (timeout, callback) {
            /*
            var accumulatedWaitingTime = 0;

            // already tried connecting?
            if (self.networkStatus() === "ready") {
                return;
            }
            */
            callback("ready");
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
            call({
                command: "login",
                args: {
                    login: base64.toBase64(login),
                    password: base64.toBase64(password)
                }
            }, function(responseData) {
                var response = /**@type {{token:string}}*/(runtime.fromJson(responseData));
                runtime.log("Login reply: " + responseData);

                if (response.hasOwnProperty("token")) {
                    token = response.token;
                    runtime.log("Caching token: " + self.getToken());
                    successCb(response);
                } else {
                    failCb(responseData);
                }
            }, failCb);
        };

        /**
         * @param {!string} userId
         * @param {!string} sessionId
         * @param {!function(!string)} successCb
         * @param {!function()} failCb
         * @return {undefined}
         */
        this.joinSession = function (userId, sessionId, successCb, failCb) {
            call({
                command: "join_session",
                args: {
                    user_id: userId,
                    es_id: sessionId
                }
            }, function(responseData) {
                var response = /**@type {{success:string, member_id:string}}*/(runtime.fromJson(responseData));
                runtime.log("join_session reply: " + responseData);

                if (response.hasOwnProperty("success") && response.success) {
                    successCb(response.member_id);
                } else {
                    failCb();
                }
            }, failCb);
        };

        /**
         * @param {!string} sessionId
         * @param {!string} memberId
         * @param {!function()} successCb
         * @param {!function()} failCb
         * @return {undefined}
         */
        this.leaveSession = function (sessionId, memberId, successCb, failCb) {
            call({
                command: "leave_session",
                args: {
                    es_id: sessionId,
                    member_id: memberId
                }
            }, function(responseData) {
                var response = /**@type {{success:string, member_id:string}}*/(runtime.fromJson(responseData));
                runtime.log("leave_session reply: " + responseData);

                if (response.hasOwnProperty("success") && response.success) {
                    successCb();
                } else {
                    failCb();
                }
            }, failCb);
        };

        /**
         * @param {!string} sessionId
         * @param {!string} memberId
         * @param {!string} seqHead
         * @param {!function(!Object=)} callback
         * @return {undefined}
         */
        this.writeSessionStateToFile = function(sessionId, memberId, seqHead, fileData, callback) {
            // code copied from BrowserRuntime.writeFile and adapted
            var xhr = new XMLHttpRequest();

            function handleResult() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 0 && !xhr.responseText) {// TODO: check makes sense here as well?
                        // for local files there is no difference between missing
                        // and empty files, so empty files are considered as errors
                        runtime.log("File " + args.sessionStateToFileUrl + " is empty.");
                    } else if ((xhr.status >= 200 && xhr.status < 300) ||
                            xhr.status === 0) {
                        // report success
                        runtime.log(null);
                    } else {
                        // report error
                        runtime.log("Status " + String(xhr.status) + ": " +
                                xhr.responseText || xhr.statusText);
                    }
                    callback();
                }
            }

            // do the request
            xhr.open('POST', args.sessionStateToFileUrl, true);
            if (token) {
                xhr.setRequestHeader("requesttoken", token);
            }
            xhr.setRequestHeader("webodf-session-id", sessionId);
            xhr.setRequestHeader("webodf-member-id", memberId);
            xhr.setRequestHeader("webodf-session-revision", seqHead);
            xhr.onreadystatechange = handleResult;
            // ArrayBufferView will have an ArrayBuffer property, in WebKit, XHR can send()
            // an ArrayBuffer, In Firefox, one must use sendAsBinary with a string
            if (fileData.buffer && !xhr.sendAsBinary) {
                fileData = fileData.buffer; // webkit supports sending an ArrayBuffer
            } else {
                // encode into a string, this works in FireFox >= 3
                fileData = runtime.byteArrayToString(fileData, "binary");
            }
            try {
                if (xhr.sendAsBinary) {
                    xhr.sendAsBinary(fileData);
                } else {
                    xhr.send(fileData);
                }
            } catch (e) {
                runtime.log("Problem with calling \"writeSessionStateToFile\" on server");
                callback(e.message);
            }
        };
    };
});
