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

/*global define,require,document,ops,gui */

define("webodf/editor/widgets/paragraphAlignment", [
    "dijit/form/ToggleButton",
    "dijit/form/Button",
    "webodf/editor/EditorSession"],

    function (ToggleButton, Button, EditorSession) {
        "use strict";

        var ParagraphAlignment = function (callback) {
            var self = this,
                editorSession,
                widget = {},
                directParagraphStyler,
                justifyLeft,
                justifyCenter,
                justifyRight,
                justifyFull,
                indent,
                outdent;

            justifyLeft = new ToggleButton({
                label: document.translator('justifyLeft'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconJustifyLeft",
                onChange: function () {
                    directParagraphStyler.alignParagraphLeft();
                    self.onToolDone();
                }
            });

            justifyCenter = new ToggleButton({
                label: document.translator('justifyCenter'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconJustifyCenter",
                onChange: function () {
                    directParagraphStyler.alignParagraphCenter();
                    self.onToolDone();
                }
            });

            justifyRight = new ToggleButton({
                label: document.translator('justifyRight'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconJustifyRight",
                onChange: function () {
                    directParagraphStyler.alignParagraphRight();
                    self.onToolDone();
                }
            });

            justifyFull = new ToggleButton({
                label: document.translator('justifyFull'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconJustifyFull",
                onChange: function () {
                    directParagraphStyler.alignParagraphJustified();
                    self.onToolDone();
                }
            });

            outdent = new Button({
                label: document.translator('outdent'),
                disabled: true,
                showLabel: false,
                iconClass: "dijitEditorIcon dijitEditorIconOutdent",
                onClick: function () {
                    directParagraphStyler.outdent();
                    self.onToolDone();
                }
            });

            indent = new Button({
                label: document.translator('indent'),
                disabled: true,
                showLabel: false,
                iconClass: "dijitEditorIcon dijitEditorIconIndent",
                onClick: function () {
                    directParagraphStyler.indent();
                    self.onToolDone();
                }
            });

            widget.children = [justifyLeft,
                justifyCenter,
                justifyRight,
                justifyFull,
                outdent,
                indent
            ];

            widget.startup = function () {
                widget.children.forEach(function (element) {
                    element.startup();
                });
            };

            widget.placeAt = function (container) {
                widget.children.forEach(function (element) {
                    element.placeAt(container);
                });
                return widget;
            };

            function updateStyleButtons(changes) {
                var buttons = {
                    isAlignedLeft: justifyLeft,
                    isAlignedCenter: justifyCenter,
                    isAlignedRight: justifyRight,
                    isAlignedJustified: justifyFull
                };

                Object.keys(changes).forEach(function (key) {
                    var button = buttons[key];
                    if (button) {
                        // The 3rd parameter to set(...) is false to avoid firing onChange when setting the value programmatically.
                        button.set('checked', changes[key], false);
                    }
                });
            }

            function handleCursorMoved(cursor) {
                var disabled = cursor.getSelectionType() === ops.OdtCursor.RegionSelection;
                widget.children.forEach(function (element) {
                    element.setAttribute('disabled', disabled);
                });
            }

            this.setEditorSession = function (session) {
                if (directParagraphStyler) {
                    directParagraphStyler.unsubscribe(gui.DirectParagraphStyler.paragraphStylingChanged, updateStyleButtons);
                }
                directParagraphStyler = session && session.sessionController.getDirectParagraphStyler();
                if (directParagraphStyler) {
                    directParagraphStyler.subscribe(gui.DirectParagraphStyler.paragraphStylingChanged, updateStyleButtons);
                }
                widget.children.forEach(function (element) {
                    element.setAttribute('disabled', !directParagraphStyler);
                });
                updateStyleButtons({
                    isAlignedLeft:      directParagraphStyler ? directParagraphStyler.isAlignedLeft() :      false,
                    isAlignedCenter:    directParagraphStyler ? directParagraphStyler.isAlignedCenter() :    false,
                    isAlignedRight:     directParagraphStyler ? directParagraphStyler.isAlignedRight() :     false,
                    isAlignedJustified: directParagraphStyler ? directParagraphStyler.isAlignedJustified() : false
                });

                if (editorSession) {
                    editorSession.unsubscribe(EditorSession.signalCursorMoved, handleCursorMoved);
                }
                editorSession = session;
                if (editorSession) {
                    editorSession.subscribe(EditorSession.signalCursorMoved, handleCursorMoved);
                }
            };

            this.onToolDone = function () {};

            callback(widget);
        };

        return ParagraphAlignment;
});
