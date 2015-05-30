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

/*global gui, NodeFilter*/

/**
 * @constructor
 * @implements NodeFilter
 * @param {!Array.<!string>} excludedNamespaces
 */
gui.BlacklistNamespaceNodeFilter = function (excludedNamespaces) {
    "use strict";
    var /**@type{!Object.<!string, !boolean>}*/
        excludedNamespacesObj = {},
        FILTER_REJECT = NodeFilter.FILTER_REJECT,
        FILTER_ACCEPT = NodeFilter.FILTER_ACCEPT;

    /**
     * @param {?Node} node
     * @return {!number}
     */
    this.acceptNode = function (node) {
        if (!node || excludedNamespacesObj.hasOwnProperty(node.namespaceURI)) {
            return FILTER_REJECT;
        }
        return FILTER_ACCEPT;
    };

    function init() {
        excludedNamespaces.forEach(function(ns) {
            excludedNamespacesObj[ns] = true;
        });
    }
    init();
};
