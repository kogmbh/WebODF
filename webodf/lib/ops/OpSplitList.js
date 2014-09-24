/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global ops, runtime, odf, core, Range*/

/**
 *
 * @constructor
 * @implements ops.Operation
 */
ops.OpSplitList = function OpSplitList() {
    "use strict";

    var memberid,
        timestamp,
        /**@type{!number}*/
        sourceStartPosition,
        /**@type{!number}*/
        splitPosition,
        odfUtils = odf.OdfUtils,
        /**@const*/
        xmlns = odf.Namespaces.xmlns;

    /**
     * @param {!ops.OpSplitList.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        sourceStartPosition = data.sourceStartPosition;
        splitPosition = data.splitPosition;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @return {!ops.OpSplitList.Spec}
     */
    this.spec = function () {
        return {
            optype: "SplitList",
            memberid: memberid,
            timestamp: timestamp,
            sourceStartPosition: sourceStartPosition,
            splitPosition: splitPosition
        };
    };

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            ownerDocument = odtDocument.getDOMDocument(),
            rootNode = odtDocument.getRootNode(),
            collapseRules = new odf.CollapsingRules(rootNode),
            sourceDomPosition = odtDocument.convertCursorStepToDomPoint(sourceStartPosition),
            splitDomPosition = odtDocument.convertCursorStepToDomPoint(splitPosition),
            sourceParagraph = /**@type{!Element}*/(odfUtils.getParagraphElement(sourceDomPosition.node, sourceDomPosition.offset)),
            splitParagraph = /**@type{!Element}*/(odfUtils.getParagraphElement(splitDomPosition.node, splitDomPosition.offset)),
            sourceList = odfUtils.getTopLevelListElement(sourceParagraph, rootNode),
            destinationList,
            splitPositionParentList,
            range = ownerDocument.createRange(),
            fragment;

        if (!sourceList || !splitParagraph) {
            return false;
        }

        destinationList =  sourceList.cloneNode(false);
        destinationList.removeAttributeNS(xmlns, "id");

        // create a range starting at before the list item element we split at and
        // ending at just after the last list item in the list
        range.setStartBefore(splitParagraph.parentNode);
        range.setEndAfter(sourceList.lastElementChild);

        // extract the range to get all list items from the split position to the end of the list
        // then collapse any empty nodes at the parent text:list element of the paragraph at the split position
        splitPositionParentList = /**@type{!Node}*/(splitParagraph.parentNode.parentNode);
        fragment = range.extractContents();

        // don't collapse nodes if its the top level list
        if (splitPositionParentList !== sourceList) {
            collapseRules.mergeChildrenIntoParent(splitPositionParentList);
        }

        destinationList.appendChild(fragment);
        sourceList.parentNode.insertBefore(destinationList, sourceList.nextElementSibling);
        return true;
    };
};

/**@typedef{{
    optype: !string,
    memberid: !string,
    timestamp: !number,
    sourceStartPosition: !number,
    splitPosition: !number
}}*/
ops.OpSplitList.Spec;

/**@typedef{{
    memberid: !string,
    timestamp:(number|undefined),
    sourceStartPosition: !number,
    splitPosition: !number
}}*/
ops.OpSplitList.InitSpec;