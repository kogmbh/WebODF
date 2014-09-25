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

/*global runtime, odf, gui*/

/**
 * This finds a text:list element containing the given node and then
 * determines the type of list based on its list style
 *
 * @param {?Element} node
 * @param {!Element} rootNode
 * @param {!odf.Formatting} formatting
 * @constructor
 */
gui.ListStyleSummary = function ListStyleSummary(node, rootNode, formatting) {
    "use strict";

    var self = this,
        odfUtils = odf.OdfUtils;

    /**
     * @type {!boolean}
     */
    this.isNumberedList = false;

    /**
     * @type {!boolean}
     */
    this.isBulletedList = false;

    /**
     * @param {!Element} node
     * @return {?Element}
     */
    function getListStyleElementAtNode(node) {
        var appliedStyles,
            filteredStyles,
            listStyleName,
            listStyleElement = null;

        // find the styles applied on this node and search for any list styles
        appliedStyles = formatting.getAppliedStyles([node]);
        if (appliedStyles[0]) {
            filteredStyles = appliedStyles[0].orderedStyles.filter(function (style) {
                return style.family === "list-style";
            });

            listStyleName = filteredStyles[0] && filteredStyles[0].name;
        }

        if(listStyleName) {
            listStyleElement = formatting.getStyleElement(listStyleName, "list-style");
        }

        return listStyleElement;
    }

    /**
     * @param {!Element} node
     * @return {!number}
     */
    function getListLevelAtNode(node) {
        var listLevel = 0,
            currentNode = node;

        // find the text:list element that contains the given node
        // and then find the highest text:list element in this DOM hierarchy
        while (currentNode) {
            if (odfUtils.isListElement(currentNode)) {
                listLevel += 1;
            }

            if (currentNode === rootNode) {
                break;
            }
            currentNode = currentNode.parentNode;
        }

        return listLevel;
    }

    /**
     * @return {undefined}
     */
    function init() {
        var listLevelAtNode,
            currentListStyleElement,
            textLevelAttribute;

        if(!node) {
            return;
        }

        // find the depth of the list at the node and then find the matching level
        // in the list style applied to that node to determine type of list
        listLevelAtNode = getListLevelAtNode(node);
        currentListStyleElement = getListStyleElementAtNode(node);
        currentListStyleElement = currentListStyleElement && currentListStyleElement.firstElementChild;

        while (currentListStyleElement) {
            textLevelAttribute = currentListStyleElement.getAttributeNS(odf.Namespaces.textns, "level");

            if (textLevelAttribute) {
                textLevelAttribute = parseInt(textLevelAttribute, 10);
                if (textLevelAttribute === listLevelAtNode) {
                    self.isBulletedList = currentListStyleElement.localName === "list-level-style-bullet";
                    self.isNumberedList = currentListStyleElement.localName === "list-level-style-number";
                }
            }
            currentListStyleElement = currentListStyleElement.nextElementSibling;
        }
    }

    init();
};