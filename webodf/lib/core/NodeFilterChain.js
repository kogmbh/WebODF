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

/*global core, NodeFilter*/

/**
 * @constructor
 * @implements NodeFilter
 * @param {!Array.<!NodeFilter>} filters
 */
core.NodeFilterChain = function (filters) {
    "use strict";
    var FILTER_REJECT = NodeFilter.FILTER_REJECT,
        FILTER_ACCEPT = NodeFilter.FILTER_ACCEPT;

    /**
     * @param {!Node} node
     * @return {!number}
     */
    this.acceptNode = function (node) {
        var i;
        for (i = 0; i < filters.length; i += 1) {
            if (filters[i].acceptNode(node) === FILTER_REJECT) {
                return FILTER_REJECT;
            }
        }
        return FILTER_ACCEPT;
    };
};
