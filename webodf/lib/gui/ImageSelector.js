/**
 * Copyright (C) 2012 KO GmbH <jos.van.den.oever@kogmbh.com>
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
/*global runtime, gui, odf */

runtime.loadClass("odf.Namespaces");

/**
 * @class
 * @constructor
 * @param {!odf.OdfCanvas} odfCanvas
 */
gui.ImageSelector = function ImageSelector(odfCanvas) {
    "use strict";
    var /**@const
           @type {!string}*/
        svgns = odf.Namespaces.svgns,
        /**@const
           @type {!string}*/
        imageSelectorId = "imageSelector",
        /**@const
           @type {!number}*/
        selectorBorderWidth = 1, // in px
        /**@const
           @type {!Array.<!string>}*/
        squareClassNames = [
            "topLeft", "topRight", "bottomRight", "bottomLeft", "topMiddle", "rightMiddle", "bottomMiddle", "leftMiddle"
        ],
        document = odfCanvas.getElement().ownerDocument,
        hasSelection = false;

    /**
     * @return {!Element}
     */
    function createSelectorElement() {
        var sizerElement = odfCanvas.getSizer(),
            selectorElement = /**@type{!HTMLElement}*/(document.createElement("div"));

        selectorElement.id = "imageSelector";
        selectorElement.style.borderWidth = selectorBorderWidth + "px";
        sizerElement.appendChild(selectorElement);

        /**
         * @param {string} className
         */
        function createDiv(className) {
            var squareElement = document.createElement("div");
            squareElement.className = className;
            selectorElement.appendChild(squareElement);
        }
        squareClassNames.forEach(createDiv);

        return selectorElement;
    }

    /**
     * @param {!Element} element
     * @param {!Element} referenceElement
     * @return {{left: !number, top: !number}}
     */
    function getPosition(element, referenceElement) {
        var rect = element.getBoundingClientRect(),
            refRect = referenceElement.getBoundingClientRect(),
            zoomLevel = odfCanvas.getZoomLevel();

        return {
            left: (rect.left - refRect.left) / zoomLevel - selectorBorderWidth,
            top: (rect.top - refRect.top) / zoomLevel - selectorBorderWidth
        };
    }

    /**
     * @param {!Element} frameElement
     * @return {undefined}
     */
    this.select = function (frameElement) {
        var selectorElement = document.getElementById(imageSelectorId),
            position;

        // selector element could be removed by the undo process so re-create it if needed
        if (!selectorElement) {
            selectorElement = createSelectorElement();
        }

        hasSelection = true;
        position = getPosition(frameElement, /** @type {!Element}*/(selectorElement.parentNode));
        selectorElement.style.display = "block";
        selectorElement.style.left = position.left + "px";
        selectorElement.style.top = position.top + "px";
        selectorElement.style.width = frameElement.getAttributeNS(svgns, "width");
        selectorElement.style.height = frameElement.getAttributeNS(svgns, "height");
    };

    /**
     * Clears the image selection.
     * @return {undefined}
     */
    this.clearSelection = function () {
        var selectorElement;
        if (hasSelection) {
            selectorElement = document.getElementById(imageSelectorId);
            if (selectorElement) {
                selectorElement.style.display = "none";
            }
        }
        hasSelection = false;
    };

    /**
     * Check if the given node is the selector element or one of its child elements.
     * @param {?Node} node
     * @return {!boolean}
     */
    this.isSelectorElement = function (node) {
        var selectorElement = document.getElementById(imageSelectorId);
        if (!selectorElement) {
            return false;
        }
        return node === selectorElement || node.parentNode === selectorElement;
    };
};
