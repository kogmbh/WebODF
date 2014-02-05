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

/*global ops, odf, core, runtime, Node */
runtime.loadClass("core.DomUtils");
runtime.loadClass("odf.OdfUtils");
/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpApplyHyperlink = function OpApplyHyperlink() {
    "use strict";

    var memberid, timestamp, position, length, hyperlink,
        domUtils = new core.DomUtils(),
        odfUtils = new odf.OdfUtils();

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        length = data.length;
        hyperlink = data.hyperlink;
    };

    this.isEdit = true;

    function createHyperlink(document, hyperlink) {
        var node = document.createElementNS(odf.Namespaces.textns, 'text:a');
        node.setAttributeNS(odf.Namespaces.xlinkns, 'xlink:type', 'simple');
        node.setAttributeNS(odf.Namespaces.xlinkns, 'xlink:href', hyperlink);
        return node;
    }

    function isPartOfLink(node) {
        while (node) {
            if (odfUtils.isHyperlink(node)) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    }

    // TODO: support adding image link
    this.execute = function (odtDocument) {
        var ownerDocument = odtDocument.getDOMDocument(),
            range = odtDocument.convertCursorToDomRange(position, length),
            boundaryNodes = domUtils.splitBoundaries(range),
            modifiedParagraphs = [],
            textNodes = odfUtils.getTextNodes(range, false);

        if (textNodes.length === 0) {
            return false;
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
            if (modifiedParagraphs.indexOf(paragraph) === -1) {
                modifiedParagraphs.push(paragraph);
            }
        });


        boundaryNodes.forEach(domUtils.normalizeTextNodes);
        range.detach();

        odtDocument.getOdfCanvas().refreshSize();
        odtDocument.getOdfCanvas().rerenderAnnotations();
        modifiedParagraphs.forEach(function (paragraph) {
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraph,
                memberId: memberid,
                timeStamp: timestamp
            });
        });

        return true;
    };

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
