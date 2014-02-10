/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, gui, odf, core */

/**
 * @constructor
 * @param {!odf.OdfCanvas} odfCanvas
 */
gui.TooltipHandler = function TooltipHandler(odfCanvas) {
    "use strict";
    var /** @const@type{!string} */
        tooltipId = "tooltip",
        /** @const@type{!string} */
        tooltipLinkId = "tooltipLink",
        /** @const@type{!string} */
        tooltipTextId = "tooltipText",
        domUtils = new core.DomUtils(),
        odfUtils = new odf.OdfUtils(),
        modifier = gui.KeyboardHandler.Modifier,
        /**@type{!Window}*/
        window = /**@type{!Window}*/(runtime.getWindow()),
        /**@type{!HTMLElement}*/
        tooltipElement;

    runtime.assert(window !== null,
        "Expected to be run in an environment which has a global window, like a browser.");

    /**
     * @param {?Node} node
     * @return {?Element}
     */
    function getHyperlinkElement(node) {
        while (node !== null) {
            if (odfUtils.isHyperlink(node)) {
                return /**@type{!Element}*/(node);
            }
            if (odfUtils.isParagraph(node)) {
                break;
            }
            node = node.parentNode;
        }
        return null;
    }

    /**
     * Show the tooltip
     * @param {!Event} e
     * @return {undefined}
     */
    this.showTooltip = function (e) {
        var /** @const@type {!number} */
                adjustment = 10, // small adjustment to the final position so tooltip wouldn't sit right on top of caret
            target = e.target || e.srcElement,
            sizerElement = /** @type{!Element}*/(odfCanvas.getSizer()),
            zoomLevel = odfCanvas.getZoomLevel(),
            referenceRect,
            linkElement,
            left, top, max;

        linkElement = getHyperlinkElement(/**@type{?Node}*/(target));
        if (!linkElement) {
            return;
        }

        if (!domUtils.containsNode(sizerElement, tooltipElement)) {
            // TODO Remove when a proper undo manager arrives
            // The undo manager can replace the root element, discarding the original.
            // The tooltip element is still valid, and simply needs to be re-attached
            // after this occurs.
            sizerElement.appendChild(tooltipElement);
        }

        tooltipElement.firstChild.textContent = odfUtils.getHyperlinkTarget(linkElement);
        tooltipElement.style.display = "block";

        max = window.innerWidth - tooltipElement.offsetWidth;
        left = e.clientX > max ? max : e.clientX; // coordinates relative to the viewport
        max = window.innerHeight - tooltipElement.offsetHeight - adjustment;
        top = e.clientY > max ? max : e.clientY + adjustment; // coordinates relative to the viewport

        // converts the coordinates to relative to the sizer element
        referenceRect = sizerElement.getBoundingClientRect();
        left = (left - referenceRect.left) / zoomLevel;
        top = (top - referenceRect.top) / zoomLevel;

        tooltipElement.style.left = left + "px";
        tooltipElement.style.top = top + "px";
    };

    /**
     * Hide the tooltip
     * @return {undefined}
     */
    this.hideTooltip = function () {
        tooltipElement.style.display = "none";
    };

    /**
     * @param {!number} modifierKey
     * @return {!string}
     */
    function getHint(modifierKey) {
        var hint;
        switch (modifierKey) {
        case modifier.Ctrl:
            hint = runtime.tr("Ctrl-click to follow link");
            break;
        case modifier.Meta:
            hint = runtime.tr("⌘-click to follow link");
            break;
        default:
            hint = "";
            break;
        }
        return hint;
    }

    /**
     * Updates the
     * @param {!number} modifierKey
     * @return {undefined}
     */
    this.updateHint = function (modifierKey) {
        tooltipElement.lastChild.textContent = getHint(modifierKey);
    };

    /**
     * @return {undefined}
     */
    function init() {
        var document = odfCanvas.getElement().ownerDocument,
            linkSpan = document.createElement("span"),
            textSpan = document.createElement("span");
        linkSpan.id = tooltipLinkId;
        textSpan.id = tooltipTextId;

        tooltipElement = /**@type{!HTMLElement}*/(document.createElement("div"));
        tooltipElement.id = tooltipId;
        tooltipElement.appendChild(linkSpan);
        tooltipElement.appendChild(textSpan);
        odfCanvas.getElement().appendChild(tooltipElement);
    }

    init();
};
