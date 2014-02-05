/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
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

/*global runtime, core, gui, Node, ops, odf */

runtime.loadClass("odf.OdfUtils");

/**
 * @constructor
 * @param {!ops.Session} session
 * @param {!string} inputMemberId
 */
gui.HyperlinkController = function HyperlinkController(session, inputMemberId) {
    "use strict";

    var odfUtils = new odf.OdfUtils(),
        odtDocument = session.getOdtDocument();

    /**
     * Convert the current selection into a hyperlink
     * @param {!string} hyperlink Hyperlink to insert
     * @param {!string=} insertionText Optional text to insert as the text content for the hyperlink.
     *  Note, the insertion text will not replace the existing selection content.
     */
    function addHyperlink(hyperlink, insertionText) {
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
        var iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
            selectedRange = odtDocument.getCursor(inputMemberId).getSelectedRange(),
            links = odfUtils.getHyperlinkElements(selectedRange),
            removeEntireLink = selectedRange.collapsed && links.length === 1,
            domRange = odtDocument.getDOMDocument().createRange(),
            operations = [],
            cursorRange, firstLink, lastLink, offset, op;

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
                    op.init({
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
                    op.init({
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
};
