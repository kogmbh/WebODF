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
           @type{!string}*/
        xmlns = odf.Namespaces.xmlns,
        /**@const
           @type{!string}*/
        helperns = "urn:webodf:names:helper",
        /**@const
           @type{!string}*/
        listCounterIdSuffix = "webodf-listLevel",
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
     * Appends the rule into the stylesheets and logs any errors that occur
     * @param {!CSSStyleSheet} styleSheet
     * @param {!string} rule
     * @return {undefined}
     */
    function appendRule(styleSheet, rule) {
        try {
            styleSheet.insertRule(rule, styleSheet.cssRules.length);
        } catch (/**@type{!DOMException}*/e) {
            runtime.log("cannot load rule: " + rule + " - " + e);
        }
    }

    /**
     * Holds the current state of parsing the text:list elements in the DOM
     * @param {!Object.<!string, !string>} contentRules
     * @param {!Array.<!string>} continuedCounterIdStack
     * @constructor
     * @struct
     */
    function ParseState(contentRules, continuedCounterIdStack) {
        /**
         * The number of list counters created for a list
         * This is just a number appended to the list counter identifier to make it unique within the list
         * @type {!number}
         */
        this.listCounterCount = 0;

        /**
         * The CSS generated content rule keyed by list level
         * @type {!Object.<!string, !string>}
         */
        this.contentRules = contentRules;

        /**
         * The stack of counters for the list being processed
         * @type {!Array.<!string>}
         */
        this.counterIdStack = [];

        /**
         * The stack of counters the list should continue from if any
         * @type {!Array.<!string>}
         */
        this.continuedCounterIdStack = continuedCounterIdStack;
    }

    /**
     * Assigns globally unique CSS list counters to each text:list element in the document.
     * The reason a global list counter is required is due to how the scope of CSS counters works
     * which is described here http://www.w3.org/TR/CSS21/generate.html#scope
     *
     * The relevant part is that the scope of the counter applies to the element that the counter-reset rule
     * was applied to and any children or siblings of that element. Applying another counter-reset rule to the
     * same counter resets this scope and previous values of the counter are lost. These values are also inaccessible
     * if we inspect the value of the counter outside of the scope and we simply get the default value of zero.
     *
     * The above is important for the case of continued numbering combined with multi-level list numbering.
     * Multi-level lists use a separate counter for each list level and joins each counter value together.
     * Continued numbering takes the list counter from the list we want to continue and uses it for the list
     * that is being continued. Combining these two we get the approach of taking the list counter at each list level
     * from the list that is being continued and then using these counters at each level in the continued list.
     *
     * However the scope rules prevent us from continuing counters at any level deeper than the first level and
     * this behaviour is illustrated in an example of some list content below.
     * <office:document>
     *     <text:list>
     *         <text:list-item> counter: level1 value: 1
     *             <text:list>
     *                 <text:list-item><text:p>Item</text:p></text:list-item> counter: level2 value: 1
     *             </text:list>
     *         </text:list-item>
     *     </text:list>
     *     other doc content
     *     <text:list text:continue-numbering="true">
     *         <text:list-item>
     *             <text:list>
     *                 <text:list-item><text:p>Item</text:p></text:list-item> counter: level2 value: 0
     *             </text:list>
     *         </text:list-item>
     *     </text:list>
     * </office:document>
     *
     * The solution to this was to hoist the counter initialisation up to the document level so that the counter
     * scope applies to all lists in the document. Then each text:list element is given a unique counter by default.
     * Having unique counters is only really required for continuing a list based on its xml:id but having it for
     * all lists makes the code simpler and reduces the amount of CSS rules being overridden. Hence we end up with a
     * list counter setup as below.
     * <office:document> counter-reset: list1-1 list1-2
     *     <text:list>
     *         <text:list-item> counter: list1-1 value: 1
     *             <text:list>
     *                 <text:list-item><text:p>Item</text:p></text:list-item> counter: list1-2 value: 1
     *             </text:list>
     *         </text:list-item>
     *     </text:list>
     *     other doc content
     *     <text:list text:continue-numbering="true">
     *         <text:list-item>
     *             <text:list>
     *                 <text:list-item><text:p>Item</text:p></text:list-item> counter: list1-2 value: 2
     *             </text:list>
     *         </text:list-item>
     *     </text:list>
     * </office:document>
     *
     * @param {!CSSStyleSheet} styleSheet
     * @constructor
     */
    function UniqueListCounter(styleSheet) {
        var /**@type{!number}*/
            customListIdIndex = 0,
            /**@type{!string}*/
            globalCounterResetRule = "",
            /**@type{!Object.<!string,!Array.<!string>>}*/
            counterIdStacks = {};

        /**
         * Gets the stack of list counters for the given list.
         * Counter stacks are keyed by the list counter id of the first list level.
         * Returns a deep copy of the counter stack so it can be modified
         * @param {!Element|undefined} list
         * @return {!Array.<!string>}
         */
        function getCounterIdStack(list) {
            var counterId,
                stack = [];

            if (list) {
                counterId = list.getAttributeNS(helperns, "counter-id");
                stack = counterIdStacks[counterId].slice(0);
            }
            return stack;
        }

        /**
         * Assigns a unique global CSS list counter to this text:list element
         * @param {!string} topLevelListId This is used to generate a unique identifier for this element
         * @param {!Element} listElement This is always a text:list element
         * @param {!number} listLevel
         * @param {!ParseState} parseState
         * @return {undefined}
         */
        function createCssRulesForList(topLevelListId, listElement, listLevel, parseState) {
            var /**@type{!string}*/
                newListSelectorId,
                newListCounterId,
                newRule,
                contentRule,
                i;

            // increment counters and create a new identifier for this text:list element
            // this identifier will be used as the CSS counter name if this list is not continuing another list
            parseState.listCounterCount += 1;
            newListSelectorId = topLevelListId + "-level" + listLevel + "-" + parseState.listCounterCount;
            listElement.setAttributeNS(helperns, "counter-id", newListSelectorId);

            // if we need to continue from a previous list then get the counter from the stack
            // of the continued list and use it as the counter for this list element
            newListCounterId = parseState.continuedCounterIdStack.shift();
            if (!newListCounterId) {
                newListCounterId = newListSelectorId;

                // add the newly created counter to the counter reset rule so it can be
                // initialised later once we have parsed all the lists in the document.
                // In the case of a multi-level list with no items the counter increment rule
                // will not apply. To fix this issue we initialise the counters to a value of 1
                // instead of the default of 0.
                globalCounterResetRule += newListSelectorId + ' 1 ';

                // CSS counters increment the value before displaying the rendered list label. This is not an issue but as
                // we initialise the counters to a value of 1 above to handle lists with no list items it means that
                // lists that actually have list items will all start with the counter value of 2 which is not desirable.
                // To fix this we apply another CSS rule here that overrides the counter increment rule above and
                // prevents incrementing the counter on the FIRST list item that has content (AKA a visible list label).
                newRule = 'text|list[webodfhelper|counter-id="' + newListSelectorId + '"]';
                newRule += ' > text|list-item:first-child > :not(text|list):first-child:before';
                newRule += '{';
                // Due to https://bugs.webkit.org/show_bug.cgi?id=84985 a value of "none" is ignored by some version of WebKit
                // (specifically the ones shipped with the Cocoa frameworks on OSX 10.7 + 10.8).
                // Override the counter-increment on this counter by name to workaround this
                newRule += 'counter-increment: ' + newListCounterId + ' 0;';
                newRule += '}';
                appendRule(styleSheet, newRule);
            }

            // remove any counters from the stack that are deeper than the current list level
            // and push the newly created or continued counter on to the stack
            while (parseState.counterIdStack.length >= listLevel) {
                parseState.counterIdStack.pop();
            }
            parseState.counterIdStack.push(newListCounterId);

            // substitute the unique list counters in for each level up to the current one
            // this only replaces the first occurrence in the string as the generated rule
            // will have a different counter for each list level and multi level counter rules
            // are created by joining counters from different levels together
            contentRule = parseState.contentRules[listLevel.toString()] || "";
            for (i = 1; i <= listLevel; i += 1) {
                contentRule = contentRule.replace(i + listCounterIdSuffix, parseState.counterIdStack[i - 1]);
            }

            // Apply the counter increment to EVERY list item in this list that has content (AKA a visible list label)
            newRule = 'text|list[webodfhelper|counter-id="' + newListSelectorId + '"]';
            newRule += ' > text|list-item > :not(text|list):first-child:before';
            newRule += '{';
            newRule += contentRule;
            newRule += 'counter-increment: ' + newListCounterId + ';';
            newRule += '}';
            appendRule(styleSheet, newRule);
        }

        /**
         * Takes an element and parses it and its subtree for any text:list elements.
         * The text:list elements then have CSS rules applied that give each one
         * a unique global CSS counter for the purpose of list numbering.
         * @param {!string} topLevelListId
         * @param {!Element} element
         * @param {!number} listLevel
         * @param {!ParseState} parseState
         * @return {undefined}
         */
        function iterateOverChildListElements(topLevelListId, element, listLevel, parseState) {
            var isListElement = element.namespaceURI === textns && element.localName === "list",
                isListItemElement = element.namespaceURI === textns && element.localName === "list-item",
                childElement;

            // don't continue iterating over elements that aren't text:list or text:list-item
            if (!isListElement && !isListItemElement) {
                parseState.continuedCounterIdStack = [];
                return;
            }

            if (isListElement) {
                listLevel += 1;
                createCssRulesForList(topLevelListId, element, listLevel, parseState);
            }

            childElement = element.firstElementChild;
            while (childElement) {
                iterateOverChildListElements(topLevelListId, childElement, listLevel, parseState);
                childElement = childElement.nextElementSibling;
            }
        }

        /**
         * Takes a text:list element and creates CSS counter rules used for numbering
         * @param {!Object.<!string, !string>} contentRules
         * @param {!Element} list
         * @param {!Element=} continuedList
         * @return {undefined}
         */
        this.createCounterRules = function (contentRules, list, continuedList) {
            var /**@type{!string}*/
                listId = list.getAttributeNS(xmlns, "id"),
                currentParseState = new ParseState(contentRules, getCounterIdStack(continuedList));

            // ensure there is a unique identifier for each list if it does not have one
            if (!listId) {
                customListIdIndex += 1;
                listId = "X" + customListIdIndex;
            } else {
                listId = "Y" + listId;
            }

            iterateOverChildListElements(listId, list, 0, currentParseState);

            counterIdStacks[listId + "-level1-1"] = currentParseState.counterIdStack;
        };

        /**
         * Initialises all CSS counters created so far by this UniqueListCounter with a counter-reset rule.
         * Calling this method twice will cause the previous counter reset CSS rule to be overridden
         * @return {undefined}
         */
        this.initialiseCreatedCounters = function () {
            var newRule;

            newRule = 'office|document';
            newRule += '{';
            newRule += 'counter-reset: ' + globalCounterResetRule + ';';
            newRule += "}";
            appendRule(styleSheet, newRule);
        };
    }

    /**
     * @constructor
     */
    odf.ListStyleToCss = function ListStyleToCss() {

        var cssUnits = new core.CSSUnits(),
            odfUtils = odf.OdfUtils;

        /**
         * Takes a value with a valid CSS unit and converts it to a CSS pixel value
         * @param {!string} value
         * @return {!number}
         */
        function convertToPxValue(value) {
            var parsedLength = odfUtils.parseLength(value);
            if (!parsedLength) {
                runtime.log("Could not parse value '" + value + "'.");
                // Return 0 as fallback, might have least bad results if used
                return 0;
            }
            return cssUnits.convert(parsedLength.value, parsedLength.unit, "px");
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
         * Determines whether the list element style-name matches the style-name we require
         * @param {!Element|undefined} list
         * @param {!string} matchingStyleName
         * @return {!boolean}
         */
        function isMatchingListStyle(list, matchingStyleName) {
            var styleName;
            if (list) {
                styleName = list.getAttributeNS(textns, "style-name");
            }
            return styleName === matchingStyleName;
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
                content = "",
                textLevel = node.getAttributeNS(textns, "level"),
                displayLevels = node.getAttributeNS(textns, "display-levels");
            if (prefix) {
                // Content needs to be on a new line if it contains slashes due to a bug in older versions of webkit
                // E.g., the one used in the qt runtime tests - https://bugs.webkit.org/show_bug.cgi?id=35010
                content += '"' + escapeCSSString(prefix) + '"\n';
            }
            if (stylemap.hasOwnProperty(style)) {
                textLevel = textLevel ? parseInt(textLevel, 10) : 1;
                displayLevels = displayLevels ? parseInt(displayLevels, 10) : 1;

                // as we might want to display a subset of the counters
                // we assume a different counter for each list level
                // and concatenate them for multi level lists
                // https://wiki.openoffice.org/wiki/Number_labels
                while (displayLevels > 0) {
                    content += " counter(" + (textLevel - displayLevels + 1) + listCounterIdSuffix + "," + stylemap[style] + ")";
                    if (displayLevels > 1) {
                        content += '"."';
                    }
                    displayLevels -= 1;
                }
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
         * Gets the CSS generated content rule for the list style
         * @param {!Element} node
         * @return {!string}
         */
        function getContentRule(node) {
            var contentRule = "",
                listLevelProps,
                listLevelPositionSpaceMode,
                listLevelLabelAlign,
                followedBy;

            if (node.localName === "list-level-style-number") {
                contentRule = getNumberRule(node);
            } else if (node.localName === "list-level-style-image") {
                contentRule = getImageRule();
            } else if (node.localName === "list-level-style-bullet") {
                contentRule = getBulletRule(node);
            }

            listLevelProps = /**@type{!Element}*/(node.getElementsByTagNameNS(stylens, "list-level-properties")[0]);
            if (listLevelProps) {
                listLevelPositionSpaceMode = listLevelProps.getAttributeNS(textns, "list-level-position-and-space-mode");

                if (listLevelPositionSpaceMode === "label-alignment") {
                    listLevelLabelAlign = /**@type{!Element}*/(listLevelProps.getElementsByTagNameNS(stylens, "list-level-label-alignment")[0]);
                    if (listLevelLabelAlign) {
                        followedBy = listLevelLabelAlign.getAttributeNS(textns, "label-followed-by");
                    }

                    if (followedBy === "space") {
                        contentRule += ' "\\a0"';
                    }
                }
            }

            // Content needs to be on a new line if it contains slashes due to a bug in older versions of webkit
            // E.g., the one used in the qt runtime tests - https://bugs.webkit.org/show_bug.cgi?id=35010
            return '\n' + contentRule + ';\n';
        }

        /**
         * Takes a text:list-style element and returns the generated CSS
         * content rules for each list level in the list style
         * @param {!Element} listStyleNode
         * @return {!Object.<!string, !string>}
         */
        function getAllContentRules(listStyleNode) {
            var childNode = listStyleNode.firstElementChild,
                level,
                rules = {};

            while (childNode) {
                level = childNode.getAttributeNS(textns, "level");
                level = level && parseInt(level, 10);
                rules[level] = getContentRule(childNode);
                childNode = childNode.nextElementSibling;
            }
            return rules;
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
         * @return {undefined}
         */
        function addListStyleRule(styleSheet, name, node) {
            var selector = 'text|list[text|style-name="' + name + '"]',
                level = node.getAttributeNS(textns, "level"),
                selectorLevel,
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

            // style:list-level-properties is an optional element. Since the rest of this function
            // depends on its existence, return from it if it is not found.
            listLevelProps = /**@type{!Element|undefined}*/(node.getElementsByTagNameNS(stylens, "list-level-properties")[0]);
            listLevelPositionSpaceMode = listLevelProps && listLevelProps.getAttributeNS(textns, "list-level-position-and-space-mode");
            listLevelLabelAlign = /**@type{!Element|undefined}*/(listLevelProps) &&
                                  /**@type{!Element|undefined}*/(listLevelProps.getElementsByTagNameNS(stylens, "list-level-label-alignment")[0]);

            // calculate CSS selector based on list level
            level = level && parseInt(level, 10);
            selectorLevel = level;
            while (selectorLevel > 1) {
                selector += ' > text|list-item > text|list';
                selectorLevel -= 1;
            }

            // TODO: fo:text-align is only an optional attribute with <style:list-level-properties>,
            // needs to be found what should be done if not present. For now falling back to "left"
            textAlign = (listLevelProps && listLevelProps.getAttributeNS(fons, "text-align")) || "left";
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

            // get relevant properties from the style based on the list label positioning mode
            if (listLevelPositionSpaceMode === "label-alignment") {
                // TODO: fetch the margin and indent from the paragraph style if it is defined there
                // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#element-style_list-level-label-alignment
                // for now just fallback to "0px" if not defined on <style:list-level-label-alignment>
                listIndent = (listLevelLabelAlign && listLevelLabelAlign.getAttributeNS(fons, "margin-left")) || "0px";
                bulletIndent = (listLevelLabelAlign && listLevelLabelAlign.getAttributeNS(fons, "text-indent")) || "0px";
                followedBy = listLevelLabelAlign && listLevelLabelAlign.getAttributeNS(textns, "label-followed-by");
                leftOffset = convertToPxValue(listIndent);

            } else {
                // this block is entered if list-level-position-and-space-mode
                // has the value label-width-and-position or is not present
                // TODO: fallback values should be read from parent styles or (system) defaults
                listIndent = (listLevelProps && listLevelProps.getAttributeNS(textns, "space-before")) || "0px";
                bulletWidth = (listLevelProps && listLevelProps.getAttributeNS(textns, "min-label-width")) || "0px";
                labelDistance = (listLevelProps && listLevelProps.getAttributeNS(textns, "min-label-distance")) || "0px";
                leftOffset = convertToPxValue(listIndent) + convertToPxValue(bulletWidth);
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
            listItemRule = selector + ' > text|list-item > :not(text|list):first-child:before';
            listItemRule += '{';
            listItemRule += 'text-align: ' + textAlign + ';';
            listItemRule += 'display: inline-block;';

            if (listLevelPositionSpaceMode === "label-alignment") {
                listItemRule += 'margin-left: ' + bulletIndent + ';';
                if (followedBy === "listtab") {
                    // TODO: remove this padding once text:label-followed-by="listtab" is implemented
                    // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#attribute-text_label-followed-by
                    listItemRule += 'padding-right: 0.2cm;';
                }
            } else {
                listItemRule += 'min-width: ' + bulletWidth + ';';
                listItemRule += 'margin-left: ' + (parseFloat(bulletWidth) === 0 ? '' : '-') + bulletWidth + ';';
                listItemRule += 'padding-right: ' + labelDistance + ';';
            }
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
            var n = node.firstElementChild;
            while (n) {
                if (n.namespaceURI === textns) {
                    addListStyleRule(styleSheet, name, n);
                }
                n = n.nextElementSibling;
            }
        }

        /**
         * Adds new CSS rules based on any properties in
         * the ODF list content if they affect the final style
         * @param {!CSSStyleSheet} styleSheet
         * @param {!Element} odfBody
         * @param {!Object.<!string, !odf.StyleTreeNode>} listStyles
         * @return {undefined}
         */
        function applyContentBasedStyles(styleSheet, odfBody, listStyles) {
            var lists = odfBody.getElementsByTagNameNS(textns, "list"),
                listCounter = new UniqueListCounter(styleSheet),
                list,
                previousList,
                continueNumbering,
                continueListXmlId,
                xmlId,
                styleName,
                contentRules,
                listsWithXmlId = {},
                i;

            for (i = 0; i < lists.length; i += 1) {
                list = /**@type{!Element}*/(lists.item(i));
                styleName = list.getAttributeNS(textns, "style-name");

                // TODO: Handle default list style
                // lists that have no text:style-name attribute defined and do not have a parent text:list that
                // defines a style name use a default implementation defined style as per the spec
                // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#attribute-text_style-name_element-text_list

                // lists that have no text:style-name attribute defined but do have a parent list that defines a
                // style name will inherit that style and will be handled correctly as any text:list with a style defined
                // will have CSS rules applied to its child text:list elements
                if (styleName) {
                    continueNumbering = list.getAttributeNS(textns, "continue-numbering");
                    continueListXmlId = list.getAttributeNS(textns, "continue-list");
                    xmlId = list.getAttributeNS(xmlns, "id");

                    // store the list keyed by the xml:id
                    if (xmlId) {
                        listsWithXmlId[xmlId] = list;
                    }

                    contentRules = getAllContentRules(listStyles[styleName].element);

                    // lists with different styles cannot be continued
                    // https://tools.oasis-open.org/issues/browse/OFFICE-3558
                    if (continueNumbering && !continueListXmlId && isMatchingListStyle(previousList, styleName)) {
                        listCounter.createCounterRules(contentRules, list, previousList);
                    } else if (continueListXmlId && isMatchingListStyle(listsWithXmlId[continueListXmlId], styleName)) {
                        listCounter.createCounterRules(contentRules, list, listsWithXmlId[continueListXmlId]);
                    } else {
                        listCounter.createCounterRules(contentRules, list);
                    }
                    previousList = list;
                }
            }

            listCounter.initialiseCreatedCounters();
        }

        /**
         * Creates CSS styles from the given ODF list styles and applies them to the stylesheet
         * @param {!CSSStyleSheet} styleSheet
         * @param {!odf.StyleTree.Tree} styleTree
         * @param {!Element} odfBody
         * @return {undefined}
         */
        this.applyListStyles = function (styleSheet, styleTree, odfBody) {
            var styleFamilyTree,
                node;

            /*jslint sub:true*/
            // The available families are defined in StyleUtils.familyNamespacePrefixes.
            styleFamilyTree = (styleTree["list"]);
            /*jslint sub:false*/
            if (styleFamilyTree) {
                Object.keys(styleFamilyTree).forEach(function (styleName) {
                    node = /**@type{!odf.StyleTreeNode}*/(styleFamilyTree[styleName]);
                    addRule(styleSheet, styleName, node.element);
                });
            }

            applyContentBasedStyles(styleSheet, odfBody, styleFamilyTree);
        };
    };
}());

