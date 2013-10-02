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
 * @source: http://gitorious.org/webodf/webodf/
 */

/*global runtime, define, document, odf, ops, window, gui, alert, saveAs, Blob */

define("webodf/editor/Editor", [
    "dojo/i18n!webodf/editor/nls/myResources",
    "webodf/editor/EditorSession",
    "webodf/editor/MemberListView",
    "dijit/layout/BorderContainer",
    "dijit/layout/ContentPane",
    "webodf/editor/Tools"],

    function (myResources,
        EditorSession,
        MemberListView,
        BorderContainer,
        ContentPane,
        Tools) {
        "use strict";

        runtime.loadClass('odf.OdfCanvas');

        /**
         * @constructor
         * @param {{unstableFeaturesEnabled:boolean=,
         *          loadCallback:function()=,
         *          saveCallback:function()=,
         *          closeCallback:function()=,
         * @param {!ops.Server=} server
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
                pendingMemberId,
                pendingEditorReadyCallback;

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
                initDocLoading(docUrl, memberId, editorReadyCallback);
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
                }
                function onerror(error) {
                    alert(error);
                }

                getFileBlob(onsuccess, onerror);
            };

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
                    var opRouter, memberModel;
                    // overwrite router and member model
                    // TODO: serverFactory should be a backendFactory,
                    // and there should be a backendFactory for local editing
                    opRouter = serverFactory.createOperationRouter(sessionId, memberId, server);
                    session.setOperationRouter(opRouter);

                    memberModel = serverFactory.createMemberModel(sessionId, server);
                    session.setMemberModel(memberModel);

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
            this.close = function (callback) {
                runtime.assert(session, "session should exist here.");
                // TODO: there is a better pattern for this instead of unrolling
                editorSession.close(function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        session.close(function(err) {
                            if (err) {
                                callback(err);
                            } else {
                                // now also destroy session, will not be reused for new document
                                if (memberListView) {
                                    memberListView.setEditorSession(undefined);
                                }
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
                                        document.translator = null;
                                        document.translateContent = null;
                                        callback();
                                    }
                                });
                            }
                        });
                    }
                });
            };

            function setFocusToOdfCanvas() {
                if (odfCanvas) {
                    odfCanvas.getElement().focus();
                }
            }

            // init
            function init() {
                var editorPane, memberListPane,
                    inviteButton,
                    canvasElement = document.getElementById("canvas"),
                    memberListElement = document.getElementById('memberList'),
                    collabEditing = Boolean(server),
                    directStylingEnabled = (! collabEditing) || args.unstableFeaturesEnabled,
                    imageInsertingEnabled = (! collabEditing) || args.unstableFeaturesEnabled,
                    // annotations not yet properly supported for OT
                    annotationsEnabled = (! collabEditing) || args.unstableFeaturesEnabled,
                     // undo manager is not yet integrated with collaboration
                    undoRedoEnabled = (! collabEditing),
                    closeCallback;

                if (collabEditing) {
                    runtime.assert(memberListElement, 'missing "memberList" div in HTML');
                }

                runtime.assert(canvasElement, 'missing "canvas" div in HTML');

                // setup translations
                // TODO: move from document instance into webodf namespace
                function translator(key, context) {
                    if (undefined === myResources[key]) {
                        return "translation missing: " + key;
                    }
                    return myResources[key];
                }
                document.translator = translator;

                function translateContent(node) {
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
                            element.textContent = document.translator(placeholder);
                        }
                    }
                }
                document.translateContent = translateContent;

                // App Widgets
                mainContainer = new BorderContainer({}, 'mainContainer');

                editorPane = new ContentPane({
                    region: 'center'
                }, 'editor');
                mainContainer.addChild(editorPane);

                if (collabEditing) {
                    memberListPane = new ContentPane({
                        region: 'right',
                        title: translator("members")
                    }, 'members');
                    mainContainer.addChild(memberListPane);
                    memberListView = new MemberListView(memberListElement);
                }

                mainContainer.startup();

                if (window.inviteButtonProxy) {
                    inviteButton = document.getElementById('inviteButton');
                    runtime.assert(inviteButton, 'missing "inviteButton" div in HTML');
                    inviteButton.innerText = translator("inviteMembers");
                    inviteButton.style.display = "block";
                    inviteButton.onclick = window.inviteButtonProxy.clicked;
                }

                tools = new Tools({
                        onToolDone: setFocusToOdfCanvas,
                        loadOdtFile: loadOdtFile,
                        saveOdtFile: saveOdtFile,
                        close: close,
                        directStylingEnabled: directStylingEnabled,
                        imageInsertingEnabled: imageInsertingEnabled,
                        annotationsEnabled: annotationsEnabled,
                        undoRedoEnabled: undoRedoEnabled
                    });

                odfCanvas = new odf.OdfCanvas(canvasElement);
                odfCanvas.enableAnnotations(annotationsEnabled);

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
                        directStylingEnabled: directStylingEnabled,
                        imageInsertingEnabled: imageInsertingEnabled
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
            }

            init();
        }
        return Editor;
    });

// vim:expandtab
