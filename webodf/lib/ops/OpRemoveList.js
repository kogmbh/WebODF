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

/*global ops, runtime, odf, core*/

/**
 *
 * @constructor
 * @implements ops.Operation
 */
ops.OpRemoveList = function OpRemoveList() {
    "use strict";

    var memberid,
        timestamp,
        /**@type{!number}*/
        firstParagraphPosition,
        odfUtils = odf.OdfUtils,
        domUtils = core.DomUtils;

    /**
     * Ensure that the position supplied to the operation points to the first step in the list
     * @param {!ops.OdtDocument} odtDocument
     * @param {!Element} topLevelList
     * @param {!Element} firstParagraph
     * @param {!{node: !Node, offset: !number}} firstParagraphDomPosition
     * @return {undefined}
     */
    function verifyParagraphPositions(odtDocument, topLevelList, firstParagraph, firstParagraphDomPosition) {
        var stepIterator = odtDocument.createStepIterator(
            topLevelList,
            0,
            [odtDocument.getPositionFilter()],
            topLevelList);

        stepIterator.nextStep();
        runtime.assert(domUtils.containsNode(firstParagraph, stepIterator.container()),
                "Paragraph at " + firstParagraphPosition + " is not the first paragraph in the list");
        stepIterator.setPosition(firstParagraphDomPosition.node, firstParagraphDomPosition.offset);
        runtime.assert(!stepIterator.previousStep(),
                "First paragraph position (" + firstParagraphPosition + ") is not the first step in the paragraph");
    }

    /**
     * @param {!ops.OpRemoveList.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        firstParagraphPosition = data.firstParagraphPosition;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @return {!ops.OpRemoveList.Spec}
     */
    this.spec = function () {
        return {
            optype: "RemoveList",
            memberid: memberid,
            timestamp: timestamp,
            firstParagraphPosition: firstParagraphPosition
        };
    };

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            domPosition = odtDocument.convertCursorStepToDomPoint(firstParagraphPosition),
            firstParagraph = /**@type{!Element}*/(odfUtils.getParagraphElement(domPosition.node, domPosition.offset)),
            /**@type{!Array.<!Node>}*/
            affectedParagraphs = [],
            topLevelListElement;

        // if the paragraph is not within a list then we can't continue
        runtime.assert(odfUtils.isListItemOrListHeaderElement(firstParagraph.parentNode),
                "First paragraph at " + firstParagraphPosition + " is not within a list");
        topLevelListElement = /**@type{!Element}*/(odfUtils.getTopLevelListElement(firstParagraph, odtDocument.getRootNode()));

        verifyParagraphPositions(odtDocument, topLevelListElement, firstParagraph, domPosition);

        // remove all list structure and also keep track of affected paragraphs
        domUtils.removeUnwantedNodes(topLevelListElement, function (node) {
            if (odfUtils.isParagraph(node)) {
                affectedParagraphs.push(node);
            }
            return odfUtils.isListElement(node) || odfUtils.isListItemOrListHeaderElement(node);
        });

        odtDocument.getOdfCanvas().rerenderAnnotations();

        // pretend the paragraphs removed from the list have changed to force caret updates
        affectedParagraphs.forEach(function (paragraph) {
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraph,
                timeStamp: timestamp,
                memberId: memberid
            });
        });
        return true;
    };
};

/**@typedef{{
    optype: !string,
    memberid: !string,
    timestamp: !number,
    firstParagraphPosition: !number
}}*/
ops.OpRemoveList.Spec;

/**@typedef{{
    memberid: !string,
    timestamp:(number|undefined),
    firstParagraphPosition: !number
}}*/
ops.OpRemoveList.InitSpec;