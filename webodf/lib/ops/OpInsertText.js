/**
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
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

/*global ops, odf, runtime*/

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

    var tab = "\t",
        memberid,
        timestamp,
        /**@type{number}*/
        position,
        /**@type{boolean}*/
        moveCursor,
        /**@type{string}*/
        text,
        odfUtils = odf.OdfUtils;

    /**
     * @param {!ops.OpInsertText.InitSpec} data
     */
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
     * Returns true if the supplied character is a non-tab ODF whitespace character
     * @param {!string} character
     * @return {!boolean}
     */
    function isNonTabWhiteSpace(character) {
        return character !== tab && odfUtils.isODFWhitespace(character);
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
        return isNonTabWhiteSpace(text[index]) && (index === 0 || index === text.length - 1 || isNonTabWhiteSpace(text[index - 1]));
    }

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            domPosition,
            previousNode,
            /**@type{!Element}*/
            parentElement,
            nextNode = null,
            ownerDocument = odtDocument.getDOMDocument(),
            paragraphElement,
            textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
            toInsertIndex = 0,
            spaceElement,
            cursor = odtDocument.getCursor(memberid),
            i;

        /**
         * @param {string} toInsertText
         */
        function insertTextNode(toInsertText) {
            parentElement.insertBefore(ownerDocument.createTextNode(toInsertText), nextNode);
        }

        odtDocument.upgradeWhitespacesAtPosition(position);
        domPosition = odtDocument.getTextNodeAtStep(position);

        if (domPosition) {
            previousNode = domPosition.textNode;
            nextNode = previousNode.nextSibling;
            parentElement = /**@type{!Element}*/(previousNode.parentNode);
            paragraphElement = odfUtils.getParagraphElement(previousNode);

            // first do the insertion with any contained tabs or spaces
            for (i = 0; i < text.length; i += 1) {
                if (text[i] === tab || requiresSpaceElement(text, i)) {
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

                    // insert appropriate spacing element
                    if (text[i] === tab) {
                        spaceElement = ownerDocument.createElementNS(textns, "text:tab");
                        spaceElement.appendChild(ownerDocument.createTextNode("\t"));
                    } else {
                        if (text[i] !== " ") {
                            runtime.log("WARN: InsertText operation contains non-tab, non-space whitespace character (character code " + text.charCodeAt(i) + ")");
                        }
                        spaceElement = ownerDocument.createElementNS(textns, "text:s");
                        spaceElement.appendChild(ownerDocument.createTextNode(" "));
                    }
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

            odtDocument.handleStepsInserted({position: position});

            if (cursor && moveCursor) {
                // Explicitly place the cursor in the desired position after insertion
                // TODO: At the moment the inserted text already appears before the
                // cursor, so the cursor is effectively at position + text.length
                // already. So this ought to be optimized, by perhaps removing
                // the textnode + cursor reordering logic from OdtDocument's
                // getTextNodeAtStep.
                odtDocument.moveCursor(memberid, position + text.length, 0);
                odtDocument.emit(ops.Document.signalCursorMoved, cursor);
            }

            odtDocument.downgradeWhitespacesAtPosition(position);
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

    /**
     * @return {!ops.OpInsertText.Spec}
     */
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
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    text:string,
    moveCursor:(string|boolean|undefined)
}}*/
ops.OpInsertText.InitSpec;
