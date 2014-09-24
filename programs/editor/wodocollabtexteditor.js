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

var Wodo = Wodo || (function () {
    "use strict";

    var /** @type{!boolean} */
        isInitalized = false,
        /** @type{!Array.<!function():undefined>} */
        pendingInstanceCreationCalls = [],
        /** @type{!number} */
        instanceCounter = 0,
        // constructors
        BorderContainer, ContentPane, FullWindowZoomHelper, EditorSession, Tools, MemberListView,
        // const strings
        /** @const
            @type {!string} */
        EVENT_UNKNOWNERROR =                      "unkownError",
        /** @const
            @type {!string} */
        EVENT_METADATACHANGED =                   "metadataChanged",
        /** @const
            @type {!string} */
        EVENT_BEFORESAVETOFILE =                  "beforeSaveToFile",
        /** @const
            @type {!string} */
        EVENT_SAVEDTOFILE =                       "savedToFile",
        /** @const
            @type {!string} */
        EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED = "hasLocalUnsyncedOperationsChanged",
        /** @const
            @type {!string} */
        EVENT_HASSESSIONHOSTCONNECTIONCHANGED =   "hasSessionHostConnectionChanged";


    /**
     * @return {undefined}
     */
    function initCollabTextEditor() {
        require([
            "dijit/layout/BorderContainer",
            "dijit/layout/ContentPane",
            "webodf/editor/FullWindowZoomHelper",
            "webodf/editor/EditorSession",
            "webodf/editor/Tools",
            "webodf/editor/MemberListView",
            "webodf/editor/Translator"],
            function (BC, CP, FWZH, ES, T, MLV, Translator) {
                var locale = navigator.language || "en-US",
                    editorBase = dojo.config && dojo.config.paths && dojo.config.paths["webodf/editor"],
                    translationsDir = editorBase + '/translations',
                    t;

                BorderContainer = BC;
                ContentPane = CP;
                FullWindowZoomHelper = FWZH,
                EditorSession = ES;
                Tools = T;
                MemberListView = MLV;

                // TODO: locale cannot be set by the user, also different for different editors
                t = new Translator(translationsDir, locale, function (editorTranslator) {
                    runtime.setTranslator(editorTranslator.translate);
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

                    isInitalized = true;
                    pendingInstanceCreationCalls.forEach(function (create) { create(); });
                });
            }
        );
    }

    /**
     * @constructor
     * @param {!string} mainContainerElementId
     * @param {!Object.<!string,!*>} editorOptions
     */
    function CollabTextEditor(mainContainerElementId, editorOptions) {
        instanceCounter = instanceCounter + 1;

        /**
        * Returns true if either all features are wanted and this one is not explicitely disabled
        * or if not all features are wanted by default and it is explicitely enabled
        * @param {?boolean|undefined} isFeatureEnabled explicit flag which enables a feature
        * @param {!boolean=} isUnstable set to true if the feature is not stable (in collab mode)
        * @return {!boolean}
        */
        function isEnabled(isFeatureEnabled, isUnstable) {
            if (isUnstable && ! editorOptions.unstableFeaturesEnabled) {
                return false;
            }
            return editorOptions.allFeaturesEnabled ? (isFeatureEnabled !== false) : isFeatureEnabled;
        }

        var self = this,
            //
            mainContainerElement = document.getElementById(mainContainerElementId),
            canvasElement,
            canvasContainerElement,
            toolbarElement,
            toolbarContainerElement, // needed because dijit toolbar overwrites direct classList
            editorElement,
            /** @const
                @type{!string} */
            canvasElementId = "webodfeditor-canvas" + instanceCounter,
            /** @const
                @type{!string} */
            canvasContainerElementId = "webodfeditor-canvascontainer" + instanceCounter,
            /** @const
                @type{!string} */
            toolbarElementId = "webodfeditor-toolbar" + instanceCounter,
            /** @const
                @type{!string} */
            editorElementId = "webodfeditor-editor" + instanceCounter,
            //
            fullWindowZoomHelper,
            //
            memberListElement,
            membersElement,
            /** @const
                @type{!string} */
            membersElementId = "webodfeditor-members" + instanceCounter,
            //
            mainContainer,
            memberListView,
            tools,
            odfCanvas,
            //
            editorSession,
            session,
            //
            saveOdtFile = editorOptions.saveCallback,
            close =       editorOptions.closeCallback,
            //
            directTextStylingEnabled = isEnabled(editorOptions.directTextStylingEnabled),
            directParagraphStylingEnabled = isEnabled(editorOptions.directParagraphStylingEnabled),
            paragraphStyleSelectingEnabled = isEnabled(editorOptions.paragraphStyleSelectingEnabled),
            paragraphStyleEditingEnabled = isEnabled(editorOptions.paragraphStyleEditingEnabled),
            imageEditingEnabled = isEnabled(editorOptions.imageEditingEnabled, true),
            hyperlinkEditingEnabled = isEnabled(editorOptions.hyperlinkEditingEnabled, true),
            listEditingEnabled = isEnabled(editorOptions.listEditingEnabled, true),
            reviewModeEnabled = isEnabled(editorOptions.reviewModeEnabled, true),
            annotationsEnabled = reviewModeEnabled || isEnabled(editorOptions.annotationsEnabled, true),
            undoRedoEnabled = false, // no proper mechanism yet for collab
            zoomingEnabled = isEnabled(editorOptions.zoomingEnabled),
            //
            pendingMemberId,
            pendingEditorReadyCallback,
            //
            eventNotifier = new core.EventNotifier([
                EVENT_UNKNOWNERROR,
                EVENT_METADATACHANGED,
                EVENT_BEFORESAVETOFILE,
                EVENT_SAVEDTOFILE,
                EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED,
                EVENT_HASSESSIONHOSTCONNECTIONCHANGED
            ]);

        runtime.assert(Boolean(mainContainerElement), "No id of an existing element passed to Wodo.createCollabTextEditor(): "+mainContainerElementId);

        /**
         * @param {!Object} changes
         * @return {undefined}
         */
        function relayMetadataSignal(changes) {
            eventNotifier.emit(EVENT_METADATACHANGED, changes);
        }

        /**
         * @return {undefined}
         */
        function createSession() {
            var viewOptions = {
                    editInfoMarkersInitiallyVisible: true,
                    caretAvatarsInitiallyVisible: true,
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
                listEditingEnabled: listEditingEnabled,
                annotationsEnabled: annotationsEnabled,
                zoomingEnabled: zoomingEnabled,
                reviewModeEnabled: reviewModeEnabled
            });
            if (undoRedoEnabled) {
                editorSession.sessionController.setUndoManager(new gui.TrivialUndoManager());
            }

            memberListView.setEditorSession(editorSession);

            // Relay any metadata changes to the Editor's consumer as an event
            editorSession.sessionController.getMetadataController().subscribe(gui.MetadataController.signalMetadataChanged, relayMetadataSignal);

            // and report back to caller
            pendingEditorReadyCallback();
            // reset
            pendingEditorReadyCallback = null;
            pendingMemberId = null;
        }

        /**
         * @return {undefined}
         */
        function startEditing() {
            runtime.assert(editorSession, "editorSession should exist here.");

            tools.setEditorSession(editorSession);
            editorSession.sessionController.insertLocalCursor();
            editorSession.sessionController.startEditing();
        }

        /**
         * @return {undefined}
         */
        function endEditing() {
            runtime.assert(editorSession, "editorSession should exist here.");

            tools.setEditorSession(undefined);
            editorSession.sessionController.endEditing();
            editorSession.sessionController.removeLocalCursor();
        }

        /**
         * @param {!string} eventid
         * @param {*} args
         * @return {undefined}
         */
        function fireEvent(eventid, args) {
            eventNotifier.emit(eventid, args);
        }

        /**
         * @param {!Object} error
         * @return {undefined}
         */
        function handleOperationRouterErrors(error) {
            // TODO: translate error into Editor ids or at least document the possible values
            fireEvent(EVENT_UNKNOWNERROR, error);
        }

        /**
         * @param {!SessionBackend} sessionBackend
         * @param {!function(!Error=):undefined} callback, passing an error object in case of error
         * @return {undefined}
         */
        function joinSession(sessionBackend, editorReadyCallback) {
            runtime.assert(sessionBackend, "No sessionBackend passed.");
            runtime.assert(sessionBackend.getMemberId(), "sessionBackend should deliver a memberId here.");

            runtime.assert(!pendingEditorReadyCallback, "pendingEditorReadyCallback should not exist here.");
            runtime.assert(!editorSession, "editorSession should not exist here.");
            runtime.assert(!session, "session should not exist here.");

            pendingMemberId = sessionBackend.getMemberId();
            pendingEditorReadyCallback = function () {
                // overwrite router 
                var opRouter = sessionBackend.createOperationRouter(odfCanvas.odfContainer(), handleOperationRouterErrors);
                session.setOperationRouter(opRouter);
                // forward events
                // TODO: relying here on that opRouter uses the same id strings ATM, those should be defined at OperationRouter interface
                opRouter.subscribe(EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED, function (hasUnsyncedOps) {
                    fireEvent(EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED, hasUnsyncedOps);
                });
                opRouter.subscribe(EVENT_HASSESSIONHOSTCONNECTIONCHANGED, function (hasSessionHostConnection) {
                    fireEvent(EVENT_HASSESSIONHOSTCONNECTIONCHANGED, hasSessionHostConnection);
                });
                opRouter.subscribe(EVENT_BEFORESAVETOFILE, function () {
                    fireEvent(EVENT_BEFORESAVETOFILE, null);
                });
                opRouter.subscribe(EVENT_SAVEDTOFILE, function () {
                    fireEvent(EVENT_SAVEDTOFILE, null);
                });

                // now get existing ops and after that let the user edit
                opRouter.requestReplay(function done() {
                    startEditing();
                    if (editorReadyCallback) {
                        editorReadyCallback();
                    }
                });

            };

            odfCanvas.load(sessionBackend.getGenesisUrl());
        }

        /**
         * Leave the currently joined edit session, and do cleanup.
         * @param {!function(!Error=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        function leaveSession(callback) {
            runtime.assert(session, "session should exist here.");

            endEditing();

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
        }

        /**
         * @return {!Element}
         */
        function getCanvasContainerElement() {
            return canvasContainerElement;
        }

        /**
         * @param {!function(err:?Error, !Uint8Array=):undefined} cb receiving zip as bytearray
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
        function setMetadata(setProperties, removedProperties) {
            runtime.assert(editorSession, "editorSession should exist here.");

            editorSession.sessionController.getMetadataController().setMetadata(setProperties, removedProperties);
        };

        /**
         * Returns the value of the requested document metadata field
         * @param {!string} property A namespace-prefixed field name, for example
         * dc:creator
         * @return {?string}
         */
        function getMetadata(property) {
            runtime.assert(editorSession, "editorSession should exist here.");

            return editorSession.sessionController.getMetadataController().getMetadata(property);
        };

        /**
         * @return {undefined}
         */
        function setFocusToOdfCanvas() {
            editorSession.sessionController.getEventManager().focus();
        }

        /**
         * @param {!function(!Error=):undefined} callback, passing an error object in case of error
         * @return {undefined}
         */
        function destroyInternal(callback) {
            mainContainerElement.removeChild(editorElement);
            mainContainerElement.removeChild(membersElement);

            callback();
        }

        /**
         * @param {!function(!Error=):undefined} callback, passing an error object in case of error
         * @return {undefined}
         */
        function destroy(callback) {
            var destroyCallbacks = [];

            // TODO: decide if some forced close should be done here instead of enforcing proper API usage
            runtime.assert(!session, "session should not exist here.");

            // TODO: investigate what else needs to be done
            mainContainer.destroyRecursive(true);

            destroyCallbacks = destroyCallbacks.concat([
                fullWindowZoomHelper.destroy,
                memberListView.destroy,
                tools.destroy,
                odfCanvas.destroy,
                destroyInternal
            ]);

            core.Async.destroyAll(destroyCallbacks, callback);
        }

        /////////////////////////////////////////////////////////////////////
        // Exposed API
        // make sure no data structures are shared, copy as needed
        //

        this.joinSession = joinSession;
        this.leaveSession = leaveSession;

        this.getDocumentAsByteArray = getDocumentAsByteArray;

        // setReadOnly: setReadOnly,

        this.setMetadata = setMetadata;
        this.getMetadata = getMetadata;

        // temporary hack:
        this.getCanvasContainerElement = getCanvasContainerElement;

        this.addEventListener = eventNotifier.subscribe;
        this.removeEventListener = eventNotifier.unsubscribe;

        this.destroy = destroy;


        /**
         * @return {undefined}
         */
        function init() {
            var editorPane, memberListPane,
                documentns = document.documentElement.namespaceURI;

            function createElement(tagLocalName, id, className) {
                var element;
                element = document.createElementNS(documentns, tagLocalName);
                if (id) {
                    element.id = id;
                }
                element.classList.add(className);
                return element;
            }

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

            // memberlist plugin
            memberListElement = createElement('div', undefined, "webodfeditor-memberList");
            membersElement = createElement('div', membersElementId, "webodfeditor-members");

            // put into tree
            membersElement.appendChild(memberListElement);
            mainContainerElement.appendChild(membersElement);

            // style all elements with Dojo's claro.
            // Not nice to do this on body, but then there is no other way known
            // to style also all dialogs, which are attached directly to body
            document.body.classList.add("claro");

            // create widgets
            mainContainer = new BorderContainer({}, mainContainerElementId);

            editorPane = new ContentPane({
                region: 'center'
            }, editorElementId);
            mainContainer.addChild(editorPane);

            memberListPane = new ContentPane({
                region: 'right',
                title: runtime.tr("Members")
            }, membersElementId);
            mainContainer.addChild(memberListPane);
            memberListView = new MemberListView(memberListElement);

            mainContainer.startup();

            tools = new Tools(toolbarElementId, {
                onToolDone: setFocusToOdfCanvas,
                saveOdtFile: saveOdtFile,
                close: close,
                directTextStylingEnabled: directTextStylingEnabled,
                directParagraphStylingEnabled: directParagraphStylingEnabled,
                paragraphStyleSelectingEnabled: paragraphStyleSelectingEnabled,
                paragraphStyleEditingEnabled: paragraphStyleEditingEnabled,
                imageInsertingEnabled: imageEditingEnabled,
                hyperlinkEditingEnabled: hyperlinkEditingEnabled,
                listEditingEnabled: listEditingEnabled,
                annotationsEnabled: annotationsEnabled,
                undoRedoEnabled: undoRedoEnabled,
                zoomingEnabled: zoomingEnabled
            });

            odfCanvas = new odf.OdfCanvas(canvasElement);
            odfCanvas.enableAnnotations(annotationsEnabled, true);

            odfCanvas.addListener("statereadychange", createSession);

            fullWindowZoomHelper = new FullWindowZoomHelper(toolbarContainerElement, canvasContainerElement);
        }

        init();
    }

    /**
     * @param {!string} mainContainerElementId
     * @param {!Object.<!string,!*>} editorOptions
     * @param {!function(err:?Error, editor:!CollabTextEditor=):undefined} onEditorCreated
     * @return {undefined}
     */
    function createInstance(mainContainerElementId, editorOptions, onEditorCreated) {
        /**
         * @return {undefined}
         */
        function create() {
            var editor = new CollabTextEditor(mainContainerElementId, editorOptions);
            onEditorCreated(null, editor);
        }

        if (!isInitalized) {
            pendingInstanceCreationCalls.push(create);
            // first request?
            if (pendingInstanceCreationCalls.length === 1) {
                initCollabTextEditor();
            }
        } else {
            create();
        }
    }

    // exposed API
    return {
        createCollabTextEditor: createInstance,
        // flags
        EVENT_UNKNOWNERROR: EVENT_UNKNOWNERROR,
        EVENT_METADATACHANGED: EVENT_METADATACHANGED,
        EVENT_BEFORESAVETOFILE: EVENT_BEFORESAVETOFILE,
        EVENT_SAVEDTOFILE: EVENT_SAVEDTOFILE,
        EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED: EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED,
        EVENT_HASSESSIONHOSTCONNECTIONCHANGED: EVENT_HASSESSIONHOSTCONNECTIONCHANGED
    };
}());
