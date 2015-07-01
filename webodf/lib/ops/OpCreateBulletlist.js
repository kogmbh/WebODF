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
ops.OpCreateBulletlist = function OpCreateBulletlist() {
    "use strict";

    var memberid, 
        timestamp, 
        position,
        //paragraph, 
        length,
        domUtils = core.DomUtils,
        odfUtils = odf.OdfUtils;

    /**
     * @param {!ops.OpCreateBulletlist.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
    };

    this.isEdit = true;
    this.group = undefined;
    
    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var paragraph;
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            ownerDocument = odtDocument.getDOMDocument(),
            range = odtDocument.convertCursorToDomRange(position, 0),
            /**@type{!Array.<!Element>}*/
            modifiedParagraphs = [],
            textNodes = odfUtils.getTextNodes(range, true);

        var list = ownerDocument.createElementNS(odf.Namespaces.textns, 'text:list');
        var listItem = ownerDocument.createElementNS(odf.Namespaces.textns, 'text:list-item');
        list.setAttributeNS(odf.Namespaces.textns, 'text:style-name', 'L1');
        list.setAttributeNS('urn:webodf:names:helper', 'counter-id', 'X1-level1-1');
        list.appendChild(listItem);
        
        if (textNodes.length > 0) { // make bulletpoint from paragraph:
            paragraph = odfUtils.getParagraphElement(textNodes[0]);
            paragraph.parentNode.insertBefore(list, paragraph);
            listItem.appendChild(paragraph);
            if (modifiedParagraphs.indexOf(paragraph) === -1) {
                modifiedParagraphs.push(paragraph);
            }
        } else { // create a empty bulletpoint:
            range.startContainer.parentNode.insertBefore(list, range.startContainer);
            range.startOffset = 0;
            listItem.appendChild(range.startContainer);
        }

        odtDocument.fixCursorPositions();
        odtDocument.getOdfCanvas().refreshSize();
        odtDocument.getOdfCanvas().rerenderAnnotations();
        modifiedParagraphs.forEach(function (paragraph) {
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraph,
                memberId: memberid,
                timeStamp: timestamp
            });
        });
        
        gui.BulletlistController.setDefaultStyle(odtDocument, memberid);

        var iterator = odtDocument.getIteratorAtPosition(position);
        var paragraphNode = odf.OdfUtils.getParagraphElement(iterator.container());
        if (paragraphNode) {
            odtDocument.getOdfCanvas().refreshSize();
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraphNode,
                timeStamp: undefined,
                memberId: memberid
            });
            odtDocument.getOdfCanvas().rerenderAnnotations();
        }

        return true;
    };

    /**
     * @return {!ops.OpCreateBulletlist.Spec}
     */
    this.spec = function () {
        return {
            optype: "CreateBulletlist",
            memberid: memberid,
            timestamp: timestamp,
            position: position
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number
}}*/
ops.OpCreateBulletlist.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number
}}*/
ops.OpCreateBulletlist.InitSpec;
