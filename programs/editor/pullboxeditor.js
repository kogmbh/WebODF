/**
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
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

/*global require, document, runtime, Wodo, alert*/

function createEditor(args) {
    "use strict";

    var editor = null,
        serverFactory = null,
        server = null,
        editorOptions = {
            allFeaturesEnabled: true,
            collabEditingEnabled: true
        },
        currentPageId = null,
        savingOverlay, disconnectedOverlay, hasLocalUnsyncedOpsOverlay,
        sessionList,
        userId, token,
        currentSessionId, currentMemberId,
        backend = args.backend;

    // TODO: just some quick hack done for testing, make nice (e.g. the position calculation is fragile)
    function addStatusOverlay(parentElement, symbolFileName, position) {
        var htmlns = document.documentElement.namespaceURI,
            imageElement, overlay;

        runtime.assert(parentElement, "heya, no such parentelement");

        overlay = document.createElementNS(htmlns, "div");
        imageElement = document.createElementNS(htmlns, "img");
        imageElement.src = symbolFileName;
        overlay.appendChild(imageElement);
        overlay.style.position = "absolute";
        overlay.style.top =  24 * position + "px";
        overlay.style.opacity = "0.8";
        overlay.style.display = "none";
        parentElement.appendChild(overlay);
        return overlay;
    }

    /**
     * Switches the pages by hiding the old one and unhiding the new
     * @param {!string} pageId
     * @return {undefined}
     */
    function switchToPage(pageId) {
        if (currentPageId) {
            document.getElementById(currentPageId).style.display = "none";
        }
        currentPageId = pageId;
        document.getElementById(pageId).style.display = "";
    }

    /**
     * @param {!string}
     * @return {undefined}
     */
    function updateLocationWithSessionId(sessionId) {
        var location = String(document.location),
            pos = location.indexOf('#');
        if (pos !== -1) {
            location = location.substr(0, pos);
        }
        if (sessionId) {
            location = location + '#' + sessionId;
        }
        //history.replaceState( {}, "", location);
    }

    /*jslint emptyblock: true*/
    /**
     * @return {undefined}
     */
    function onEditingStarted() {
        // nothing to do right now
    }
    /*jslint emptyblock: false*/

    /**
     * @return {undefined}
     */
    function showSessions() {
        switchToPage("sessionListContainer");

        sessionList.setUpdatesEnabled(true);

        updateLocationWithSessionId("");
    }

    /**
     * @param {!boolean=} ignoreError
     * @return {undefined}
     */
    function closeEditing(ignoreError) {
        editor.leaveSession(function () {
            server.leaveSession(currentSessionId, currentMemberId, function () {
                showSessions();
            }, function () {
                if (ignoreError) {
                    showSessions();
                }
                // TODO: else report problem
            });
        });
    }

    /**
     * @return {undefined}
     */
    function handleEditingError(error) {
        alert("Something went wrong:\n" + error);
        closeEditing(true);
    }

    /**
     * @param {!string} sessionId
     * @return {undefined}
     */
    function joinSession(sessionId) {
        switchToPage("editorContainer");

        sessionList.setUpdatesEnabled(false);

        updateLocationWithSessionId(sessionId);

        currentSessionId = sessionId;
        server.joinSession(userId, sessionId, function (memberId) {
            currentMemberId = memberId;

            if (!editor) {
                editorOptions.networkSecurityToken = token;
                editorOptions.closeCallback = closeEditing;
                Wodo.createCollabTextEditor('editorContainer', editorOptions, function (err, e) {
                    var canvasContainerElement;
                    if (err) {
                        runtime.log(err);
                    }

                    editor = e;

                    canvasContainerElement = editor.getCanvasContainerElement();
                    savingOverlay = addStatusOverlay(canvasContainerElement, "document-save.png", 0);
                    hasLocalUnsyncedOpsOverlay = addStatusOverlay(canvasContainerElement, "vcs-locally-modified.png", 0);
                    disconnectedOverlay = addStatusOverlay(canvasContainerElement, "network-disconnect.png", 1);

                    editor.addEventListener(Wodo.EVENT_BEFORESAVETOFILE, function () {
                        savingOverlay.style.display = "";
                    });
                    editor.addEventListener(Wodo.EVENT_SAVEDTOFILE, function () {
                        savingOverlay.style.display = "none";
                    });
                    editor.addEventListener(Wodo.EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED, function (has) {
                        hasLocalUnsyncedOpsOverlay.style.display = has ? "" : "none";
                    });
                    editor.addEventListener(Wodo.EVENT_HASSESSIONHOSTCONNECTIONCHANGED, function (has) {
                        disconnectedOverlay.style.display = has ? "none" : "";
                    });
                    editor.addEventListener(Wodo.EVENT_UNKNOWNERROR, handleEditingError);

                    // load the document and get called back when it's live
                    editor.joinSession(serverFactory.createSessionBackend(sessionId, memberId, server), onEditingStarted);
                });
            } else {
                editor.joinSession(serverFactory.createSessionBackend(sessionId, memberId, server), onEditingStarted);
            }
        }, function (err) {
            // TODO: handle error
            runtime.log(err);
        });
    }

    /**
     * extract session id from the url-fragment
     *
     * @return {?string}
     */
    function extractSessionId() {
        var sessionId = String(document.location),
            pos = sessionId.indexOf('#');
        return (pos !== -1) ? sessionId.substr(pos + 1) : null;
    }

    /**
     * start the login process by offering a login/password prompt.
     * on success a list of sessions is offered.
     * when the user selects a session the callback is called
     * with the sessionId as parameter
     *
     * @return {undefined}
     */
    function startLoginProcess() {
        runtime.assert(editor === null, "cannot boot with instantiated editor");

        function loginSuccess(userData) {
            require(["webodf/editor/SessionListView"],
                function (SessionListView) {
                    var sessionListDiv = document.getElementById("sessionList"),
                        sessionId = extractSessionId(),
                        sessionListView;

                    runtime.log("connected:" + userData.full_name);
                    userId = userData.uid;
                    token = userData.securityToken || null;

                    // add session listing
                    sessionList = new serverFactory.createSessionList(server);
                    sessionListView = new SessionListView(sessionList, sessionListDiv, joinSession);

                    if (sessionId) {
                        // TODO: check if session exists
                        joinSession(sessionId);
                    } else {
                        switchToPage("sessionListContainer");
                    }
                    // return sessionListView so it is not unused
                    return sessionListView;
                });
        }

        function loginFail(result) {
            alert("Login failed: " + result);
        }

        /**
         * @return {!boolean}
         */
        function onLoginSubmit() {
            server.login(document.loginForm.login.value, document.loginForm.password.value, loginSuccess, loginFail);

            // block the submit button, we already dealt with the input
            return false;
        }

        // bring up the login form
        document.loginForm.Submit.onclick = onLoginSubmit;
        switchToPage("loginContainer");
        document.loginForm.login.focus();
    }

    // start the editor with network
    runtime.log("starting collaborative editor for ["+backend+"].");
    require(["webodf/editor/server/"+backend+"/ServerFactory"], function (ServerFactory) {
        serverFactory = new ServerFactory();
        server = serverFactory.createServer();
        // wait for a network connection to establish.
        // call the callback when done, when finally failed, or
        // when a timeout reached.
        // the parameter to the callback is a string with the possible
        // values: "unavailable", "timeout", "ready"
        server.connect(8000, function (state) {
            if (state === "ready") {
                startLoginProcess();
            }
        });
    });
}
