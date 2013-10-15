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
/*global core, ops, gui, runtime*/
runtime.loadClass("core.Cursor");
runtime.loadClass("gui.SelectionMover");

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
 * @param {!ops.OdtDocument} odtDocument The document in which the cursor is placed
 */
ops.OdtCursor = function OdtCursor(memberId, odtDocument) {
    "use strict";
    var self = this,
        /**@type{gui.SelectionMover}*/
        selectionMover,
        cursor;

    /**
     * Remove the cursor from the odt document
     * @return {undefined}
     */
    this.removeFromOdtDocument = function () {
        // TODO: find out if nodeAfterCursor, textNodeIncrease need to be dealt with in any way
        cursor.remove();
    };

    /**
     * @param {!number} number
     * @param {boolean=} extend true if range is to be expanded from the current
     *                      point
     * @return {!number}
     */
    this.move = function (number, extend) {
        var moved = 0;
        if (number > 0) {
            moved = selectionMover.movePointForward(number, extend);
        } else if (number <= 0) {
            moved = -selectionMover.movePointBackward(-number, extend);
        }
        self.handleUpdate();
        return moved;
    };

/*jslint emptyblock: true*/
    /**
     * Is called whenever the cursor is moved around manually.
     * Set this property to another function that should be called,
     * e.g. the UI avatar/caret to reset focus.
     * Ideally would be a signal, but this works for now.
     */
    this.handleUpdate = function () {
    };
/*jslint emptyblock: false*/
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
     * @returns {!Element}
     */
    this.getAnchorNode = function() {
        return cursor.getAnchorNode();
    };
    /**
     * Obtain the currently selected range to which the cursor corresponds.
     * @return {Range}
     */
    this.getSelectedRange = function () {
        return cursor.getSelectedRange();
    };
    /**
     * Returns if the selection of this cursor has the
     * same direction as the direction of the range
     * @return {boolean}
     */
    this.hasForwardSelection = function() {
        return cursor.hasForwardSelection();
    };
    /**
     * Obtain the odtDocument to which the cursor corresponds.
     * @return {!ops.OdtDocument}
     */
    this.getOdtDocument = function () {
        return odtDocument;
    };

    function init() {
        cursor = new core.Cursor(odtDocument.getDOM(), memberId);
        selectionMover = new gui.SelectionMover(cursor, odtDocument.getRootNode());
    }

    init();
};
