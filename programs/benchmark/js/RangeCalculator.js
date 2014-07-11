/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global define, runtime, odf, document, Node*/

define([], function() {
    "use strict";

    runtime.loadClass("odf.OdfUtils");

    /**
     * @constructor
     */
    function RangeCalculator() {
        var odfUtils = new odf.OdfUtils(),
            textRange = document.createRange(),
            TEXT_NODE = Node.TEXT_NODE;

        /**
         * Calculate the amount of horizontal movement experienced while traversing
         * the supplied range.
         * @param {!Range} range
         * @return {!number}
         */
        this.measureTraversedDistance = function (range) {
            var textElements = odfUtils.getTextElements(range, true, false),
                horizontalDistance = 0;

            textElements.forEach(function(node) {
                var clientRects,
                    i,
                    rect;

                if (node.nodeType === TEXT_NODE) {
                    textRange.selectNodeContents(node);
                    if (range.startContainer === node) {
                        textRange.setStart(range.startContainer, range.startOffset);
                    }
                    if (range.endContainer === node) {
                        range.setEnd(range.endContainer, range.endOffset);
                    }
                    clientRects = textRange.getClientRects();
                } else {
                    clientRects = node.getClientRects();
                }
                for (i = 0; i < clientRects.length; i += 1) {
                    rect = clientRects[i];
                    horizontalDistance += rect.width;
                }
            });

            return horizontalDistance;
        };
    }

    return RangeCalculator;

});
