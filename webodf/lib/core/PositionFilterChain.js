/**
 * Copyright (C) 2013 KO GmbH <aditya.bhatt@kogmbh.com>
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
/*global runtime, core*/
/*jslint emptyblock: true, unparam: true*/
runtime.loadClass("core.PositionFilter");
/**
 * A structure that acts like a filter for all purposes,
 * and also can be combined with other instances of it's own kind or other filters.
 * @constructor
 * @implements {core.PositionFilter}
 */
core.PositionFilterChain = function PositionFilterChain() {
    "use strict";

    var /**@type{!Object.<!string,!core.PositionFilter|!core.PositionFilterChain>}*/
        filterChain = {},
        /**@const*/
        FILTER_ACCEPT = core.PositionFilter.FilterResult.FILTER_ACCEPT,
        /**@const*/
        FILTER_REJECT  = core.PositionFilter.FilterResult.FILTER_REJECT;

    /**
     * Returns accept if all filters in the chain accept the position, else reject.
     * @param {!core.PositionIterator} iterator
     * @return {!core.PositionFilter.FilterResult}
     */
    this.acceptPosition = function (iterator) {
        var /**@type{!string}*/
            filterName;
        for (filterName in filterChain) {
            if (filterChain.hasOwnProperty(filterName)) {
                if (filterChain[filterName].acceptPosition(iterator) === FILTER_REJECT) {
                    return FILTER_REJECT;
                }
            }
        }
        return FILTER_ACCEPT;
    };

    /**
     * Adds a filter with a given name and an instance of it to the filter chain.
     * If a filter with the filterName already exists, it will be overwritten.
     * @param {!string} filterName
     * @param {!core.PositionFilter|!core.PositionFilterChain} filterInstance
     * @return {undefined}
     */
    this.addFilter = function (filterName, filterInstance) {
        filterChain[filterName] = filterInstance;
    };

    /**
     * Removes the instance of the filter with the given name
     * @param {!string} filterName
     * @return {undefined}
     */
    this.removeFilter = function (filterName) {
        delete filterChain[filterName];
    };

};
