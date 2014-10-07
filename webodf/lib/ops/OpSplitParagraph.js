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

/*global ops, odf*/
/*jslint nomen: true, evil: true, bitwise: true */

/**
 * This operation splits the paragraph at the given
 * position. If the `moveCursor` flag is specified
 * and is set as true, the cursor is moved to the
 * beginning of the next paragraph. Otherwise, it
 * remains in it's original position.
 * The paragraph style for the new paragraph is specified by the
 * paragraphStyleName. If blank or empty, the new paragraph will
 * have no specified style.
 *
 * @constructor
 * @implements ops.Operation
 */
ops.OpSplitParagraph = function OpSplitParagraph() {
    "use strict";

    var memberid, timestamp,
        /**@type{number}*/
        sourceParagraphPosition,
        /**@type{number}*/
        position,
        /**@type{boolean}*/
        moveCursor,
        /**@type{!string}*/
        paragraphStyleName,
        odfUtils = odf.OdfUtils,
        /**@const*/
        textns = odf.Namespaces.textns;

    /**
     * @param {!ops.OpSplitParagraph.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        sourceParagraphPosition = data.sourceParagraphPosition;
        paragraphStyleName = data.paragraphStyleName;
        moveCursor = data.moveCursor === 'true' || data.moveCursor === true;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{!ops.OdtDocument}*/(document),
            domPosition, paragraphNode, targetNode,
            node, splitNode, splitChildNode, keptChildNode,
            cursor = odtDocument.getCursor(memberid);

        odtDocument.upgradeWhitespacesAtPosition(position);
        domPosition = odtDocument.getTextNodeAtStep(position);
        if (!domPosition) {
            return false;
        }

        paragraphNode = odfUtils.getParagraphElement(domPosition.textNode);
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
            splitChildNode = splitChildNode.childNodes.item(0);
        }

        if (paragraphStyleName) {
            /**@type{!Element}*/(splitChildNode).setAttributeNS(textns, "text:style-name", paragraphStyleName);
        } else {
            /**@type{!Element}*/(splitChildNode).removeAttributeNS(textns, "style-name");
        }

        // clean up any empty text node which was created by odtDocument.getTextNodeAtStep
        if (domPosition.textNode.length === 0) {
            domPosition.textNode.parentNode.removeChild(domPosition.textNode);
        }
        odtDocument.handleStepsInserted({position: position});

        if (cursor && moveCursor) {
            odtDocument.moveCursor(memberid, position + 1, 0);
            odtDocument.emit(ops.Document.signalCursorMoved, cursor);
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

    /**
     * @return {!ops.OpSplitParagraph.Spec}
     */
    this.spec = function () {
        return {
            optype: "SplitParagraph",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            sourceParagraphPosition: sourceParagraphPosition,
            paragraphStyleName: paragraphStyleName,
            moveCursor: moveCursor
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    sourceParagraphPosition:number,
    paragraphStyleName:string,
    moveCursor:boolean
}}*/
ops.OpSplitParagraph.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    sourceParagraphPosition:number,
    paragraphStyleName:string,
    moveCursor:(string|boolean|undefined)
}}*/
ops.OpSplitParagraph.InitSpec;
