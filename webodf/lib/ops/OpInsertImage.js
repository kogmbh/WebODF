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
 * @source: http://gitorious.org/webodf/webodf/
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
        xlinkns = odf.Namespaces.xlinkns;

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

    /**
     * @param document
     * @returns {!Element}
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

    this.execute = function (odtDocument) {
        var odfCanvas = odtDocument.getOdfCanvas(),
            domPosition = odtDocument.getPositionInTextNode(position, memberid),
            textNode, refNode, paragraphElement, frameElement;

        if (!domPosition) {
            return false;
        }

        textNode = domPosition.textNode;
        paragraphElement = odtDocument.getParagraphElement(textNode);
        refNode = domPosition.offset !== textNode.length ?
            textNode.splitText(domPosition.offset) : textNode.nextSibling;
        frameElement = createFrameElement(odtDocument.getDOM());
        textNode.parentNode.insertBefore(frameElement, refNode);

        // clean up any empty text node which was created by odtDocument.getPositionInTextNode
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
