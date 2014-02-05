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

/*global ops, runtime, gui, odf, Node, core*/

runtime.loadClass("core.DomUtils");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("odf.TextStyleApplicator");

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpApplyDirectStyling = function OpApplyDirectStyling() {
    "use strict";

    var memberid, timestamp,
        /**@type {number}*/
        position,
        /**@type {number}*/
        length,
        setProperties,
        odfUtils = new odf.OdfUtils(),
        domUtils = new core.DomUtils();

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = parseInt(data.position, 10);
        length = parseInt(data.length, 10);
        setProperties = data.setProperties;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * Apply the specified style properties to all elements within the given range.
     * Currently, only text styles are applied.
     * @param {!Range} range Range to apply text style to
     * @param {!Object} info Style information. Only data within "style:text-properties" will be considered and applied
     */
    function applyStyle(odtDocument, range, info) {
        var odfCanvas = odtDocument.getOdfCanvas(),
            odfContainer = odfCanvas.odfContainer(),
            nextTextNodes = domUtils.splitBoundaries(range),
            textNodes = odfUtils.getTextNodes(range, false),
            limits,
            textStyles;

        // Avoid using the passed in range as boundaries move in strange ways as the DOM is modified
        limits = {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset
        };

        textStyles = new odf.TextStyleApplicator(
            new odf.ObjectNameGenerator(/**@type{!odf.OdfContainer}*/(odfContainer), memberid), // TODO: use the instance in SessionController
            odtDocument.getFormatting(),
            odfContainer.rootElement.automaticStyles
        );
        textStyles.applyStyle(textNodes, limits, info);
        nextTextNodes.forEach(domUtils.normalizeTextNodes);
    }

    this.execute = function (odtDocument) {
        var range = odtDocument.convertCursorToDomRange(position, length),
            impactedParagraphs = odfUtils.getParagraphElements(range);

        applyStyle(odtDocument, range, setProperties);

        range.detach();
        odtDocument.getOdfCanvas().refreshCSS();
        odtDocument.fixCursorPositions(); // The container splits may leave the cursor in an invalid spot

        impactedParagraphs.forEach(function (n) {
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: n,
                memberId: memberid,
                timeStamp: timestamp
            });
        });

        odtDocument.getOdfCanvas().rerenderAnnotations();
        return true;
    };

    this.spec = function () {
        return {
            optype: "ApplyDirectStyling",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            setProperties: setProperties
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    length:number,
    setProperties:Object
}}*/
ops.OpApplyDirectStyling.Spec;
