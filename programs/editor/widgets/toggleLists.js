/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global define,require */

define("webodf/editor/widgets/toggleLists", [
        "dijit/form/ToggleButton",
        "webodf/editor/EditorSession"],

    function (ToggleButton, EditorSession) {
        "use strict";

        var ToggleLists = function (callback) {
            var self = this,
                editorSession,
                listController,
                widget = {},
                numberedList,
                bulletedList;

            numberedList = new ToggleButton({
                label: runtime.tr('Numbering'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconInsertOrderedList",
                onChange: function (checked) {
                    var success = listController.setNumberedList(checked);
                    //TODO: remove this when the list controller supports all use cases triggered by this button
                    if(!success) {
                        numberedList.set("checked", !checked, false);
                    }
                    self.onToolDone();
                }
            });

            bulletedList = new ToggleButton({
                label: runtime.tr('Bullets'),
                disabled: true,
                showLabel: false,
                checked: false,
                iconClass: "dijitEditorIcon dijitEditorIconInsertUnorderedList",
                onChange: function (checked) {
                    var success = listController.setBulletedList(checked);
                    //TODO: remove this when the list controller supports all use cases triggered by this button
                    if(!success) {
                        bulletedList.set("checked", !checked, false);
                    }
                    self.onToolDone();
                }
            });

            widget.children = [numberedList, bulletedList];

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

            function enableToggleButtons(isEnabled) {
                widget.children.forEach(function (element) {
                    element.setAttribute('disabled', !isEnabled);
                });
            }

            function updateToggleButtons(styleSummary) {
                bulletedList.set("checked", styleSummary.isBulletedList, false);
                numberedList.set("checked", styleSummary.isNumberedList, false);

            }

            this.onToolDone = function () {
            };

            this.setEditorSession = function (session) {
                if (editorSession) {
                    listController.unsubscribe(gui.ListController.listStylingChanged, updateToggleButtons);
                    listController.unsubscribe(gui.ListController.enabledChanged, enableToggleButtons);
                }

                editorSession = session;

                if (editorSession) {
                    listController = editorSession.sessionController.getListController();
                    listController.subscribe(gui.ListController.listStylingChanged, updateToggleButtons);
                    listController.subscribe(gui.ListController.enabledChanged, enableToggleButtons);
                    enableToggleButtons(listController.isEnabled());
                } else {
                    enableToggleButtons(false);
                }
            };

            callback(widget);
        };

        return ToggleLists;
    }
);