/**
 * @license
 * Copyright (C) 2012 KO GmbH <aditya.bhatt@kogmbh.com>
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

/*global core, ops, runtime*/

/**
 * @constructor
 * @param {!Element} container
 * @param {!ops.OdtDocument} odtDocument
 */
ops.EditInfo = function EditInfo(container, odtDocument) {
    "use strict";
    var /**@type {Element}*/
        editInfoNode,
        /**@type {!Object.<string,{time:Date}>}*/
        editHistory = {};

    /**
     * @return {!Array.<{memberid:string,time:Date}>}
     */
    function sortEdits() {
        var /**@type {!Array.<{memberid:string,time:Date}>}*/
            arr = [],
            memberid;
        for (memberid in editHistory) {
            if (editHistory.hasOwnProperty(memberid)) {
                arr.push({
                    'memberid': memberid,
                    'time': editHistory[memberid].time
                });
            }
        }

        arr.sort(function (a, b) {
            return a.time - b.time;
        });

        return arr;
    }

    /**
     * @return {Element}
     */
    this.getNode = function () {
        return editInfoNode;
    };

    /**
     * @return {!ops.OdtDocument}
     */
    this.getOdtDocument = function () {
        return odtDocument;
    };

    /**
     * @return {!Object.<string,{time:Date}>}
     */
    this.getEdits = function () {
        return editHistory;
    };

    /**
     * Returns the sorted list of memberid/time pairs, with oldest first.
     * @return {!Array.<{memberid:string,time:Date}>}
     */
    this.getSortedEdits = function () {
        return sortEdits();
    };

    /**
     * @param {!string} memberid
     * @param {!Date} timestamp
     * @return {undefined}
     */
    this.addEdit = function (memberid, timestamp) {
        // log the edit time for this memberid
        editHistory[memberid] = {
            time: timestamp
        };
    };

    /**
     * @return {undefined}
     */
    this.clearEdits = function () {
        editHistory = {};
    };

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function(callback) {
        // TODO: have EditInfo cleaned up if the paragraph is deleted, not happening right now
        // workaround: check if the container is still in the DOM
        if (container.parentNode) {
            container.removeChild(editInfoNode);
        }
        callback();
    };

    function init() {
        var editInfons = 'urn:webodf:names:editinfo',
            dom = odtDocument.getDOMDocument();

        editInfoNode = dom.createElementNS(editInfons, 'editinfo');
        container.insertBefore(editInfoNode, container.firstChild);
    }

    init();
};
