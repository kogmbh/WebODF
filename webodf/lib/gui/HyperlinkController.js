/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, core, gui, Node, ops, odf */

/**
 * WARNING: do not use, currently there are at least the issues #490 and #650 (see github issue tracker)
 * @constructor
 * @implements {core.Destroyable}
 * @param {!ops.Session} session
 * @param {!gui.SessionConstraints} sessionConstraints
 * @param {!gui.SessionContext} sessionContext
 * @param {!string} inputMemberId
 */
gui.HyperlinkController = function HyperlinkController(
    session,
    sessionConstraints,
    sessionContext,
    inputMemberId
    ) {
    "use strict";

    var odfUtils = new odf.OdfUtils(),
        odtDocument = session.getOdtDocument(),
        eventNotifier = new core.EventNotifier([
            gui.HyperlinkController.enabledChanged
        ]),
        isEnabled = false;

    /**
     * @return {undefined}
     */
    function updateEnabledState() {
        var /**@type{!boolean}*/newIsEnabled = true;

        if (sessionConstraints.getState(gui.CommonConstraints.EDIT.REVIEW_MODE) === true) {
            newIsEnabled = /**@type{!boolean}*/(sessionContext.isLocalCursorWithinOwnAnnotation());
        }

        if (newIsEnabled !== isEnabled) {
            isEnabled = newIsEnabled;
            eventNotifier.emit(gui.HyperlinkController.enabledChanged, isEnabled);
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorEvent(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updateEnabledState();
        }
    }

    /**
     * @return {!boolean}
     */
    this.isEnabled = function () {
        return isEnabled;
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function (eventid, cb) {
        eventNotifier.subscribe(eventid, cb);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function (eventid, cb) {
        eventNotifier.unsubscribe(eventid, cb);
    };

    /**
     * Convert the current selection into a hyperlink
     * @param {!string} hyperlink Hyperlink to insert
     * @param {!string=} insertionText Optional text to insert as the text content for the hyperlink.
     *  Note, the insertion text will not replace the existing selection content.
     */
    function addHyperlink(hyperlink, insertionText) {
        if (!isEnabled) {
            return;
        }
        var selection = odtDocument.getCursorSelection(inputMemberId),
            op = new ops.OpApplyHyperlink(),
            operations = [];

        if (selection.length === 0 || insertionText) {
            insertionText = insertionText || hyperlink;
            op = new ops.OpInsertText();
            op.init({
                memberid: inputMemberId,
                position: selection.position,
                text: insertionText
            });
            selection.length = insertionText.length;
            operations.push(op);
        }

        op = new ops.OpApplyHyperlink();
        op.init({
            memberid: inputMemberId,
            position: selection.position,
            length: selection.length,
            hyperlink: hyperlink
        });
        operations.push(op);
        session.enqueue(operations);
    }
    this.addHyperlink = addHyperlink;

    /**
     * Remove all hyperlinks within the current selection. If a range of text is selected,
     * this will only unlink the selection. If the current selection is collapsed within a
     * link, that entire link will be removed.
     */
    function removeHyperlinks() {
        if (!isEnabled) {
            return;
        }

        var iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
            selectedRange = odtDocument.getCursor(inputMemberId).getSelectedRange(),
            links = odfUtils.getHyperlinkElements(selectedRange),
            removeEntireLink = selectedRange.collapsed && links.length === 1,
            domRange = odtDocument.getDOMDocument().createRange(),
            operations = [],
            /**@type{{position: !number, length: number}}*/
            cursorRange,
            firstLink, lastLink, offset, op;

        if (links.length === 0) {
            return;
        }

        // Remove any links that overlap with the current selection
        links.forEach(function (link) {
            domRange.selectNodeContents(link);
            cursorRange = odtDocument.convertDomToCursorRange({
                anchorNode: /**@type{!Node}*/(domRange.startContainer),
                anchorOffset: domRange.startOffset,
                focusNode: /**@type{!Node}*/(domRange.endContainer),
                focusOffset: domRange.endOffset
            });
            op = new ops.OpRemoveHyperlink();
            op.init({
                memberid: inputMemberId,
                position: cursorRange.position,
                length: cursorRange.length
            });
            operations.push(op);
        });

        if (!removeEntireLink) {
            // Re-add any leading or trailing links that were only partially selected
            firstLink = /**@type{!Element}*/(links[0]);
            if (selectedRange.comparePoint(firstLink, 0) === -1) {
                domRange.setStart(firstLink, 0);
                domRange.setEnd(selectedRange.startContainer, selectedRange.startOffset);
                cursorRange = odtDocument.convertDomToCursorRange({
                    anchorNode: /**@type{!Node}*/(domRange.startContainer),
                    anchorOffset: domRange.startOffset,
                    focusNode: /**@type{!Node}*/(domRange.endContainer),
                    focusOffset: domRange.endOffset
                });
                if (cursorRange.length > 0) {
                    op = new ops.OpApplyHyperlink();
                    /**@type{!ops.OpApplyHyperlink}*/(op).init({
                        memberid: inputMemberId,
                        position: cursorRange.position,
                        length: cursorRange.length,
                        hyperlink: odfUtils.getHyperlinkTarget(firstLink)
                    });
                    operations.push(op);
                }
            }
            lastLink = /**@type{!Element}*/(links[links.length - 1]);
            iterator.moveToEndOfNode(lastLink);
            offset = iterator.unfilteredDomOffset();
            if (selectedRange.comparePoint(lastLink, offset) === 1) {
                domRange.setStart(selectedRange.endContainer, selectedRange.endOffset);
                domRange.setEnd(lastLink, offset);
                cursorRange = odtDocument.convertDomToCursorRange({
                    anchorNode: /**@type{!Node}*/(domRange.startContainer),
                    anchorOffset: domRange.startOffset,
                    focusNode: /**@type{!Node}*/(domRange.endContainer),
                    focusOffset: domRange.endOffset
                });
                if (cursorRange.length > 0) {
                    op = new ops.OpApplyHyperlink();
                    /**@type{!ops.OpApplyHyperlink}*/(op).init({
                        memberid: inputMemberId,
                        position: cursorRange.position,
                        length: cursorRange.length,
                        hyperlink: odfUtils.getHyperlinkTarget(lastLink)
                    });
                    operations.push(op);
                }
            }
        }

        session.enqueue(operations);
        domRange.detach();
    }
    this.removeHyperlinks = removeHyperlinks;

    /**
     * @param {!function(!Error=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
        odtDocument.unsubscribe(ops.Document.signalCursorMoved, onCursorEvent);
        sessionConstraints.unsubscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        callback();
    };

    function init() {
        odtDocument.subscribe(ops.Document.signalCursorMoved, onCursorEvent);
        sessionConstraints.subscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        updateEnabledState();
    }
    init();
};

/**@const*/gui.HyperlinkController.enabledChanged = "enabled/changed";
