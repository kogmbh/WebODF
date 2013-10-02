/**
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

/*global define,document,require */

define("webodf/editor/Tools", [
    "dojo/ready",
    "dijit/MenuItem",
    "dijit/DropDownMenu",
    "dijit/form/Button",
    "dijit/form/DropDownButton",
    "dijit/Toolbar",
    "webodf/editor/widgets/paragraphAlignment",
    "webodf/editor/widgets/simpleStyles",
    "webodf/editor/widgets/undoRedoMenu",
    "webodf/editor/widgets/toolbarWidgets/currentStyle",
    "webodf/editor/widgets/paragraphStylesDialog",
    "webodf/editor/widgets/imageInserter",
    "webodf/editor/widgets/zoomSlider"],
    function (ready, MenuItem, DropDownMenu, Button, DropDownButton, Toolbar, ParagraphAlignment, SimpleStyles, UndoRedoMenu, CurrentStyle, ParagraphStylesDialog, ImageInserter, ZoomSlider) {
        "use strict";

        return function Tools(args) {
            var translator = document.translator,
                onToolDone = args.onToolDone,
                loadOdtFile = args.loadOdtFile,
                saveOdtFile = args.saveOdtFile,
                close = args.close,
                toolbar,
                loadButton, saveButton, annotateButton, closeButton,
                formatDropDownMenu, formatMenuButton,
                paragraphStylesMenuItem, paragraphStylesDialog, simpleStyles, currentStyle,
                zoomSlider,
                undoRedoMenu,
                editorSession,
                paragraphAlignment,
                imageInserter,
                sessionSubscribers = [];

            function setEditorSession(session) {
                editorSession = session;
                sessionSubscribers.forEach(function (subscriber) {
                    subscriber.setEditorSession(editorSession);
                });
            }

            this.setEditorSession = setEditorSession;

            /**
             * @param {!function(!Object=)} callback, passing an error object in case of error
             * @return {undefined}
             */
            this.destroy = function (callback) {
                // TODO: investigate what else needs to be done
                toolbar.destroyRecursive(true);
                callback();
            };

            // init
            ready(function () {
                toolbar = new Toolbar({}, "toolbar");

                // Undo/Redo
                if (args.undoRedoEnabled) {
                    undoRedoMenu = new UndoRedoMenu(function (widget) {
                        widget.placeAt(toolbar);
                        widget.startup();
                    });
                    sessionSubscribers.push(undoRedoMenu);
                }

                // Add annotation
                if (args.annotationsEnabled) {
                    annotateButton = new Button({
                        label: translator('annotate'),
                        showLabel: false,
                        iconClass: 'dijitIconBookmark',
                        onClick: function () {
                            if (editorSession) {
                                editorSession.addAnnotation();
                                onToolDone();
                            }
                        }
                    });
                    annotateButton.placeAt(toolbar);
                }

                // Simple Style Selector [B, I, U, S]
                if (args.directStylingEnabled) {
                    simpleStyles = new SimpleStyles(function (widget) {
                        widget.placeAt(toolbar);
                        widget.startup();
                    });
                    sessionSubscribers.push(simpleStyles);
                    simpleStyles.onToolDone = onToolDone;
                }

                // Paragraph direct alignment buttons
                if (args.directStylingEnabled) {
                    paragraphAlignment = new ParagraphAlignment(function (widget) {
                        widget.placeAt(toolbar);
                        widget.startup();
                    });
                    sessionSubscribers.push(paragraphAlignment);
                    paragraphAlignment.onToolDone = onToolDone;
                }


                // Paragraph Style Selector
                currentStyle = new CurrentStyle(function (widget) {
                    widget.placeAt(toolbar);
                    widget.startup();
                });
                sessionSubscribers.push(currentStyle);
                currentStyle.onToolDone = onToolDone;

                // Zoom Level Selector
                zoomSlider = new ZoomSlider(function (widget) {
                    widget.placeAt(toolbar);
                    widget.startup();
                });
                sessionSubscribers.push(zoomSlider);
                zoomSlider.onToolDone = onToolDone;

                // Load
                if (loadOdtFile) {
                    loadButton = new Button({
                        label: translator('open'),
                        showLabel: false,
                        iconClass: 'dijitIcon dijitIconFolderOpen',
                        style: {
                            float: 'left'
                        },
                        onClick: function () {
                            loadOdtFile();
                        }
                    });
                    loadButton.placeAt(toolbar);
                }

                // Save
                if (saveOdtFile) {
                    saveButton = new Button({
                        label: translator('save'),
                        showLabel: false,
                        iconClass: 'dijitEditorIcon dijitEditorIconSave',
                        style: {
                            float: 'left'
                        },
                        onClick: function () {
                            saveOdtFile();
                            onToolDone();
                        }
                    });
                    saveButton.placeAt(toolbar);
                }

                // Format menu
                formatDropDownMenu = new DropDownMenu({});
                paragraphStylesMenuItem = new MenuItem({
                    label: translator("paragraph_DDD")
                });
                formatDropDownMenu.addChild(paragraphStylesMenuItem);

                paragraphStylesDialog = new ParagraphStylesDialog(function (dialog) {
                    paragraphStylesMenuItem.onClick = function () {
                        if (editorSession) {
                            dialog.startup();
                            dialog.show();
                        }
                    };
                });
                sessionSubscribers.push(paragraphStylesDialog);
                paragraphStylesDialog.onToolDone = onToolDone;

                if (args.imageInsertingEnabled) {
                    imageInserter = new ImageInserter(function (widget) {
                        widget.placeAt(toolbar);
                        widget.startup();
                    });
                    sessionSubscribers.push(imageInserter);
                    imageInserter.onToolDone = onToolDone;
                }

                formatMenuButton = new DropDownButton({
                    dropDown: formatDropDownMenu,
                    label: translator('format'),
                    iconClass: "dijitIconEditTask",
                    style: {
                        float: 'left'
                    }
                });
                formatMenuButton.placeAt(toolbar);

                if (close) {
                    closeButton = new Button({
                        label: translator('close'),
                        showLabel: false,
                        iconClass: 'dijitEditorIcon dijitEditorIconCancel',
                        style: {
                            float: 'right'
                        },
                        onClick: function () {
                            close();
                        }
                    });
                    closeButton.placeAt(toolbar);
                }

                setEditorSession(editorSession);
            });
        };

    });
