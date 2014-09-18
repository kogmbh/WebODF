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

/*global ops, runtime, odf, core*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpRemoveText = function OpRemoveText() {
    "use strict";

    var memberid, timestamp,
        /**@type {number}*/
        position,
        /**@type {number}*/
        length,
        odfUtils = odf.OdfUtils,
        domUtils = core.DomUtils;

    /**
     * @param {!ops.OpRemoveText.InitSpec} data
     */
    this.init = function (data) {
        runtime.assert(data.length >= 0, "OpRemoveText only supports positive lengths");
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = parseInt(data.position, 10);
        length = parseInt(data.length, 10);
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            range,
            textNodes,
            paragraph,
            cursor = odtDocument.getCursor(memberid),
            collapseRules = new odf.CollapsingRules(odtDocument.getRootNode());

        odtDocument.upgradeWhitespacesAtPosition(position);
        odtDocument.upgradeWhitespacesAtPosition(position + length);

        range = odtDocument.convertCursorToDomRange(position, length);
        domUtils.splitBoundaries(range);
        textNodes = odfUtils.getTextElements(range, false, true);
        paragraph = /**@type{!Element}*/(odfUtils.getParagraphElement(range.startContainer, range.startOffset));
        runtime.assert(paragraph !== undefined, "Attempting to remove text outside a paragraph element");
        range.detach();

        // Each character element is fully contained within the range, so will be completely removed
        textNodes.forEach(function (element) {
            if (element.parentNode) {
                // In order to guarantee OT-ability, this rule needs to be enforced, otherwise it's impossible to tell
                // which paragraph boundaries might be impacted by the remove op.
                runtime.assert(domUtils.containsNode(paragraph, element),
                    "RemoveText only supports removing elements within the same paragraph");

                collapseRules.mergeChildrenIntoParent(element);
            } else {
                // If this is an empty text node, it might have already been removed from it's container.
                // Although WebODF specifically avoids empty text nodes at all times, incorrect 3rd party
                // DOM manipulation (or undiscovered WebODF bugs) may leave these behind.
                runtime.log("WARN: text element has already been removed from it's container");
            }
        });

        odtDocument.handleStepsRemoved({position: position});
        odtDocument.downgradeWhitespacesAtPosition(position);
        odtDocument.fixCursorPositions();
        odtDocument.getOdfCanvas().refreshSize();
        odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
            paragraphElement: paragraph,
            memberId: memberid,
            timeStamp: timestamp
        });

        if (cursor) {
            cursor.resetSelectionType();
            odtDocument.emit(ops.Document.signalCursorMoved, cursor);
        }

        odtDocument.getOdfCanvas().rerenderAnnotations();
        return true;
    };

    /**
     * @return {!ops.OpRemoveText.Spec}
     */
    this.spec = function () {
        return {
            optype: "RemoveText",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    length:number
}}*/
ops.OpRemoveText.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    length:number
}}*/
ops.OpRemoveText.InitSpec;
