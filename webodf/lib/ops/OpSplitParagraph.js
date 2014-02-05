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

/*jslint nomen: true, evil: true, bitwise: true */
/*global ops, odf*/

/**
 * This operation splits the paragraph at the given
 * position. If the `moveCursor` flag is specified
 * and is set as true, the cursor is moved to the
 * beginning of the next paragraph. Otherwise, it
 * remains in it's original position.
 * @constructor
 * @implements ops.Operation
 */
ops.OpSplitParagraph = function OpSplitParagraph() {
    "use strict";

    var memberid, timestamp, position, moveCursor,
        odfUtils;

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        moveCursor = data.moveCursor === 'true' || data.moveCursor === true;
        odfUtils = new odf.OdfUtils();
    };

    this.isEdit = true;
    this.group = undefined;

    this.execute = function (odtDocument) {
        var domPosition, paragraphNode, targetNode,
            node, splitNode, splitChildNode, keptChildNode,
            cursor = odtDocument.getCursor(memberid);

        odtDocument.upgradeWhitespacesAtPosition(position);
        domPosition = odtDocument.getTextNodeAtStep(position);
        if (!domPosition) {
            return false;
        }

        paragraphNode = odtDocument.getParagraphElement(domPosition.textNode);
        if (!paragraphNode) {
            return false;
        }

        if (odfUtils.isListItem(paragraphNode.parentNode)) {
            targetNode = paragraphNode.parentNode;
        } else {
            targetNode = paragraphNode;
        }

        // There can be a chain of multiple nodes between the text node
        // where the split is done and the containing paragraph nodes,
        // e.g. text:span nodes
        // So all nodes in this chain need to be split up, i.e. they need
        // to be cloned, and then the clone and any next siblings have to
        // be moved to the new paragraph node, which is also cloned from
        // the current one.

        // start with text node the cursor is in, needs special treatment
        // if text node is split at the beginning, do not split but simply
        // move the whole text node
        if (domPosition.offset === 0) {
            keptChildNode = domPosition.textNode.previousSibling;
            splitChildNode = null;
        } else {
            keptChildNode = domPosition.textNode;
            // if text node is to be split at the end, don't split at all
            if (domPosition.offset >= domPosition.textNode.length) {
                splitChildNode = null;
            } else {
                // splitText always returns {!Text} here
                splitChildNode = /**@type{!Text}*/(
                    domPosition.textNode.splitText(domPosition.offset)
                );
            }
        }

        // then handle all nodes until (incl.) the paragraph node:
        // create a clone and add as childs the split node of the node below
        // and any next siblings of it
        node = domPosition.textNode;
        while (node !== targetNode) {
            node = node.parentNode;

            // split off the node copy
            // TODO: handle unique attributes, e.g. xml:id
            splitNode = node.cloneNode(false);
            // add the split child node
            if (splitChildNode) {
                splitNode.appendChild(splitChildNode);
            }
            if (keptChildNode) {
                // Move all child nodes that should appear after the split to the new node
                while (keptChildNode && keptChildNode.nextSibling) {
                    splitNode.appendChild(keptChildNode.nextSibling);
                }
            } else {
                // All children of the original node should be moved after the split
                while (node.firstChild) {
                    splitNode.appendChild(node.firstChild);
                }
            }
            node.parentNode.insertBefore(splitNode, node.nextSibling);

            // prepare next level
            keptChildNode = node;
            splitChildNode = splitNode;
        }

        if (odfUtils.isListItem(splitChildNode)) {
            splitChildNode = splitChildNode.childNodes[0];
        }

        // clean up any empty text node which was created by odtDocument.getTextNodeAtStep
        if (domPosition.textNode.length === 0) {
            domPosition.textNode.parentNode.removeChild(domPosition.textNode);
        }
        odtDocument.emit(ops.OdtDocument.signalStepsInserted, {position: position, length: 1});

        if (cursor && moveCursor) {
            odtDocument.moveCursor(memberid, position + 1, 0);
            odtDocument.emit(ops.OdtDocument.signalCursorMoved, cursor);
        }

        odtDocument.fixCursorPositions();
        odtDocument.getOdfCanvas().refreshSize();
        // mark both paragraphs as edited
        odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
            paragraphElement: paragraphNode,
            memberId: memberid,
            timeStamp: timestamp
        });
        odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
            paragraphElement: splitChildNode,
            memberId: memberid,
            timeStamp: timestamp
        });

        odtDocument.getOdfCanvas().rerenderAnnotations();
        return true;
    };

    this.spec = function () {
        return {
            optype: "SplitParagraph",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            moveCursor: moveCursor
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number
}}*/
ops.OpSplitParagraph.Spec;
