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

/*global define,require,document */

define("webodf/editor/widgets/simpleStyles", [
    "webodf/editor/widgets/fontPicker",
    "dijit/form/ToggleButton",
    "dijit/form/NumberSpinner"],

    function (FontPicker, ToggleButton, NumberSpinner) {
        "use strict";

        var SimpleStyles = function(callback) {
            var self = this,
                widget = {},
                directTextStyler,
                boldButton,
                italicButton,
                underlineButton,
                strikethroughButton,
                fontSizeSpinner,
                fontPicker,
                fontPickerWidget;

            boldButton = new ToggleButton({
                label: document.translator('bold'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconBold",
                onChange: function (checked) {
                    directTextStyler.setBold(checked);
                    self.onToolDone();
                }
            });

            italicButton = new ToggleButton({
                label: document.translator('italic'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconItalic",
                onChange: function (checked) {
                    directTextStyler.setItalic(checked);
                    self.onToolDone();
                }
            });

            underlineButton = new ToggleButton({
                label: document.translator('underline'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconUnderline",
                onChange: function (checked) {
                    directTextStyler.setHasUnderline(checked);
                    self.onToolDone();
                }
            });

            strikethroughButton = new ToggleButton({
                label: document.translator('strikethrough'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconStrikethrough",
                onChange: function (checked) {
                    directTextStyler.setHasStrikethrough(checked);
                    self.onToolDone();
                }
            });

            fontSizeSpinner = new NumberSpinner({
                label: document.translator('size'),
                disabled: true,
                showLabel: false,
                value: 12,
                smallDelta: 1,
                constraints: {min:6, max:96},
                intermediateChanges: true,
                onChange: function (value) {
                    directTextStyler.setFontSize(value);
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
                directTextStyler.setFontName(value);
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

            this.setEditorSession = function(session) {
                if (directTextStyler) {
                    directTextStyler.unsubscribe(gui.DirectTextStyler.textStylingChanged, updateStyleButtons);
                }
                directTextStyler = session && session.sessionController.getDirectTextStyler();
                fontPicker.setEditorSession(session);
                if (directTextStyler) {
                    directTextStyler.subscribe(gui.DirectTextStyler.textStylingChanged, updateStyleButtons);
                }
                widget.children.forEach(function (element) {
                    element.setAttribute('disabled', !directTextStyler);
                });
                updateStyleButtons({
                    isBold: directTextStyler ? directTextStyler.isBold() : false,
                    isItalic: directTextStyler ? directTextStyler.isItalic() : false,
                    hasUnderline: directTextStyler ? directTextStyler.hasUnderline() : false,
                    hasStrikeThrough: directTextStyler ? directTextStyler.hasStrikeThrough() : false,
                    fontSize: directTextStyler ? directTextStyler.fontSize() : undefined,
                    fontName: directTextStyler ? directTextStyler.fontName() : undefined
                });
            };

            this.onToolDone = function () {};

            callback(widget);
        };

        return SimpleStyles;
});
