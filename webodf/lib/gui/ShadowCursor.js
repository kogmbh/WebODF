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
/*global core, gui, ops, runtime*/

runtime.loadClass("gui.SelectionMover");

/**
 * @class
 * The ShadowCursor class provides a very minimal OdtCursor-like interface.
 * It does not insert anything into the DOM, and is useful mainly for
 * simulating a Cursor when you cannot/should not use a real cursor.
 * 
 * @constructor
 * @param {!string} memberId
 * @param {!ops.OdtDocument} odtDocument
 */
gui.ShadowCursor = function ShadowCursor(memberId, odtDocument) {
    "use strict";
    var selectedRange = odtDocument.getDOM().createRange(),
        forwardSelection = true;

    /*jslint emptyblock: true*/
    this.removeFromOdtDocument = function () {};
    /*jslint emptyblock: false*/

    /**
     * Obtain the memberid the cursor is assigned to.
     * @return {string}
     */
    this.getMemberId = function () {
        return memberId;
    };

    /**
     * Obtain the currently selected range to which the cursor corresponds.
     * @return {Range}
     */
    this.getSelectedRange = function () {
        return selectedRange;
    };

    /**
     * Set the given range as the selected range for this cursor
     * @param {!Range} range,
     * @param {boolean=} isForwardSelection Assumed to be true by default
     * @return {undefined}
     */
    this.setSelectedRange = function (range, isForwardSelection) {
        selectedRange = range;
        forwardSelection = isForwardSelection !== false;
    };

    /**
     * Returns if the selection of this cursor has the
     * same direction as the direction of the range
     * @return {boolean}
     */
    this.hasForwardSelection = function () {
        return forwardSelection;
    };

    /**
     * Obtain the odtDocument to which the cursor corresponds.
     * @return {!ops.OdtDocument}
     */
    this.getOdtDocument = function () {
        return odtDocument;
    };

    function init() {
        selectedRange.setStart(odtDocument.getRootNode(), 0);
    }
    init();
};
