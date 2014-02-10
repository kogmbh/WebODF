/**
 * Copyright (C) 2012 KO GmbH <jos.van.den.oever@kogmbh.com>
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
/*global core, ops, gui, runtime*/

/**
 * @class
 * A cursor is a dom node that visually represents a cursor in a DOM tree.
 * It should stay synchronized with the selection in the document. When
 * there is only one collapsed selection range, a cursor should be shown at
 * that point.
 *
 * Putting the cursor in the DOM tree modifies the DOM, so care should be taken
 * to keep the selection consistent. If e.g. a selection is drawn over the
 * cursor, and the cursor is updated to the selection, the cursor is removed
 * from the DOM because the selection is not collapsed. This means that the
 * offsets of the selection may have to be changed.
 *
 * When the selection is collapsed, the cursor is placed after the point of the
 * selection and the selection will stay valid. However, if the cursor was
 * placed in the DOM tree and was counted in the offset, the offset in the
 * selection should be decreased by one.
 *
 * Even when the selection allows for a cursor, it might be desireable to hide
 * the cursor by not letting it be part of the DOM.
 *
 * @constructor
 * @param {!string} memberId The memberid this cursor is assigned to
 * @param {!ops.Document} document The document in which the cursor is placed
 */
ops.OdtCursor = function OdtCursor(memberId, document) {
    "use strict";
    var self = this,
        validSelectionTypes = {},
        selectionType,
        /**@type{!gui.SelectionMover}*/
        selectionMover,
        /**@type{!core.Cursor}*/
        cursor,
        events = new core.EventNotifier([ops.OdtCursor.signalCursorUpdated]);

    /**
     * Remove the cursor from the document
     * @return {undefined}
     */
    this.removeFromDocument = function () {
        // TODO: find out if nodeAfterCursor, textNodeIncrease need to be dealt with in any way
        cursor.remove();
    };

    /**
     * Subscribe to cursor update events.
     *
     * The update event called whenever the cursor is moved around manually.
     * @param {!string} eventid
     * @param {!Function} cb
     */
    this.subscribe = function (eventid, cb) {
        events.subscribe(eventid, cb);
    };

    /**
     * Unsubscribe from cursor events
     * @param {!string} eventid
     * @param {!Function} cb
     */
    this.unsubscribe = function (eventid, cb) {
        events.unsubscribe(eventid, cb);
    };

    /**
     * @return {!gui.StepCounter}
     */
    this.getStepCounter = function () {
        return selectionMover.getStepCounter();
    };
    /**
     * Obtain the memberid the cursor is assigned to.
     * @return {string}
     */
    this.getMemberId = function () {
        return memberId;
    };
    /**
     * Obtain the node representing the cursor.
     * @return {!Element}
     */
    this.getNode = function () {
        return cursor.getNode();
    };
    /**
     * Obtain the node representing the selection start point.
     * If a 0-length range is selected (e.g., by clicking without
     * dragging),, this will return the exact same node as getNode
     * @return {!Element}
     */
    this.getAnchorNode = function () {
        return cursor.getAnchorNode();
    };
    /**
     * Obtain the currently selected range to which the cursor corresponds.
     * @return {!Range}
     */
    this.getSelectedRange = function () {
        return cursor.getSelectedRange();
    };
    /** Set the given range as the selected range for this cursor
     * @param {!Range} range,
     * @param {boolean} isForwardSelection
     * @return {undefined}
     */
    this.setSelectedRange = function (range, isForwardSelection) {
        cursor.setSelectedRange(range, isForwardSelection);
        events.emit(ops.OdtCursor.signalCursorUpdated, self);
    };
    /**
     * Returns if the selection of this cursor has the
     * same direction as the direction of the range
     * @return {boolean}
     */
    this.hasForwardSelection = function () {
        return cursor.hasForwardSelection();
    };
    /**
     * Obtain the document to which the cursor corresponds.
     * @return {!ops.Document}
     */
    this.getDocument = function () {
        return document;
    };

    /**
     * Gets the current selection type.
     * @return {!string}
     */
    this.getSelectionType = function () {
        return selectionType;
    };

    /**
     * Sets the current selection type to the given value.
     * @param {!string} value
     * @return {undefined}
     */
    this.setSelectionType = function (value) {
        if (validSelectionTypes.hasOwnProperty(value)) {
            selectionType = value;
        } else {
            runtime.log("Invalid selection type: " + value);
        }
    };

    /**
     * Reset selection type to default.
     * @return {undefined}
     */
    this.resetSelectionType = function () {
        self.setSelectionType(ops.OdtCursor.RangeSelection);
    };

    function init() {
        cursor = new core.Cursor(document.getDOMDocument(), memberId);
        selectionMover = new gui.SelectionMover(cursor, document.getRootNode());

        validSelectionTypes[ops.OdtCursor.RangeSelection] = true;
        validSelectionTypes[ops.OdtCursor.RegionSelection] = true;
        self.resetSelectionType();
    }

    init();
};

/**@const
   @type {!string} */
ops.OdtCursor.RangeSelection = 'Range';
/**@const
   @type {!string} */
ops.OdtCursor.RegionSelection = 'Region';
/**@const
 @type {!string} */
ops.OdtCursor.signalCursorUpdated = "cursorUpdated";

(function () {
    "use strict";
    return ops.OdtCursor;
}());
