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
/*global core, gui, ops, runtime, Node*/

runtime.loadClass("gui.Avatar");
runtime.loadClass("ops.OdtCursor");

/**
 * Class that represents a caret in a document.
 * The caret is implemented by the left border of a span positioned absolutely
 * to the cursor element, with a width of 0 px and a height of 1em (CSS rules).
 * Blinking is done by switching the color of the border from transparent to
 * the member color and back.
 * @constructor
 * @param {!ops.OdtCursor} cursor
 * @param {boolean} avatarInitiallyVisible Sets the initial visibility of the caret's avatar
 * @param {boolean} blinkOnRangeSelect Specify that the caret should blink if a non-collapsed range is selected
 */
gui.Caret = function Caret(cursor, avatarInitiallyVisible, blinkOnRangeSelect) {
    "use strict";
    var /**@const*/MIN_CARET_HEIGHT_PX = 8, /** 8px = 6pt font size */
        /**@const*/DEFAULT_CARET_TOP = "5%",
        /**@const*/DEFAULT_CARET_HEIGHT = "1em",
        span,
        avatar,
        cursorNode,
        shouldBlink = false,
        blinking = false,
        blinkTimeout;

    function blink(reset) {
        if (!shouldBlink || !cursorNode.parentNode) {
            // stop blinking when removed from the document
            return;
        }

        if (!blinking || reset) {
            if (reset && blinkTimeout !== undefined) {
                    runtime.clearTimeout(blinkTimeout);
                }

            blinking = true;
            // switch between transparent and color
            span.style.opacity =
                (reset || span.style.opacity === "0")
                    ? "1"
                    : "0";

            blinkTimeout = runtime.setTimeout(function () {
                blinking = false;
                blink(false);
            }, 500);
        }
    }

    /**
     * Calculates the bounding client rect of the caret element,
     * expanded with a specific margin
     * @param {!Element} caretElement
     * @param {!{left:!number,top:!number,right:!number,bottom:!number}} margin
     * @return {!{left:!number,top:!number,right:!number,bottom:!number}}
     */
    function getCaretClientRectWithMargin(caretElement, margin) {
        var caretRect = caretElement.getBoundingClientRect();

        return {
            left:   caretRect.left - margin.left,
            top:    caretRect.top - margin.top,
            right:  caretRect.right + margin.right,
            bottom: caretRect.bottom + margin.bottom
        };
    }

    /**
     * Return the maximum available offset for the supplied node.
     * @param {!Node} node
     * @returns {!number}
     */
    function length(node) {
        return node.nodeType === Node.TEXT_NODE ? node.textContent.length : node.childNodes.length;
    }

    /**
     * Calculate the number of pixels of vertical overlap. If there is no overlap,
     * this number will be negative
     * @param {!Node} cursorNode
     * @param {!ClientRect} rangeRect
     * @returns {!number}
     */
    function verticalOverlap(cursorNode, rangeRect) {
        var cursorRect = cursorNode.getBoundingClientRect(),
            intersectTop = 0,
            intersectBottom = 0;

        if (cursorRect && rangeRect) {
            intersectTop = Math.max(cursorRect.top, rangeRect.top);
            intersectBottom = Math.min(cursorRect.bottom, rangeRect.bottom);

        }
        return intersectBottom - intersectTop;
    }

    /**
     * Get the client rectangle for the nearest selection point to the caret.
     * This works on the assumption that the next or previous sibling is likely to
     * be a text node that will provide an accurate rectangle for the caret's desired
     * height and vertical position.
     * @returns {?ClientRect}
     */
    function getSelectionRect() {
        var range = cursor.getSelectedRange().cloneRange(),
            node = cursor.getNode(),
            nextRectangle,
            rectangles,
            selectionRectangle,
            nodeLength;

        // TODO this might be able to use OdfUtils.scanLeft & scanRight behaviours to find the next odf element
        // By default, assume the selection height should reflect the height of the previousSibling's last client rect
        // This means if the cursor is next to a text node, the client rect will be the dimensions of the text block
        if (node.previousSibling) {
            nodeLength = length(node.previousSibling);
            range.setStart(node.previousSibling, nodeLength > 0 ? nodeLength - 1 : 0);
            range.setEnd(node.previousSibling, nodeLength);
            rectangles = range.getClientRects();
            selectionRectangle = rectangles && rectangles[rectangles.length - 1];
        }
        // Under some circumstances (either no previous sibling, or whitespace wrapping) the client rect of the next
        // sibling will actually be a more accurate visual representation.
        if (node.nextSibling) {
            range.setStart(node.nextSibling, 0);
            range.setEnd(node.nextSibling, length(node.nextSibling) > 0 ? 1 : 0);
            rectangles = range.getClientRects();
            nextRectangle = rectangles && rectangles[0];
            if (nextRectangle) {
                // The nextSibling's rectangle should take precedence if
                // 1. There is no previousSibling
                // or 2. The nextSibling's rectangle has more vertical overlap with the cursor node's bounding rectangle
                // Check #2 is specifically required to handling whitespace wrapping logic. Without this check,
                // when a whitespace block is wrapped, the cursor tends to jump to the vertical alignment of the previous
                // line, rather than the line the cursor element is now actually on.
                if (!selectionRectangle || verticalOverlap(node, nextRectangle) > verticalOverlap(node, selectionRectangle)) {
                    selectionRectangle = nextRectangle;
                }
            }
        }

        return selectionRectangle;
    }

    /**
     * Tweak the height and top offset of the caret to display closely inline in the text block.
     * This uses ranges to account for line-height and text offsets
     *
     * This adjustment is necessary as various combinations of fonts and line sizes otherwise cause
     * the caret to appear above or below the natural line of the text
     * Fonts known to cause this problem:
     * - STIXGeneral (MacOS, Chrome & Safari)
     */
    function updateVerticalCaretAlignment() {
        var selectionRect = getSelectionRect(),
            caretRect;

        if (selectionRect) {
            // Reset the top back to 0 so that the new client rect calculations are simple
            // If this isn't done, the existing span's top setting would need to be taken into
            // account (and converted if not in pixels) when calculating the new top value
            span.style.top = "0";
            caretRect = span.getBoundingClientRect();

            if (selectionRect.height < MIN_CARET_HEIGHT_PX) {
                // ClientRect's are read-only, so a whole new object is necessary to modify these values
                selectionRect = {
                    top: selectionRect.top - ((MIN_CARET_HEIGHT_PX - selectionRect.height) / 2),
                    height: MIN_CARET_HEIGHT_PX
                };
            }
            span.style.height = selectionRect.height + 'px';
            span.style.top = (selectionRect.top - caretRect.top) + 'px';
        } else {
            // fallback to a relatively safe set of values
            // This can happen if the caret is not currently visible, or is in the middle
            // of a collection of nodes that have no client rects. In this case, the caret
            // will fall back to the existing behaviour
            span.style.height = DEFAULT_CARET_HEIGHT;
            span.style.top = DEFAULT_CARET_TOP;
        }
    }
    this.updateVerticalCaretAlignment = updateVerticalCaretAlignment;
    
    this.refreshCursorBlinking = function () {
        if (blinkOnRangeSelect || cursor.getSelectedRange().collapsed) {
            shouldBlink = true;
            blink(true);
        } else {
            shouldBlink = false;
            span.style.opacity = "0";
        }
    };

    this.setFocus = function () {
        shouldBlink = true;
        avatar.markAsFocussed(true);
        blink(true);
    };
    this.removeFocus = function () {
        shouldBlink = false;
        avatar.markAsFocussed(false);
        span.style.opacity = "1";
    };
    this.show = function () {
        span.style.visibility = "visible";
        avatar.markAsFocussed(true);
    };
    this.hide = function () {
        span.style.visibility = "hidden";
        avatar.markAsFocussed(false);
    };
    this.setAvatarImageUrl = function (url) {
        avatar.setImageUrl(url);
    };
    this.setColor = function (newColor) {
        span.style.borderColor = newColor;
        avatar.setColor(newColor);
    };
    this.getCursor = function () {
        return cursor;
    };
    /**
     * @return {!Element}
     */
    this.getFocusElement = function () {
        return span;
    };
    this.toggleHandleVisibility = function () {
        if (avatar.isVisible()) {
            avatar.hide();
        } else {
            avatar.show();
        }
    };
    this.showHandle = function () {
        avatar.show();
    };
    this.hideHandle = function () {
        avatar.hide();
    };

    /**
     * Scrolls the view on the canvas in such a way that the caret is
     * completely visible, with a small margin around.
     * The view on the canvas is only scrolled as much as needed.
     * If the caret is already visible nothing will happen.
     */
    this.ensureVisible = function () {
        var canvasElement = cursor.getOdtDocument().getOdfCanvas().getElement(),
            canvasContainerElement = canvasElement.parentNode,
            caretRect,
            canvasContainerRect,
            // margin around the caret when calculating the visibility,
            // to have the caret not stick directly to the containing border
            // size in pixels, and also to avoid it hiding below scrollbars.
            // The scrollbar width is in most cases the offsetWidth - clientWidth.
            // We assume a 5px distance from the boundary is A Good Thing.
            horizontalMargin = canvasContainerElement.offsetWidth - canvasContainerElement.clientWidth + 5,
            verticalMargin = canvasContainerElement.offsetHeight - canvasContainerElement.clientHeight + 5;

        // The visible part of the canvas is set by changing the
        // scrollLeft/scrollTop properties of the containing element
        // accordingly. Both are 0 if the canvas top-left corner is exactly
        // in the top-left corner of the container.
        // To find out the proper values for them. these other values are needed:
        // * position of the caret inside the canvas
        // * size of the caret
        // * size of the canvas

        caretRect = getCaretClientRectWithMargin(span, {
            top: verticalMargin,
            left: horizontalMargin,
            bottom: verticalMargin,
            right: horizontalMargin
        });
        canvasContainerRect = canvasContainerElement.getBoundingClientRect();

        // Vertical adjustment
        if (caretRect.top < canvasContainerRect.top) {
            canvasContainerElement.scrollTop -= canvasContainerRect.top - caretRect.top;
        } else if (caretRect.bottom > canvasContainerRect.bottom) {
            canvasContainerElement.scrollTop += caretRect.bottom - canvasContainerRect.bottom;
        }

        // Horizontal adjustment
        if (caretRect.left < canvasContainerRect.left) {
            canvasContainerElement.scrollLeft -= canvasContainerRect.left - caretRect.left;
        } else if (caretRect.right > canvasContainerRect.right) {
            canvasContainerElement.scrollLeft += caretRect.right - canvasContainerRect.right;
        }
        updateVerticalCaretAlignment();
    };

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function(callback) {
        avatar.destroy(function(err) {
            if (err) {
                callback(err);
            } else {
                cursorNode.removeChild(span);
                callback();
            }
        });
    };
    
    function init() {
        var dom = cursor.getOdtDocument().getDOM(),
            htmlns = dom.documentElement.namespaceURI;
        span = dom.createElementNS(htmlns, "span");
        span.style.top = DEFAULT_CARET_TOP;
        cursorNode = cursor.getNode();
        cursorNode.appendChild(span);
        avatar = new gui.Avatar(cursorNode, avatarInitiallyVisible);
        updateVerticalCaretAlignment();
    }
    init();
};
