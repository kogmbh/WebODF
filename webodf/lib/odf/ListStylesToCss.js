/**
 * @license
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


/*global odf, core, runtime*/

(function () {
    "use strict";

    var /**@const
           @type{!string}*/
        fons = odf.Namespaces.fons,
        /**@const
           @type{!string}*/
        stylens = odf.Namespaces.stylens,
        /**@const
           @type{!string}*/
        textns = odf.Namespaces.textns,
        /**@const
           @type{!Object.<string,string>}*/
        stylemap = {
            '1': 'decimal',
            'a': 'lower-latin',
            'A': 'upper-latin',
            'i': 'lower-roman',
            'I': 'upper-roman'
        };

    /**
     * @constructor
     */
    odf.ListStyleToCss = function ListStyleToCss() {

        var cssUnits = new core.CSSUnits(),
            odfUtils = new odf.OdfUtils();

        /**
         * Takes a value with a valid CSS unit and converts it to a CSS pixel value
         * @param {!string} value
         * @return {!number}
         */
        function convertToPxValue(value) {
            var parsedLength = odfUtils.parseLength(value);
            if (!parsedLength) {
                runtime.log("Could not parse value '"+value+"'.");
                // Return 0 as fallback, might have least bad results if used
                return 0;
            }
            return cssUnits.convert(parsedLength.value, parsedLength.unit, "px");
        }

        /**
         * Appends the rule into the stylesheets and logs any errors that occur
         * @param {!CSSStyleSheet} styleSheet
         * @param {!string} rule
         */
        function appendRule(styleSheet, rule) {
            try {
                styleSheet.insertRule(rule, styleSheet.cssRules.length);
            } catch (/**@type{!DOMException}*/e) {
                runtime.log("cannot load rule: " + rule + " - " + e);
            }
        }

        /**
         * Return the supplied value with any backslashes escaped, and double-quotes escaped
         * @param {!string} value
         * @return {!string}
         */
        function escapeCSSString(value) {
            return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
        }

        /**
         * Gets the CSS content for a numbered list
         * @param {!Element} node
         * @return {!string}
         */
        function getNumberRule(node) {
            var style = node.getAttributeNS(stylens, "num-format"),
                /**@type{!string}*/
                suffix = node.getAttributeNS(stylens, "num-suffix") || "",
                /**@type{!string}*/
                prefix = node.getAttributeNS(stylens, "num-prefix") || "",
                /**@type{!string}*/
                content = "";
            if (prefix) {
                // Content needs to be on a new line if it contains slashes due to a bug in older versions of webkit
                // E.g., the one used in the qt runtime tests - https://bugs.webkit.org/show_bug.cgi?id=35010
                content += '"' + escapeCSSString(prefix) + '"\n';
            }
            if (stylemap.hasOwnProperty(style)) {
                content += " counter(list, " + stylemap[style] + ")";
            } else if (style) {
                content += ' "' + style + '"';
            } else {
                content += ' ""';
            }
            return 'content:' + content + ' "' + escapeCSSString(suffix) + '"';
        }

        /**
         * Gets the CSS content for a image bullet list
         * @return {!string}
         */
        function getImageRule() {
            return "content: none";
        }

        /**
         * Gets the CSS content for a bullet list
         * @param {!Element} node
         * @return {!string}
         */
        function getBulletRule(node) {
            var bulletChar = node.getAttributeNS(textns, "bullet-char");
            return 'content: "' + escapeCSSString(bulletChar) + '"';
        }

        /**
         * In label-width-and-position mode of specifying list layout the margin and indent specified in
         * the paragraph style is additive to the layout specified in the list style.
         *
         *   fo:margin-left    text:space-before    fo:text-indent  +-----------+
         * +---------------->+------------------>+----------------->|   label   |     LIST TEXT
         *                                                          +-----------+
         * +---------------->+------------------>+-------------------->LIST TEXT LIST TEXT LIST TEXT
         *                                        text:min-label-width
         *
         * To get this additive behaviour we calculate an offset from the left side of the page which is
         * the space-before +  min-label-width. We then apply this offset to each text:list-item
         * element and apply the negative value of the offset to each text:list element. This allows the positioning
         * provided in the list style to apply relative to the paragraph style as we desired. Then on each
         * ::before pseudo-element which holds the label we apply the negative value of the min-label-width to complete
         * the alignment from the left side of the page. We then apply the min-label-distance as padding to the right
         * of the ::before psuedo-element to complete the list label placement.
         *
         * For the label-alignment mode the paragraph style overrides the list style but we specify offsets for
         * the text:list and text:list-item elements to keep the code consistent between the modes
         *
         * Diagram and implementation based on: https://wiki.openoffice.org/wiki/Number_layout
         *
         * @param {!CSSStyleSheet} styleSheet
         * @param {!string} name
         * @param {!Element} node
         * @param {!string} itemRule
         * @return {undefined}
         */
        function addListStyleRule(styleSheet, name, node, itemRule) {
            var selector = 'text|list[text|style-name="' + name + '"]',
                level = node.getAttributeNS(textns, "level"),
                listItemRule,
                listLevelProps,
                listLevelPositionSpaceMode,
                listLevelLabelAlign,
                listIndent,
                textAlign,
                bulletWidth,
                labelDistance,
                bulletIndent,
                followedBy,
                leftOffset;

            // calculate CSS selector based on list level
            level = level && parseInt(level, 10);
            while (level > 1) {
                selector += ' > text|list-item > text|list';
                level -= 1;
            }

            // TODO: fo:text-align is only an optional attribute with <style:list-level-properties>,
            // needs to be found what should be done if not present. For now falling back to "left"
            listLevelProps = /**@type{!Element}*/(node.getElementsByTagNameNS(stylens, "list-level-properties")[0]);
            if (listLevelProps) {
                listLevelPositionSpaceMode = listLevelProps.getAttributeNS(textns, "list-level-position-and-space-mode");
                textAlign = listLevelProps.getAttributeNS(fons, "text-align") || "left";
                // get relevant properties from the style based on the list label positioning mode
                if (listLevelPositionSpaceMode === "label-alignment") {
                    // TODO: fetch the margin and indent from the paragraph style if it is defined there
                    // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#element-style_list-level-label-alignment
                    // for now just fallback to "0px" if not defined on <style:list-level-label-alignment>
                    listLevelLabelAlign = /**@type{!Element}*/(listLevelProps.getElementsByTagNameNS(stylens, "list-level-label-alignment")[0]);
                    listIndent = listLevelLabelAlign.getAttributeNS(fons, "margin-left") || "0px";
                    bulletIndent = listLevelLabelAlign.getAttributeNS(fons, "text-indent") || "0px";
                    followedBy = listLevelLabelAlign.getAttributeNS(textns, "label-followed-by");
                    leftOffset = convertToPxValue(listIndent);
                } else {
                    // this block is entered if list-level-position-and-space-mode
                    // has the value label-width-and-position or is not present
                    // TODO: fallback values should be read from parent styles or (system) defaults
                    listIndent = listLevelProps.getAttributeNS(textns, "space-before") || "0px";
                    bulletWidth = listLevelProps.getAttributeNS(textns, "min-label-width") || "0px";
                    labelDistance = listLevelProps.getAttributeNS(textns, "min-label-distance") || "0px";
                    leftOffset = convertToPxValue(listIndent) + convertToPxValue(bulletWidth);
                }
            } else {
                listIndent = "0px";
                bulletWidth = "0px";
                labelDistance = "0px";
                leftOffset = convertToPxValue(listIndent) + convertToPxValue(bulletWidth);
            }
            // convert the start and end text alignments to left and right as
            // IE does not support the start and end values for text alignment
            switch (textAlign) {
                case "end":
                    textAlign = "right";
                    break;
                case "start":
                    textAlign = "left";
                    break;
            }

            listItemRule = selector + ' > text|list-item';
            listItemRule += '{';
            listItemRule += 'margin-left: ' + leftOffset + 'px;';
            listItemRule += '}';
            appendRule(styleSheet, listItemRule);

            listItemRule = selector + ' > text|list-item > text|list';
            listItemRule += '{';
            listItemRule += 'margin-left: ' + (-leftOffset) + 'px;';
            listItemRule += '}';
            appendRule(styleSheet, listItemRule);

            // insert the list label before every immediate child of the list-item, except for lists
            listItemRule = selector + ' > text|list-item > *:not(text|list):first-child:before';
            listItemRule += '{';
            listItemRule += 'text-align: ' + textAlign + ';';
            listItemRule += 'counter-increment:list;';
            listItemRule += 'display: inline-block;';

            if (listLevelPositionSpaceMode === "label-alignment") {
                listItemRule += 'margin-left: ' + bulletIndent + ';';
                if (followedBy === "space") {
                    itemRule += ' \'\\a0\'';
                } else if (followedBy === "listtab") {
                    // TODO: remove this padding once text:label-followed-by="listtab" is implemented
                    // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#attribute-text_label-followed-by
                    listItemRule += 'padding-right: 0.2cm;';
                }
            } else {
                listItemRule += 'min-width: ' + bulletWidth + ';';
                listItemRule += 'margin-left: -' + bulletWidth + ';';
                listItemRule += 'padding-right: ' + labelDistance + ';';
            }
            // Content needs to be on a new line if it contains slashes due to a bug in older versions of webkit
            // E.g., the one used in the qt runtime tests - https://bugs.webkit.org/show_bug.cgi?id=35010
            listItemRule += "\n" + itemRule + ';\n';
            listItemRule += '}';
            appendRule(styleSheet, listItemRule);
        }

        /**
         * Adds a CSS rule for every ODF list style
         * @param {!CSSStyleSheet} styleSheet
         * @param {!string} name
         * @param {!Element} node
         * @return {undefined}
         */
        function addRule(styleSheet, name, node) {
            var n = node.firstChild, e, itemrule;
            while (n) {
                if (n.namespaceURI === textns) {
                    e = /**@type{!Element}*/(n);
                    if (n.localName === "list-level-style-number") {
                        itemrule = getNumberRule(e);
                        addListStyleRule(styleSheet, name, e, itemrule);
                    } else if (n.localName === "list-level-style-image") {
                        itemrule = getImageRule();
                        addListStyleRule(styleSheet, name, e, itemrule);
                    } else if (n.localName === "list-level-style-bullet") {
                        itemrule = getBulletRule(e);
                        addListStyleRule(styleSheet, name, e, itemrule);
                    }
                }
                n = n.nextSibling;
            }
        }

        /**
         * Creates CSS styles from the given ODF list styles and applies them to the stylesheet
         * @param {!CSSStyleSheet} stylesheet
         * @param {!odf.StyleTree.Tree} styleTree
         * @return {undefined}
         */
        this.applyListStyles = function (stylesheet, styleTree) {
            var styleFamilyTree,
                node;

            /*jslint sub:true*/
            // The available families are defined in StyleUtils.familyNamespacePrefixes.
            styleFamilyTree = (styleTree["list"]);
            /*jslint sub:false*/
            if (styleFamilyTree) {
                Object.keys(styleFamilyTree).forEach(function (styleName) {
                    node = /**@type{!odf.StyleTreeNode}*/(styleFamilyTree[styleName]);
                    addRule(stylesheet, styleName, node.element);
                });
            }
        };
    };
}());