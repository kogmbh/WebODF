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

/*global ops, odf, core, runtime, Node */

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpApplyHyperlink = function OpApplyHyperlink() {
    "use strict";

    var memberid, timestamp, position, length, hyperlink,
        domUtils = core.DomUtils,
        odfUtils = odf.OdfUtils;

    /**
     * @param {!ops.OpApplyHyperlink.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        length = data.length;
        hyperlink = data.hyperlink;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!Document} document
     * @param {string} hyperlink
     * @return {!Element}
     */
    function createHyperlink(document, hyperlink) {
        var node = document.createElementNS(odf.Namespaces.textns, 'text:a');
        node.setAttributeNS(odf.Namespaces.xlinkns, 'xlink:type', 'simple');
        node.setAttributeNS(odf.Namespaces.xlinkns, 'xlink:href', hyperlink);
        return node;
    }

    /**
     * @param {?Node} node
     * @return {boolean}
     */
    function isPartOfLink(node) {
        while (node) {
            if (odfUtils.isHyperlink(node)) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    }

    /**
     * TODO: support adding image link
     * @param {!ops.Document} document
     * @return {?Array.<!ops.Operation.Event>}
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            ownerDocument = odtDocument.getDOMDocument(),
            range = odtDocument.convertCursorToDomRange(position, length),
            boundaryNodes = domUtils.splitBoundaries(range),
            /**@type{!Array.<!Element>}*/
            modifiedParagraphs = [],
            textNodes = odfUtils.getTextNodes(range, false),
            events = [];

        if (textNodes.length === 0) {
            return null;
        }

        textNodes.forEach(function (node) {
            var linkNode,
                paragraph = odfUtils.getParagraphElement(node);
            runtime.assert(isPartOfLink(node) === false, "The given range should not contain any link.");
            // TODO there could be a small efficiency gain by merging adjacent text nodes into a single hyperlink parent.
            // This is probably only a corner case however and there are not likely to be major repercussions for not doing it
            linkNode = createHyperlink(ownerDocument, hyperlink);
            node.parentNode.insertBefore(linkNode, node);
            linkNode.appendChild(node);
            if (paragraph !== null
                    && modifiedParagraphs.indexOf(paragraph) === -1) {
                modifiedParagraphs.push(paragraph);
            }
        });


        boundaryNodes.forEach(domUtils.normalizeTextNodes);
        range.detach();

        odtDocument.fixCursorPositions(events);
        odtDocument.getOdfCanvas().refreshSize();
        odtDocument.getOdfCanvas().rerenderAnnotations();
        modifiedParagraphs.forEach(function (paragraph) {
            events.push({
                eventid: ops.OdtDocument.signalParagraphChanged,
                args: {
                    paragraphElement: paragraph,
                    memberId: memberid,
                    timeStamp: timestamp
                }
            });
        });

        return events;
    };

    /**
     * @return {!ops.OpApplyHyperlink.Spec}
     */
    this.spec = function () {
        return {
            optype: "ApplyHyperlink",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            hyperlink: hyperlink
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    length:number,
    hyperlink:string
}}*/
ops.OpApplyHyperlink.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    length:number,
    hyperlink:string
}}*/
ops.OpApplyHyperlink.InitSpec;
