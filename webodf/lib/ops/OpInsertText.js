/**
 * @license
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
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

/*global ops*/

/**
 * This operation inserts the given text
 * at the specified position, and if
 * the moveCursor flag is specified and
 * is set as true, moves the cursor to
 * the end of the inserted text.
 * Otherwise, the cursor remains at the
 * same position as before.
 * @constructor
 * @implements ops.Operation
 */
ops.OpInsertText = function OpInsertText() {
    "use strict";

    var space = " ",
        tab = "\t",
        memberid, timestamp, position, text, moveCursor;

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        text = data.text;
        moveCursor = data.moveCursor === 'true' || data.moveCursor === true;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * This is a workaround for a bug where webkit forgets to relayout
     * the text when a new character is inserted at the beginning of a line in
     * a Text Node.
     * @param {!Node} textNode
     * @return {undefined}
     */
    function triggerLayoutInWebkit(textNode) {
        var parent = textNode.parentNode,
            next = textNode.nextSibling;

        parent.removeChild(textNode);
        parent.insertBefore(textNode, next);
    }

    /**
     * Returns true if the particular character in the text string is a space character that is immediately
     * preceded by another space character (or is the first or last space in the text block).
     * Logic is based on http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#element-text_s
     * @param {!string} text
     * @param {!number} index
     * @return {boolean}
     */
    function requiresSpaceElement(text, index) {
        return text[index] === space && (index === 0 || index === text.length - 1 || text[index - 1] === space);
    }

    this.execute = function (odtDocument) {
        var domPosition,
            previousNode,
            parentElement,
            nextNode = null,
            ownerDocument = odtDocument.getDOMDocument(),
            paragraphElement,
            textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
            toInsertIndex = 0,
            spaceTag,
            spaceElement,
            cursor = odtDocument.getCursor(memberid),
            i;

        function insertTextNode(toInsertText) {
            parentElement.insertBefore(ownerDocument.createTextNode(toInsertText), nextNode);
        }

        odtDocument.upgradeWhitespacesAtPosition(position);
        domPosition = odtDocument.getTextNodeAtStep(position);

        if (domPosition) {
            previousNode = domPosition.textNode;
            nextNode = previousNode.nextSibling;
            parentElement = previousNode.parentNode;
            paragraphElement = odtDocument.getParagraphElement(previousNode);

            // first do the insertion with any contained tabs or spaces
            for (i = 0; i < text.length; i += 1) {
                if (requiresSpaceElement(text, i) || text[i] === tab) {
                    // no nodes inserted yet?
                    if (toInsertIndex === 0) {
                        // if inserting in the middle the given text node needs to be split up
                        // if previousNode becomes empty, it will be cleaned up on finishing
                        if (domPosition.offset !== previousNode.length) {
                            nextNode = previousNode.splitText(domPosition.offset);
                        }
                        // normal text to insert before this space?
                        if (0 < i) {
                            previousNode.appendData(text.substring(0, i));
                        }
                    } else {
                        // normal text to insert before this space?
                        if (toInsertIndex < i) {
                            insertTextNode(text.substring(toInsertIndex, i));
                        }
                    }
                    toInsertIndex = i + 1;

                    // insert space element
                    spaceTag = text[i] === space ? "text:s" : "text:tab";
                    spaceElement = ownerDocument.createElementNS(textns, spaceTag);
                    spaceElement.appendChild(ownerDocument.createTextNode(text[i]));
                    parentElement.insertBefore(spaceElement, nextNode);
                }
            }

            // then insert rest
            // text can be completely inserted, no spaces/tabs?
            if (toInsertIndex === 0) {
                previousNode.insertData(domPosition.offset, text);
            } else if (toInsertIndex < text.length) {
                insertTextNode(text.substring(toInsertIndex));
            }

            // FIXME A workaround.
            triggerLayoutInWebkit(previousNode);

            // Clean up the possibly created empty text node
            if (previousNode.length === 0) {
                previousNode.parentNode.removeChild(previousNode);
            }

            odtDocument.emit(ops.OdtDocument.signalStepsInserted, {position: position, length: text.length});

            if (cursor && moveCursor) {
                // Explicitly place the cursor in the desired position after insertion
                // TODO: At the moment the inserted text already appears before the
                // cursor, so the cursor is effectively at position + text.length
                // already. So this ought to be optimized, by perhaps removing
                // the textnode + cursor reordering logic from OdtDocument's
                // getTextNodeAtStep.
                odtDocument.moveCursor(memberid, position + text.length, 0);
                odtDocument.emit(ops.OdtDocument.signalCursorMoved, cursor);
            }

            if (position > 0) {
                // Necessary to match upgradeWhitespaces behaviour which searches the preceding positions as well
                if (position > 1) {
                    odtDocument.downgradeWhitespacesAtPosition(position - 2);
                }
                odtDocument.downgradeWhitespacesAtPosition(position - 1);
            }
            // Try and downgrade first position in the added text
            odtDocument.downgradeWhitespacesAtPosition(position);
            // Try and downgrade last position in the added text
            odtDocument.downgradeWhitespacesAtPosition(position + text.length - 1);
            // Try and downgrade the next position just *after* the added text
            odtDocument.downgradeWhitespacesAtPosition(position + text.length);

            odtDocument.getOdfCanvas().refreshSize();
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraphElement,
                memberId: memberid,
                timeStamp: timestamp
            });

            odtDocument.getOdfCanvas().rerenderAnnotations();
            return true;
        }
        return false;
    };

    this.spec = function () {
        return {
            optype: "InsertText",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            text: text,
            moveCursor: moveCursor
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    text:string,
    moveCursor:boolean
}}*/
ops.OpInsertText.Spec;
