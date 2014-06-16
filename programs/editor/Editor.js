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

        var editorInstanceCounter = 0;

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

        /**
         * @constructor
         * @param {{unstableFeaturesEnabled:boolean,
         *          allFeaturesEnabled:boolean,
         *          reviewModeEnabled: boolean,
         *          collabEditingEnabled:boolean,
         *          loadCallback:function(),
         *          saveCallback:function(),
         *          closeCallback:function()}}
         */
        function Editor(mainContainerElementId, args) {

            var self = this,
                // Private
                session,
                editorSession,
                //
                mainContainerElement,
                editorElement,
                toolbarContainerElement, // container needed because dijit toolbar overwrites direct classList
                canvasContainerElement,
                //
                membersElement,
                //
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
                    Editor.EVENT_HASSESSIONHOSTCONNECTIONCHANGED,
                    Editor.EVENT_METADATACHANGED
                ]),
                pendingMemberId,
                pendingEditorReadyCallback,
                FEATURE = {
                    COLLAB_UNSTABLE: 1,
                    COLLAB_MISSING: 2
                };

            /**
             * @param {!string} eventid
             * @param {*} args
             * @return {undefined}
             */
            function fireEvent(eventid, args) {
                eventNotifier.emit(eventid, args);
            }

            /**
             * @param {!Object} changes
             * @return {undefined}
             */
            function relayMetadataSignal(changes) {
                fireEvent(Editor.EVENT_METADATACHANGED, changes);
            }


            /**
             * Create an Uint8Array containing the ODT file of the current state of the document
             * and pass it to the callback method.
             * Should be only called when a document is loaded, so either between "openDocument"
             * and "closeDocument" or between "openSession" and "closeSession"
             * TODO: define error object passed to callback
             * @param {!function(err:?Object, !Uint8Array=):undefined} cb receiving ODT file as ByteArray
             * @return {undefined}
             */
            function getDocumentAsByteArray(cb) {
                var odfContainer = odfCanvas.odfContainer();

                if (odfContainer) {
                    odfContainer.createByteArray(function(ba) {
                        cb(null, ba);
                    }, function(err) {
                        cb(err ? err : "Could not create bytearray.");
                    });
                } else {
                    cb("No odfContainer!");
                }
            }

            this.getDocumentAsByteArray = getDocumentAsByteArray;

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
             * @param {!function()} editorReadyCallback
             * @return {undefined}
             */
            this.openDocument = function (docUrl, editorReadyCallback) {
                var localMemberId = "localuser";

                initDocLoading(docUrl, localMemberId, function () {
                    runtime.loadClass("ops.OpAddMember");
                    var op = new ops.OpAddMember();
                    op.init({
                        memberid: localMemberId,
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
             * @param {!function(!Error=)} callback, passing an error object in case of error
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
                        editorSession.sessionController.getMetadataController().unsubscribe(gui.MetadataController.signalMetadataChanged, relayMetadataSignal);
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
                function onFileBlob(err, data) {
                    if (err) {
                        // TODO: use callback for that
                        alert(error);
                        return;
                    }

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

                fireEvent(Editor.EVENT_BEFORESAVETOFILE, null);
                getDocumentAsByteArray(onFileBlob);
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
             * @param {!SessionBackend} sessionBackend
             * @param {!function()} editorReadyCallback
             * @return {undefined}
             */
            this.openSession = function (sessionBackend, editorReadyCallback) {
                initDocLoading(sessionBackend.getGenesisUrl(), sessionBackend.getMemberId(), function () {
                    // overwrite router
                    var opRouter = sessionBackend.createOperationRouter(odfCanvas.odfContainer(), handleOperationRouterErrors);
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
             * @param {!function(!Error=)} callback, passing an error object in case of error
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
                        editorSession.sessionController.getMetadataController().unsubscribe(gui.MetadataController.signalMetadataChanged, relayMetadataSignal);
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
             * Temporary util method, to be removed after refactoring
             * @return {!Element}
             */
            this.getCanvasContainerElement = function() {
                return canvasContainerElement;
            };

            /**
             * Sets the metadata fields from the given properties map.
             * Avoid setting certain fields since they are automatically set:
             *     dc:creator
             *     dc:date
             *     meta:editing-cycles
             * If you do wish to externally set these fields, try getting
             * the server backend (if any) to inject operations into the timeline
             * with the relevant properties.
             *
             * The following properties are never used and will be removed for semantic
             * consistency from the document:
             *     meta:editing-duration
             *     meta:document-statistic
             *
             * Setting any of the above mentioned fields using this method will have no effect.
             *
             * @param {?Object.<!string, !string>} setProperties A flat object that is a string->string map of field name -> value.
             * @param {?Array.<!string>} removedProperties An array of metadata field names (prefixed).
             * @return {undefined}
             */
            this.setMetadata = function (setProperties, removedProperties) {
                runtime.assert(editorSession, "editorSession should exist here.");

                editorSession.sessionController.getMetadataController().setMetadata(setProperties, removedProperties);
            };

            /**
             * Returns the value of the requested document metadata field
             * @param {!string} property A namespace-prefixed field name, for example
             * dc:creator
             * @return {?string}
             */
            this.getMetadata = function (property) {
                runtime.assert(editorSession, "editorSession should exist here.");

                return editorSession.sessionController.getMetadataController().getMetadata(property);
            };

            /**
             * Applies a CSS transformation to the toolbar
             * to ensure that if there is a body-scroll,
             * the toolbar remains visible at the top of
             * the screen.
             * The bodyscroll quirk has been observed on
             * iOS, generally when the keyboard appears.
             * But this workaround should function on
             * other platforms that exhibit this behaviour
             * as well.
             * @return {undefined}
             */
            function translateToolbar() {
                var bar = toolbarContainerElement,
                    y = document.body.scrollTop;

                bar.style.WebkitTransformOrigin = "center top";
                bar.style.WebkitTransform = 'translateY(' + y + 'px)';
            }

            /**
             * FIXME: At the moment both the toolbar and the canvas
             * container are absolutely positioned. Changing them to
             * relative positioning to ensure that they do not overlap
             * causes scrollbars *within* the container to disappear.
             * Not sure why this happens, and a proper CSS fix has not
             * been found yet, so for now we need to reposition
             * the container using Js.
             * @return {undefined}
             */
            function repositionContainer() {
                canvasContainerElement.style.top = toolbarContainerElement.getBoundingClientRect().height + 'px';
            }

            /**
             * @param {!function(!Object=)} callback, passing an error object in case of error
             * @return {undefined}
             */
            function destroyInternal(callback) {
                mainContainerElement.removeChild(editorElement);
                if (membersElement) {
                    mainContainerElement.removeChild(membersElement);
                }

                callback();
            }

            /**
             * @param {!function(!Error=)} callback, passing an error object in case of error
             * @return {undefined}
             */
            this.destroy = function (callback) {
                var destroyCallbacks = [];

                window.removeEventListener('scroll', translateToolbar);
                window.removeEventListener('focusout', translateToolbar);
                window.removeEventListener('touchmove', translateToolbar);
                window.removeEventListener('resize', repositionContainer);

                // TODO: decide if some forced close should be done here instead of enforcing proper API usage
                runtime.assert(!session, "session should not exist here.");

                // TODO: investigate what else needs to be done
                mainContainer.destroyRecursive(true);

                if (memberListView) {
                    destroyCallbacks.push(memberListView.destroy);
                }
                destroyCallbacks = destroyCallbacks.concat([
                    tools.destroy,
                    odfCanvas.destroy,
                    destroyInternal
                ]);

                core.Async.destroyAll(destroyCallbacks, callback);
            };

            function setFocusToOdfCanvas() {
                editorSession.sessionController.getEventManager().focus();
            }

            /**
             * Returns true if either all features are wanted and this one is not explicitely disabled
             * or if not all features are wanted by default and it is explicitely enabled
             * @param {?boolean|undefined} isFeatureEnabled explicit flag which enables a feature
             * @param {!number=} flag
             * @return {!boolean}
             */
            function isEnabled(isFeatureEnabled, flag) {
                switch (flag) {
                    case FEATURE.COLLAB_UNSTABLE:
                        if (args.collabEditingEnabled && ! args.unstableFeaturesEnabled) {
                            return false;
                        }
                        break;
                    case FEATURE.COLLAB_MISSING:
                        if (args.collabEditingEnabled) {
                            return false;
                        }
                        break;
                    default:
                        break;
                }
                return args.allFeaturesEnabled ? (isFeatureEnabled !== false) : isFeatureEnabled;
            }

            // init
            function init() {
                var editorPane, memberListPane,
                    //
                    editorElementId = "webodfeditor-editor" + editorInstanceCounter,
                    canvasElementId = "webodfeditor-canvas" + editorInstanceCounter,
                    canvasElement,
                    canvasContainerElementId = "webodfeditor-canvascontainer" + editorInstanceCounter,
                    toolbarElement,
                    toolbarElementId = "webodfeditor-toolbar" + editorInstanceCounter,
                    memberListElement,
                    membersElementId = "webodfeditor-members" + editorInstanceCounter,
                    documentns = document.documentElement.namespaceURI,
                    //
                    directTextStylingEnabled = isEnabled(args.directTextStylingEnabled),
                    directParagraphStylingEnabled = isEnabled(args.directParagraphStylingEnabled, FEATURE.COLLAB_UNSTABLE),
                    paragraphStyleSelectingEnabled = isEnabled(args.paragraphStyleSelectingEnabled),
                    paragraphStyleEditingEnabled = isEnabled(args.paragraphStyleEditingEnabled),
                    imageEditingEnabled = isEnabled(args.imageEditingEnabled, FEATURE.COLLAB_UNSTABLE),
                    // TODO: temporarily disabled because of at least the issues #490 and #650 (see github issue tracker)
                    hyperlinkEditingEnabled = false, // isEnabled(args.hyperlinkEditingEnabled, FEATURE.COLLAB_UNSTABLE),
                    reviewModeEnabled = isEnabled(args.reviewModeEnabled, FEATURE.COLLAB_UNSTABLE),
                    // annotations not yet properly supported for OT
                    annotationsEnabled = reviewModeEnabled || isEnabled(args.annotationsEnabled, FEATURE.COLLAB_UNSTABLE),
                     // undo manager is not yet integrated with collaboration
                    undoRedoEnabled = isEnabled(args.undoRedoEnabled, FEATURE.COLLAB_MISSING),
                    zoomingEnabled = isEnabled(args.zoomingEnabled),
                    aboutEnabled = (! args.collabEditingEnabled),
                    closeCallback;

                editorInstanceCounter += 1;

                function createElement(tagLocalName, id, className) {
                    var element;
                    element = document.createElementNS(documentns, tagLocalName);
                    if (id) {
                        element.id = id;
                    }
                    element.classList.add(className);
                    return element;
                }

                mainContainerElement = document.getElementById(mainContainerElementId);
                runtime.assert(Boolean(mainContainerElement), "No id of an existing element passed to WebODFEditor.createInstance(): "+mainContainerElementId);

               // create needed tree structure
                canvasElement = createElement('div', canvasElementId, "webodfeditor-canvas");
                canvasContainerElement = createElement('div', canvasContainerElementId, "webodfeditor-canvascontainer");
                toolbarElement = createElement('span', toolbarElementId, "webodfeditor-toolbar");
                toolbarContainerElement = createElement('span', undefined, "webodfeditor-toolbarcontainer");
                editorElement = createElement('div', editorElementId, "webodfeditor-editor");

                // put into tree
                canvasContainerElement.appendChild(canvasElement);
                toolbarContainerElement.appendChild(toolbarElement);
                editorElement.appendChild(toolbarContainerElement);
                editorElement.appendChild(canvasContainerElement);
                mainContainerElement.appendChild(editorElement);

                if (args.collabEditingEnabled) {
                    // memberlist plugin
                    memberListElement = createElement('div', undefined, "webodfeditor-memberList");
                    membersElement = createElement('div', membersElementId, "webodfeditor-members");

                    // put into tree
                    membersElement.appendChild(memberListElement);
                    mainContainerElement.appendChild(membersElement);
                }

                // App Widgets
                mainContainer = new BorderContainer({}, mainContainerElementId);

                editorPane = new ContentPane({
                    region: 'center'
                }, editorElementId);
                mainContainer.addChild(editorPane);

                if (args.collabEditingEnabled) {
                    memberListPane = new ContentPane({
                        region: 'right',
                        title: runtime.tr("Members")
                    }, membersElementId);
                    mainContainer.addChild(memberListPane);
                    memberListView = new MemberListView(memberListElement);
                }

                mainContainer.startup();

                tools = new Tools(toolbarElementId, {
                    onToolDone: setFocusToOdfCanvas,
                    loadOdtFile: loadOdtFile,
                    saveOdtFile: saveOdtFile,
                    close: close,
                    directTextStylingEnabled: directTextStylingEnabled,
                    directParagraphStylingEnabled: directParagraphStylingEnabled,
                    paragraphStyleSelectingEnabled: paragraphStyleSelectingEnabled,
                    paragraphStyleEditingEnabled: paragraphStyleEditingEnabled,
                    imageInsertingEnabled: imageEditingEnabled,
                    hyperlinkEditingEnabled: hyperlinkEditingEnabled,
                    annotationsEnabled: annotationsEnabled,
                    undoRedoEnabled: undoRedoEnabled,
                    zoomingEnabled: zoomingEnabled,
                    aboutEnabled: aboutEnabled
                });

                odfCanvas = new odf.OdfCanvas(canvasElement);
                odfCanvas.enableAnnotations(annotationsEnabled, true);

                odfCanvas.addListener("statereadychange", function () {
                    var viewOptions = {
                            editInfoMarkersInitiallyVisible: Boolean(args.collabEditingEnabled),
                            caretAvatarsInitiallyVisible: Boolean(args.collabEditingEnabled),
                            caretBlinksOnRangeSelect: true
                        };

                    // create session around loaded document
                    session = new ops.Session(odfCanvas);
                    editorSession = new EditorSession(session, pendingMemberId, {
                        viewOptions: viewOptions,
                        directTextStylingEnabled: directTextStylingEnabled,
                        directParagraphStylingEnabled: directParagraphStylingEnabled,
                        paragraphStyleSelectingEnabled: paragraphStyleSelectingEnabled,
                        paragraphStyleEditingEnabled: paragraphStyleEditingEnabled,
                        imageEditingEnabled: imageEditingEnabled,
                        hyperlinkEditingEnabled: hyperlinkEditingEnabled,
                        annotationsEnabled: annotationsEnabled,
                        undoRedoEnabled: undoRedoEnabled,
                        zoomingEnabled: zoomingEnabled,
                        reviewModeEnabled: reviewModeEnabled
                    });
                    if (undoRedoEnabled) {
                        editorSession.sessionController.setUndoManager(new gui.TrivialUndoManager());
                    }

                    if (memberListView) {
                        memberListView.setEditorSession(editorSession);
                    }

                    // Relay any metadata changes to the Editor's consumer as an event
                    editorSession.sessionController.getMetadataController().subscribe(gui.MetadataController.signalMetadataChanged, relayMetadataSignal);

                    // and report back to caller
                    pendingEditorReadyCallback();
                    // reset
                    pendingEditorReadyCallback = null;
                    pendingMemberId = null;
                });

                repositionContainer();

                window.addEventListener('scroll', translateToolbar);
                window.addEventListener('focusout', translateToolbar);
                window.addEventListener('touchmove', translateToolbar);
                window.addEventListener('resize', repositionContainer);
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
        /**@const @type {!string}*/
        Editor.EVENT_METADATACHANGED =                   "metadataChanged";

        return Editor;
    });

// vim:expandtab
