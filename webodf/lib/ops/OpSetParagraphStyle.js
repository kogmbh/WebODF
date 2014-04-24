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

/*global odf, ops*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpSetParagraphStyle = function OpSetParagraphStyle() {
    "use strict";

    var memberid, timestamp,
        /**@type{!number}*/
        position,
        /**@type{!number}*/
        length,
        styleName,
        textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
        odfUtils = new odf.OdfUtils();

    /**
     * @param {!ops.OpSetParagraphStyle.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = parseInt(data.position, 10);
        length = parseInt(data.length, 10);
        styleName = data.styleName;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            domPosition,
            paragraphNode,
            paragraphEndPos;

        if (isNaN(position) || isNaN(length)) {
            return false;
        }

        domPosition = odtDocument.convertCursorStepToDomPoint(position);
        paragraphNode = odfUtils.getParagraphElement(domPosition.node);
        // Only accept this (position, length) pair if the dom range
        // represented by it contains just the paragraph and nothing else.
        if (odfUtils.isParagraph(paragraphNode)) {
            paragraphEndPos = odtDocument.convertDomPointToCursorStep(
                /**@type{!Element}*/(paragraphNode),
                paragraphNode.childNodes.length
            );

            if (paragraphEndPos === position + length) {
                if (styleName !== "") {
                    paragraphNode.setAttributeNS(textns, 'text:style-name', styleName);
                } else {
                    paragraphNode.removeAttributeNS(textns, 'style-name');
                }

                odtDocument.getOdfCanvas().refreshSize();
                odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                    paragraphElement: paragraphNode,
                    timeStamp: timestamp,
                    memberId: memberid
                });

                odtDocument.getOdfCanvas().rerenderAnnotations();
                return true;
            }
        }

        return false;
    };

    /**
     * @return {!ops.OpSetParagraphStyle.Spec}
     */
    this.spec = function () {
        return {
            optype: "SetParagraphStyle",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            styleName: styleName
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    length: number,
    styleName:string
}}*/
ops.OpSetParagraphStyle.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    length: number,
    styleName:string
}}*/
ops.OpSetParagraphStyle.InitSpec;
