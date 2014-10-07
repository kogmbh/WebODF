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

/*global runtime, odf, ops */

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpInsertImage = function OpInsertImage() {
    "use strict";

    var memberid, timestamp, position, filename, frameWidth, frameHeight, frameStyleName, frameName,
        drawns = odf.Namespaces.drawns,
        svgns = odf.Namespaces.svgns,
        textns = odf.Namespaces.textns,
        xlinkns = odf.Namespaces.xlinkns,
        odfUtils = odf.OdfUtils;

    /**
     * @param {!ops.OpInsertImage.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        filename = data.filename;
        frameWidth = data.frameWidth;
        frameHeight = data.frameHeight;
        frameStyleName = data.frameStyleName;
        frameName = data.frameName;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!Document} document
     * @return {!Element}
     */
    function createFrameElement(document) {
        var imageNode = document.createElementNS(drawns, 'draw:image'),
            frameNode = document.createElementNS(drawns, 'draw:frame');

        imageNode.setAttributeNS(xlinkns, 'xlink:href', filename);
        imageNode.setAttributeNS(xlinkns, 'xlink:type', 'simple');
        imageNode.setAttributeNS(xlinkns, 'xlink:show', 'embed');
        imageNode.setAttributeNS(xlinkns, 'xlink:actuate', 'onLoad');

        frameNode.setAttributeNS(drawns, 'draw:style-name', frameStyleName);
        frameNode.setAttributeNS(drawns, 'draw:name', frameName);
        frameNode.setAttributeNS(textns, 'text:anchor-type', 'as-char');
        frameNode.setAttributeNS(svgns, 'svg:width', frameWidth);
        frameNode.setAttributeNS(svgns, 'svg:height', frameHeight);
        frameNode.appendChild(imageNode);

        return frameNode;
    }

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            odfCanvas = odtDocument.getOdfCanvas(),
            domPosition = odtDocument.getTextNodeAtStep(position, memberid),
            textNode, refNode, paragraphElement, frameElement;

        if (!domPosition) {
            return false;
        }

        textNode = domPosition.textNode;
        paragraphElement = odfUtils.getParagraphElement(textNode);
        refNode = domPosition.offset !== textNode.length ?
            textNode.splitText(domPosition.offset) : textNode.nextSibling;
        frameElement = createFrameElement(odtDocument.getDOMDocument());
        textNode.parentNode.insertBefore(frameElement, refNode);
        odtDocument.handleStepsInserted({position: position});

        // clean up any empty text node which was created by odtDocument.getTextNodeAtStep
        if (textNode.length === 0) {
            textNode.parentNode.removeChild(textNode);
        }

        odfCanvas.addCssForFrameWithImage(frameElement);
        odfCanvas.refreshCSS();
        odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
            paragraphElement: paragraphElement,
            memberId: memberid,
            timeStamp: timestamp
        });
        odfCanvas.rerenderAnnotations();
        return true;
    };

    /**
     * @return {!ops.OpInsertImage.Spec}
     */
    this.spec = function () {
        return {
            optype: "InsertImage",
            memberid: memberid,
            timestamp: timestamp,
            filename: filename,
            position: position,
            frameWidth: frameWidth,
            frameHeight: frameHeight,
            frameStyleName: frameStyleName,
            frameName: frameName
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    filename:string,
    position:number,
    frameWidth:string,
    frameHeight:string,
    frameStyleName:string,
    frameName:string
}}*/
ops.OpInsertImage.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    filename:string,
    position:number,
    frameWidth:string,
    frameHeight:string,
    frameStyleName:string,
    frameName:string
}}*/
ops.OpInsertImage.InitSpec;
