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

/*global ops, runtime, odf, core */

/**
 *
 * @constructor
 * @implements ops.Operation
 */
ops.OpMergeList = function OpMergeList() {
    "use strict";

    var memberid,
        timestamp,
        /**@type{!number}*/
        sourceStartPosition,
        /**@type{!number}*/
        destinationStartPosition,
        odfUtils = odf.OdfUtils;

    /**
     * @param {!ops.OpMergeList.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        sourceStartPosition = data.sourceStartPosition;
        destinationStartPosition = data.destinationStartPosition;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @return {!ops.OpMergeList.Spec}
     */
    this.spec = function () {
        return {
            optype: "MergeList",
            memberid: memberid,
            timestamp: timestamp,
            sourceStartPosition: sourceStartPosition,
            destinationStartPosition: destinationStartPosition
        };
    };

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            rootNode = odtDocument.getRootNode(),
            sourceDomPosition = odtDocument.convertCursorStepToDomPoint(sourceStartPosition),
            destinationDomPosition = odtDocument.convertCursorStepToDomPoint(destinationStartPosition),
            sourceList,
            destinationList,
            childListItem;

        sourceList = odfUtils.getTopLevelListElement(sourceDomPosition.node, rootNode);
        destinationList = odfUtils.getTopLevelListElement(destinationDomPosition.node, rootNode);
        childListItem = sourceList.firstElementChild;

        while (childListItem) {
            destinationList.appendChild(childListItem);
            childListItem = sourceList.firstElementChild;
        }

        sourceList.parentNode.removeChild(sourceList);
        return true;
    };
};

/**@typedef{{
    optype: !string,
    memberid: !string,
    timestamp: !number,
    sourceStartPosition: !number,
    destinationStartPosition: !number
}}*/
ops.OpMergeList.Spec;

/**@typedef{{
    memberid: !string,
    timestamp:(!number|undefined),
    sourceStartPosition: !number,
    destinationStartPosition: !number
}}*/
ops.OpMergeList.InitSpec;