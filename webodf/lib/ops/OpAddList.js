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
ops.OpAddList = function OpAddList() {
    "use strict";

    var memberid,
        timestamp,
        /**@type{!number}*/
        startParagraphPosition,
        /**@type{!number}*/
        endParagraphPosition,
        /**@type{string|undefined}*/
        styleName,
        odfUtils = odf.OdfUtils,
        domUtils = core.DomUtils,
        /**@const*/
        textns = odf.Namespaces.textns;

    /**
     * Ensure that the paragraph positions given as the range for this op are the first step
     * in the paragraphs at those positions. This check is done to assist operational transforms for this OP.
     * Also ensure that all paragraphs in the range supplied to the operation share the same parent.
     * @param {!ops.OdtDocument} odtDocument
     * @param {!Array.<!Element>} paragraphs
     * @param {!Range} range
     * @return {undefined}
     */
    function verifyParagraphPositions(odtDocument, paragraphs, range) {
        var rootNode = odtDocument.getRootNode(),
            stepIterator = odtDocument.createStepIterator(rootNode,
                0,
                [odtDocument.getPositionFilter()],
                rootNode),
            sharedParentNode = paragraphs[0].parentNode;

        stepIterator.setPosition(/**@type{!Node}*/(range.startContainer), range.startOffset);
        stepIterator.previousStep();
        runtime.assert(!domUtils.containsNode(paragraphs[0], stepIterator.container()),
                "First paragraph position (" + startParagraphPosition + ") is not the first step in the paragraph");

        stepIterator.setPosition(/**@type{!Node}*/(range.endContainer), range.endOffset);
        stepIterator.previousStep();
        runtime.assert(!domUtils.containsNode(paragraphs[paragraphs.length - 1], stepIterator.container()),
                "Last paragraph position (" + endParagraphPosition + ") is not the first step in the paragraph");

        runtime.assert(paragraphs.every(function (paragraph) {
            return paragraph.parentNode === sharedParentNode;
        }), "All the paragraphs in the range do not have the same parent node");
    }

    /**
     * @param {!ops.OpAddList.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        startParagraphPosition = data.startParagraphPosition;
        endParagraphPosition = data.endParagraphPosition;
        styleName = data.styleName;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @return {!ops.OpAddList.Spec}
     */
    this.spec = function () {
        return {
            optype: "AddList",
            memberid: memberid,
            timestamp: timestamp,
            startParagraphPosition: startParagraphPosition,
            endParagraphPosition: endParagraphPosition,
            styleName: styleName
        };
    };

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            ownerDocument = odtDocument.getDOMDocument(),
            range = odtDocument.convertCursorToDomRange(startParagraphPosition, endParagraphPosition - startParagraphPosition),
            paragraphsInRange = odfUtils.getParagraphElements(range),
            insertionPointParagraph = paragraphsInRange[0],
            /**@type{!Element}*/
            newListElement;

        // always want a forward range where the start of the range is less than the end of the range
        // this is to make any operational transforms easier by avoiding having to check for backward ranges
        runtime.assert(startParagraphPosition <= endParagraphPosition,
                "First paragraph in range (" + startParagraphPosition + ") must be " +
                "before last paragraph in range (" + endParagraphPosition + ")");

        if (!insertionPointParagraph) {
            return false;
        }

        verifyParagraphPositions(odtDocument, paragraphsInRange, range);

        // create the new list element and insert it in the document before the first paragraph we are adding to the list
        newListElement = ownerDocument.createElementNS(textns, "text:list");
        insertionPointParagraph.parentNode.insertBefore(newListElement, paragraphsInRange[0]);

        // wrap each paragraph in a list item element and add it to the list
        paragraphsInRange.forEach(function (paragraphElement) {
            var newListItemElement = ownerDocument.createElementNS(textns, "text:list-item");

            newListItemElement.appendChild(paragraphElement);
            newListElement.appendChild(newListItemElement);
        });

        if (styleName) {
            newListElement.setAttributeNS(textns, "text:style-name", styleName);
        }

        odtDocument.getOdfCanvas().refreshCSS();
        odtDocument.getOdfCanvas().rerenderAnnotations();
        paragraphsInRange.forEach(function (paragraphElement) {
            // pretend the paragraphs affected have changed to force caret updates
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraphElement,
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
    startParagraphPosition: !number,
    endParagraphPosition: !number,
    styleName: (!string|undefined)
}}*/
ops.OpAddList.Spec;

/**@typedef{{
    memberid: !string,
    timestamp:(!number|undefined),
    startParagraphPosition: !number,
    endParagraphPosition: !number,
    styleName: (!string|undefined)
}}*/
ops.OpAddList.InitSpec;