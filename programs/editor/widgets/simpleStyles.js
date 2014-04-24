/**
 * @license
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
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

/*global define,require,gui,ops */

define("webodf/editor/widgets/simpleStyles", [
    "webodf/editor/widgets/fontPicker",
    "dijit/form/ToggleButton",
    "dijit/form/NumberSpinner",
    "webodf/editor/EditorSession"],

    function (FontPicker, ToggleButton, NumberSpinner, EditorSession) {
        "use strict";

        var SimpleStyles = function(callback) {
            var self = this,
                editorSession,
                widget = {},
                formattingController,
                boldButton,
                italicButton,
                underlineButton,
                strikethroughButton,
                fontSizeSpinner,
                fontPicker,
                fontPickerWidget;

            boldButton = new ToggleButton({
                label: runtime.tr('Bold'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconBold",
                onChange: function (checked) {
                    formattingController.setBold(checked);
                    self.onToolDone();
                }
            });

            italicButton = new ToggleButton({
                label: runtime.tr('Italic'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconItalic",
                onChange: function (checked) {
                    formattingController.setItalic(checked);
                    self.onToolDone();
                }
            });

            underlineButton = new ToggleButton({
                label: runtime.tr('Underline'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconUnderline",
                onChange: function (checked) {
                    formattingController.setHasUnderline(checked);
                    self.onToolDone();
                }
            });

            strikethroughButton = new ToggleButton({
                label: runtime.tr('Strikethrough'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconStrikethrough",
                onChange: function (checked) {
                    formattingController.setHasStrikethrough(checked);
                    self.onToolDone();
                }
            });

            fontSizeSpinner = new NumberSpinner({
                label: runtime.tr('Size'),
                disabled: true,
                showLabel: false,
                value: 12,
                smallDelta: 1,
                constraints: {min:6, max:96},
                intermediateChanges: true,
                onChange: function (value) {
                    formattingController.setFontSize(value);
                },
                onClick: function () {
                    self.onToolDone();
                },
                onInput: function () {
                    // Do not process any input in the text box;
                    // even paste events will not be processed
                    // so that no corrupt values can exist
                    return false;
                }
            });

            fontPicker = new FontPicker(function () {});
            fontPickerWidget = fontPicker.widget();
            fontPickerWidget.setAttribute('disabled', true);
            fontPickerWidget.onChange = function(value) {
                formattingController.setFontName(value);
                self.onToolDone();
            };

            widget.children = [boldButton, italicButton, underlineButton, strikethroughButton, fontPickerWidget, fontSizeSpinner];
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
                // The 3rd parameter to set(...) is false to avoid firing onChange when setting the value programmatically.
                var updateCalls = {
                    isBold: function(value) { boldButton.set('checked', value, false); },
                    isItalic: function(value) { italicButton.set('checked', value, false); },
                    hasUnderline: function(value) { underlineButton.set('checked', value, false); },
                    hasStrikeThrough: function(value) { strikethroughButton.set('checked', value, false); },
                    fontSize: function(value) { 
                        fontSizeSpinner.set('intermediateChanges', false); // Necessary due to https://bugs.dojotoolkit.org/ticket/11588
                        fontSizeSpinner.set('value', value, false);
                        fontSizeSpinner.set('intermediateChanges', true);
                    },
                    fontName: function(value) { fontPickerWidget.set('value', value, false); }
                };

                Object.keys(changes).forEach(function (key) {
                    var updateCall = updateCalls[key];
                    if (updateCall) {
                        updateCall(changes[key]);
                    }
                });
            }

            function handleCursorMoved(cursor) {
                var disabled = cursor.getSelectionType() === ops.OdtCursor.RegionSelection;
                widget.children.forEach(function (element) {
                    element.setAttribute('disabled', disabled);
                });
            }

            this.setEditorSession = function(session) {
                if (formattingController) {
                    formattingController.unsubscribe(gui.FormattingController.textStylingChanged, updateStyleButtons);
                }
                formattingController = session && session.sessionController.getFormattingController();
                fontPicker.setEditorSession(session);
                if (formattingController) {
                    formattingController.subscribe(gui.FormattingController.textStylingChanged, updateStyleButtons);
                }
                widget.children.forEach(function (element) {
                    element.setAttribute('disabled', !formattingController);
                });
                updateStyleButtons({
                    isBold: formattingController ? formattingController.isBold() : false,
                    isItalic: formattingController ? formattingController.isItalic() : false,
                    hasUnderline: formattingController ? formattingController.hasUnderline() : false,
                    hasStrikeThrough: formattingController ? formattingController.hasStrikeThrough() : false,
                    fontSize: formattingController ? formattingController.fontSize() : undefined,
                    fontName: formattingController ? formattingController.fontName() : undefined
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

        return SimpleStyles;
});
