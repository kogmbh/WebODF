/**
 * @license
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this code.  If not, see <http://www.gnu.org/licenses/>.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global runtime, define, document, odf, ops, window, gui, alert, saveAs, Blob */

define("webodf/editor/Editor", [
    "webodf/editor/EditorSession",
    "webodf/editor/MemberListView",
    "dijit/layout/BorderContainer",
    "dijit/layout/ContentPane",
    "webodf/editor/Tools"],

    function (EditorSession,
        MemberListView,
        BorderContainer,
        ContentPane,
        Tools) {
        "use strict";

        runtime.loadClass('odf.OdfCanvas');

        /**
         * @constructor
         * @param {{unstableFeaturesEnabled:boolean,
         *          loadCallback:function(),
         *          saveCallback:function(),
         *          closeCallback:function()}}
         * param {!ops.Server=} server
         * @param {!ServerFactory=} serverFactory
         */
        function Editor(args, server, serverFactory) {

            var self = this,
                // Private
                session,
                editorSession,
                mainContainer,
                memberListView,
                tools,
                loadOdtFile = args.loadCallback,
                saveOdtFile = args.saveCallback,
                close = args.closeCallback,
                odfCanvas,
                eventNotifier = new core.EventNotifier([
                    Editor.EVENT_ERROR,
                    Editor.EVENT_BEFORESAVETOFILE,
                    Editor.EVENT_SAVEDTOFILE,
                    Editor.EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED,
                    Editor.EVENT_HASSESSIONHOSTCONNECTIONCHANGED
                ]),
                pendingMemberId,
                pendingEditorReadyCallback;

            /**
             * @param {!string} eventid
             * @param {*} args
             * @return {undefined}
             */
            function fireEvent(eventid, args) {
                eventNotifier.emit(eventid, args);
            }

            function getFileBlob(cbSuccess, cbError) {
                var odfContainer = odfCanvas.odfContainer();

                if (odfContainer) {
                    odfContainer.createByteArray(cbSuccess, cbError);
                } else {
                    cbError("No odfContainer!");
                }
            }

            /**
             * prepare all gui elements and load the given document.
             * after loading is completed, the given callback is called.
             * the caller still has to call editorSession.startEditing
             * which will insert the the cursor.
             *
             * @param {!string} initialDocumentUrl
             * @param {!string} memberId
             * @param {!function()} editorReadyCallback
             * @return {undefined}
             */
            function initDocLoading(initialDocumentUrl, memberId, editorReadyCallback) {
                runtime.assert(initialDocumentUrl, "document should be defined here.");
                runtime.assert(memberId !== undefined, "memberId should be defined here.");
                runtime.assert(!pendingEditorReadyCallback, "pendingEditorReadyCallback should not exist here.");
                runtime.assert(!editorSession, "editorSession should not exist here.");
                runtime.assert(!session, "session should not exist here.");

                pendingMemberId = memberId;
                pendingEditorReadyCallback = editorReadyCallback;

                odfCanvas.load(initialDocumentUrl);
            }


            /**
             * open the document,
             * call editorReadyCallback once everything is done.
             *
             * @param {!string} docUrl
             * @param {!string} memberId
             * @param {!function()} editorReadyCallback
             * @return {undefined}
             */
            this.openDocument = function (docUrl, memberId, editorReadyCallback) {
                initDocLoading(docUrl, memberId, function () {
                    runtime.loadClass("ops.OpAddMember");
                    var op = new ops.OpAddMember();
                    op.init({
                        memberid: memberId,
                        setProperties: {
                            fullName: runtime.tr("Unknown Author"),
                            color: "black",
                            imageUrl: "avatar-joe.png"
                        }
                    });
                    session.enqueue([op]);
                    editorReadyCallback();
                });
            };

            /**
             * Closes a single-user document, and does cleanup.
             * @param {!function(!Object=)} callback, passing an error object in case of error
             * @return undefined;
             */
            this.closeDocument = function (callback) {
                runtime.assert(session, "session should exist here.");
                runtime.loadClass("ops.OpRemoveMember");

                var op = new ops.OpRemoveMember();
                op.init({
                    memberid: editorSession.sessionController.getInputMemberId()
                });
                session.enqueue([op]);

                session.close(function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        editorSession.destroy(function (err) {
                            if (err) {
                                callback(err);
                            } else {
                                editorSession = undefined;
                                session.destroy(function (err) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        session = undefined;
                                        callback();
                                    }
                                });
                            }
                        });
                    }
                });
            };

            /**
             * @param {!string} filename
             * @param {?function()} callback
             * @return {undefined}
             */
            this.saveDocument = function (filename, callback) {
                function onsuccess(data) {
                    var mimebase = "application/vnd.oasis.opendocument.",
                        mimetype = mimebase + "text",
                        blob;
                    filename = filename || "doc.odt";
                    if (filename.substr(-4) === ".odp") {
                        mimetype = mimebase + "presentation";
                    } else if (filename.substr(-4) === ".ods") {
                        mimetype = mimebase + "spreadsheet";
                    }
                    blob = new Blob([data.buffer], {type: mimetype});
                    saveAs(blob, filename);
                    //TODO: add callback as event handler to saveAs
                    fireEvent(Editor.EVENT_SAVEDTOFILE, null);
                }
                function onerror(error) {
                    // TODO: use callback for that
                    alert(error);
                }

                fireEvent(Editor.EVENT_BEFORESAVETOFILE, null);
                getFileBlob(onsuccess, onerror);
            };

            /**
             * @param {!Object} error
             * @return {undefined}
             */
            function handleOperationRouterErrors(error) {
                // TODO: translate error into Editor ids or at least document the possible values
                fireEvent(Editor.EVENT_ERROR, error);
            }

            /**
             * open the initial document of an editing-session,
             * request a replay of previous operations, call
             * editorReadyCallback once everything is done.
             *
             * @param {!string} sessionId
             * @param {!string} memberId
             * @param {!function()} editorReadyCallback
             * @return {undefined}
             */
            this.openSession = function (sessionId, memberId, editorReadyCallback) {
                initDocLoading(server.getGenesisUrl(sessionId), memberId, function () {
                    // overwrite router 
                    // TODO: serverFactory should be a backendFactory,
                    // and there should be a backendFactory for local editing
                    var opRouter = serverFactory.createOperationRouter(sessionId, memberId, server, odfCanvas.odfContainer(), handleOperationRouterErrors);
                    session.setOperationRouter(opRouter);
                    // forward events
                    // TODO: relying here on that opRouter uses the same id strings ATM, those should be defined at OperationRouter interface
                    opRouter.subscribe(Editor.EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED, function (hasUnsyncedOps) {
                        fireEvent(Editor.EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED, hasUnsyncedOps);
                    });
                    opRouter.subscribe(Editor.EVENT_HASSESSIONHOSTCONNECTIONCHANGED, function (hasSessionHostConnection) {
                        fireEvent(Editor.EVENT_HASSESSIONHOSTCONNECTIONCHANGED, hasSessionHostConnection);
                    });
                    opRouter.subscribe(Editor.EVENT_BEFORESAVETOFILE, function () {
                        fireEvent(Editor.EVENT_BEFORESAVETOFILE, null);
                    });
                    opRouter.subscribe(Editor.EVENT_SAVEDTOFILE, function () {
                        fireEvent(Editor.EVENT_SAVEDTOFILE, null);
                    });

                    // now get existing ops and after that let the user edit
                    opRouter.requestReplay(function done() {
                        editorReadyCallback();
                    });

                });
            };

            /**
             * Closes the current editing running editing (polling-timer),
             * cleanup.
             * @param {!function(!Object=)} callback, passing an error object in case of error
             * @return {undefined}
             */
            this.closeSession = function (callback) {
                runtime.assert(session, "session should exist here.");
                // TODO: there is a better pattern for this instead of unrolling
                session.close(function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        // now also destroy session, will not be reused for new document
                        memberListView.setEditorSession(undefined);
                        editorSession.destroy(function(err) {
                            if (err) {
                                callback(err);
                            } else {
                                editorSession = undefined;
                                session.destroy(function(err) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        session = undefined;
                                        callback();
                                    }
                                });
                            }
                        });
                    }
                });
            };

            /**
             * Adds a cursor and enables the tools and allows modifications.
             * Should be called inside/after editorReadyCallback.
             * TODO: turn this and endEditing() into readonly switch
             * @return {undefined}
             */
            this.startEditing = function () {
                runtime.assert(editorSession, "editorSession should exist here.");

                tools.setEditorSession(editorSession);
                editorSession.sessionController.insertLocalCursor();
                editorSession.sessionController.startEditing();
            };

            /**
             * Removes the cursor and disables the tools and allows modifications.
             * Should be called before closeDocument, if startEditing was called before
             * @return {undefined}
             */
            this.endEditing = function () {
                runtime.assert(editorSession, "editorSession should exist here.");

                tools.setEditorSession(undefined);
                editorSession.sessionController.endEditing();
                editorSession.sessionController.removeLocalCursor();
            };

            /**
             * Allows to register listeners for certain events. Currently
             * available events are, with the type of the argument passed to the callback:
             * Editor.EVENT_BEFORESAVETOFILE - no argument
             * Editor.EVENT_SAVEDTOFILE - no argument
             * Editor.EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED - boolean, reflecting new hasLocalUnsyncedOperations state
             * Editor.EVENT_HASSESSIONHOSTCONNECTIONCHANGED - boolean, reflecting new hasSessionhostConnection state
             * Editor.EVENT_ERROR - string, one of these errorcodes:
             *   "notMemberOfSession"
             *   "opExecutionFailure"
             *   "sessionDoesNotExist"
             *   "unknownOpReceived"
             *   "unknownServerReply"
             *   "unresolvableConflictingOps"
             *
             * @param {!string} eventid
             * @param {!Function} listener
             * @return {undefined}
             */
            this.addEventListener = function (eventid, listener) {
                eventNotifier.subscribe(eventid, listener);
            };

            /**
             * @param {!string} eventid
             * @param {!Function} listener
             * @return {undefined}
             */
            this.removeEventListener = function (eventid, listener) {
                eventNotifier.unsubscribe(eventid, listener);
            };

            /**
             * @param {!function(!Object=)} callback, passing an error object in case of error
             * @return {undefined}
             */
            this.destroy = function (callback) {
                var destroyMemberListView = memberListView ? memberListView.destroy : function(cb) { cb(); };

                // TODO: decide if some forced close should be done here instead of enforcing proper API usage
                runtime.assert(!session, "session should not exist here.");

                // TODO: investigate what else needs to be done
                mainContainer.destroyRecursive(true);

                destroyMemberListView(function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        tools.destroy(function(err) {
                            if (err) {
                                callback(err);
                            } else {
                                odfCanvas.destroy(function(err) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        callback();
                                    }
                                });
                            }
                        });
                    }
                });
            };

            function setFocusToOdfCanvas() {
                editorSession.sessionController.getEventManager().focus();
            }

            // init
            function init() {
                var editorPane, memberListPane,
                    inviteButton,
                    canvasElement = document.getElementById("canvas"),
                    container = document.getElementById('container'),
                    memberListElement = document.getElementById('memberList'),
                    collabEditing = Boolean(server),
                    directParagraphStylingEnabled = (! collabEditing) || args.unstableFeaturesEnabled,
                    imageInsertingEnabled = (! collabEditing) || args.unstableFeaturesEnabled,
                    hyperlinkEditingEnabled = (! collabEditing) || args.unstableFeaturesEnabled,
                    // annotations not yet properly supported for OT
                    annotationsEnabled = (! collabEditing) || args.unstableFeaturesEnabled,
                     // undo manager is not yet integrated with collaboration
                    undoRedoEnabled = (! collabEditing),
                    closeCallback;

                // Extend runtime with a convenient translation function
                runtime.translateContent = function (node) {
                    var i,
                        element,
                        tag,
                        placeholder,
                        translatable = node.querySelectorAll("*[text-i18n]");

                    for (i = 0; i < translatable.length; i += 1) {
                        element = translatable[i];
                        tag = element.localName;
                        placeholder = element.getAttribute('text-i18n');
                        if (tag === "label"
                                || tag === "span"
                                || /h\d/i.test(tag)) {
                            element.textContent = runtime.tr(placeholder);
                        }
                    }
                };

                if (collabEditing) {
                    runtime.assert(memberListElement, 'missing "memberList" div in HTML');
                }

                runtime.assert(canvasElement, 'missing "canvas" div in HTML');

                // App Widgets
                mainContainer = new BorderContainer({}, 'mainContainer');

                editorPane = new ContentPane({
                    region: 'center'
                }, 'editor');
                mainContainer.addChild(editorPane);

                if (collabEditing) {
                    memberListPane = new ContentPane({
                        region: 'right',
                        title: runtime.tr("Members")
                    }, 'members');
                    mainContainer.addChild(memberListPane);
                    memberListView = new MemberListView(memberListElement);
                }

                mainContainer.startup();

                if (window.inviteButtonProxy) {
                    inviteButton = document.getElementById('inviteButton');
                    runtime.assert(inviteButton, 'missing "inviteButton" div in HTML');
                    inviteButton.innerText = runtime.tr("Invite Members");
                    inviteButton.style.display = "block";
                    inviteButton.onclick = window.inviteButtonProxy.clicked;
                }

                tools = new Tools({
                    onToolDone: setFocusToOdfCanvas,
                    loadOdtFile: loadOdtFile,
                    saveOdtFile: saveOdtFile,
                    close: close,
                    directParagraphStylingEnabled: directParagraphStylingEnabled,
                    imageInsertingEnabled: imageInsertingEnabled,
                    hyperlinkEditingEnabled: hyperlinkEditingEnabled,
                    annotationsEnabled: annotationsEnabled,
                    undoRedoEnabled: undoRedoEnabled
                });

                odfCanvas = new odf.OdfCanvas(canvasElement);
                odfCanvas.enableAnnotations(annotationsEnabled, true);

                odfCanvas.addListener("statereadychange", function () {
                    var viewOptions = {
                            editInfoMarkersInitiallyVisible: collabEditing,
                            caretAvatarsInitiallyVisible: collabEditing,
                            caretBlinksOnRangeSelect: true
                        };

                    // create session around loaded document
                    session = new ops.Session(odfCanvas);
                    editorSession = new EditorSession(session, pendingMemberId, {
                        viewOptions: viewOptions,
                        directParagraphStylingEnabled: directParagraphStylingEnabled,
                        imageInsertingEnabled: imageInsertingEnabled,
                        hyperlinkEditingEnabled: hyperlinkEditingEnabled
                    });
                    if (undoRedoEnabled) {
                        editorSession.sessionController.setUndoManager(new gui.TrivialUndoManager());
                    }

                    if (memberListView) {
                        memberListView.setEditorSession(editorSession);
                    }

                    // and report back to caller
                    pendingEditorReadyCallback();
                    // reset
                    pendingEditorReadyCallback = null;
                    pendingMemberId = null;
                });

                function translateToolbar() {
                    var bar = document.getElementById('toolbar'),
                        y = document.body.scrollTop,
                        x = document.body.scrollLeft,
                        zoom = document.documentElement.clientWidth / window.innerWidth;

                    bar.style.WebkitTransformOrigin =
                    bar.style.MozTransformOrigin =
                    bar.style.TransformOrigin = "left top";
                    bar.style.WebkitTransform = 'translate(' + x + 'px, ' + y + 'px) scale(' + 1/zoom + ')';
                }

                function hideToolbar() {
                    var bar= document.getElementById('toolbar');
                    bar.style.display = 'none';
                }
                function showToolbar() {
                    var bar= document.getElementById('toolbar');
                    bar.style.display = 'block';
                }
                runtime.getWindow().addEventListener('scroll', translateToolbar);
                runtime.getWindow().addEventListener('focusout', translateToolbar);
                runtime.getWindow().addEventListener('touchmove', translateToolbar);

                runtime.getWindow().addEventListener('touchmove', hideToolbar);
                runtime.getWindow().addEventListener('touchend', showToolbar);

                runtime.getWindow().addEventListener('gesturestart', hideToolbar);
                runtime.getWindow().addEventListener('gestureend', showToolbar);
            }

            init();
        }

        /**@const @type {!string}*/
        Editor.EVENT_ERROR =                             "error";
        /**@const @type {!string}*/
        Editor.EVENT_BEFORESAVETOFILE =                  "beforeSaveToFile";
        /**@const @type {!string}*/
        Editor.EVENT_SAVEDTOFILE =                       "savedToFile";
        /**@const @type {!string}*/
        Editor.EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED = "hasLocalUnsyncedOperationsChanged";
        /**@const @type {!string}*/
        Editor.EVENT_HASSESSIONHOSTCONNECTIONCHANGED =   "hasSessionHostConnectionChanged";

        return Editor;
    });

// vim:expandtab
