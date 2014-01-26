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

/*global Node, runtime, odf, NodeFilter, core*/

runtime.loadClass("core.DomUtils");
runtime.loadClass("odf.Namespaces");

/**
 * @constructor
 */
odf.OdfUtils = function OdfUtils() {
    "use strict";

    var /**@const
           @type{!string}*/
        textns = odf.Namespaces.textns,
        /**@const
           @type{!string}*/
        drawns = odf.Namespaces.drawns,
        /**@const
           @type{!string}*/
        xlinkns = odf.Namespaces.xlinkns,
        /**@const
           @type{!RegExp}*/
        whitespaceOnly = /^\s*$/,
        domUtils = new core.DomUtils();

    /**
     * Determine if the node is a draw:image element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isImage(e) {
        var name = e && e.localName;
        return name === "image" && e.namespaceURI === drawns;
    }
    this.isImage = isImage;

    /**
     * Determine if the node is a draw:frame element and has its text:anchor-type attribute set to 'as-char'.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isCharacterFrame(e) {
        // TODO the anchor-type can be defined on any style associated with the frame
        return e !== null && e.nodeType === Node.ELEMENT_NODE
            && e.localName === "frame" && e.namespaceURI === drawns
            && /**@type{!Element}*/(e).getAttributeNS(textns, "anchor-type")
                === "as-char";
    }
    this.isCharacterFrame = isCharacterFrame;

    /**
     * Determine if the node is an office:annotation element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isAnnotation(e) {
        var name = e && e.localName;
        return name === "annotation" && e.namespaceURI === odf.Namespaces.officens;
    }

    /**
     * Determine if the node is an annotation wrapper element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isAnnotationWrapper(e) {
        var name = e && e.localName;
        return name === "div" && /**@type{!HTMLDivElement}*/(e).className === "annotationWrapper";
    }

    /**
     * Determine if the node is an inline 'root' type,
     * i.e. an office:annotation or a wrapper for an annotaiton.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isInlineRoot(e) {
        return isAnnotation(e)
            || isAnnotationWrapper(e);
    }
    this.isInlineRoot = isInlineRoot;

    /**
     * Determine if the node is a text:span element.
     * @param {?Node} e
     * @return {!boolean}
     */
    this.isTextSpan = function (e) {
        var name = e && e.localName;
        return name === "span" && e.namespaceURI === textns;
    };

    /**
     * Determine if the node is a text:a element.
     * @param {?Node} node
     * @return {!boolean}
     */
    function isHyperlink(node) {
        var name = node && node.localName;
        return name === "a" && node.namespaceURI === textns;
    }
    this.isHyperlink = isHyperlink;

    /**
     * Gets the href attribute of text:a element
     * @param {!Element} element
     * @return {?string}
     */
    this.getHyperlinkTarget = function (element) {
        return element.getAttributeNS(xlinkns, 'href');
    };

    /**
     * Determine if the node is a text:p or a text:h element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isParagraph(e) {
        var name = e && e.localName;
        return (name === "p" || name === "h") && e.namespaceURI === textns;
    }
    this.isParagraph = isParagraph;

    /**
     * @param {?Node} node
     * @return {?Node}
     */
    function getParagraphElement(node) {
        while (node && !isParagraph(node)) {
            node = node.parentNode;
        }
        return node;
    }
    this.getParagraphElement = getParagraphElement;

    /**
     * Returns true if the specified node is contained within a text:tracked-changes parent
     * @param {Node} node Node to start searching from
     * @param {!Node} container Root container to stop searching at. This helps set the boundary of the current
     *  search and will usually be the root level element node (e.g., office:text, office:presentation, etc.)
     * @returns {!boolean}
     */
    this.isWithinTrackedChanges = function (node, container) {
        while (node && node !== container) {
            if (node.namespaceURI === textns && node.localName === 'tracked-changes') {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    };

    /**
     * Determine if the node is a text:list-item element.
     * @param {?Node} e
     * @return {!boolean}
     */
    this.isListItem = function (e) {
        var name = e && e.localName;
        return name === "list-item" && e.namespaceURI === textns;
    };

    /**
     * Determine if the node is a text:line-break element.
     * @param {?Node} e
     * @return {!boolean}
     */
    this.isLineBreak = function (e) {
        var name = e && e.localName;
        return name === "line-break" && e.namespaceURI === textns;
    };

    /**
     * Determine if the text consists entirely of whitespace characters.
     * At least one whitespace is required.
     * @param {!string} text
     * @return {!boolean}
     */
    function isODFWhitespace(text) {
        return (/^[ \t\r\n]+$/).test(text);
    }
    this.isODFWhitespace = isODFWhitespace;

    /**
     * Determine if the node is a grouping element.
     * @param {?Node} n
     * @return {!boolean}
     */
    function isGroupingElement(n) {
        if (n === null || n.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        var e = /**@type{!Element}*/(n),
            localName = e.localName;
        return (/^(span|p|h|a|meta)$/.test(localName)
                && e.namespaceURI === textns)
               || (localName === "span"
                   && e.className === "annotationHighlight");
    }
    this.isGroupingElement = isGroupingElement;
    /**
     * Determine if the node is a character element,
     * namely "s", "tab", or "line-break".
     * @param {?Node} e
     * @return {!boolean}
     */
    function isCharacterElement(e) {
        var n = e && e.localName,
            ns,
            r = false;
        if (n) {
            ns = e.namespaceURI;
            if (ns === textns) {
                r = n === "s" || n === "tab" || n === "line-break";
            }
        }
        return r;
    }
    this.isCharacterElement = isCharacterElement;
    /**
     * Determine if the node is an 'as char' type of element,
     * i.e. any element which behaves like a character with
     * respect to it's surrounding positions, such as the
     * space/tab/line-break elements, draw:frames with
     * anchor type being 'as-char', or inline root elements
     * such as annotations.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isAnchoredAsCharacterElement(e) {
        return isCharacterElement(e) || isCharacterFrame(e) || isInlineRoot(e);
    }
    this.isAnchoredAsCharacterElement = isAnchoredAsCharacterElement;
    /**
     * Determine if the node is a <text:s/> character element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isSpaceElement(e) {
        var n = e && e.localName,
            ns,
            r = false;
        if (n) {
            ns = e.namespaceURI;
            if (ns === textns) {
                r = n === "s";
            }
        }
        return r;
    }
    this.isSpaceElement = isSpaceElement;
    /**
     * @param {!Node} node
     * @return {!Node}
     */
    function firstChild(node) {
        while (node.firstChild !== null && isGroupingElement(node)) {
            node = node.firstChild;
        }
        return node;
    }
    this.firstChild = firstChild;
    /**
     * @param {!Node} node
     * @return {!Node}
     */
    function lastChild(node) {
        while (node.lastChild !== null && isGroupingElement(node)) {
            node = node.lastChild;
        }
        return node;
    }
    this.lastChild = lastChild;
    /**
     * @param {!Node} node
     * @return {?Node}
     */
    function previousNode(node) {
        while (!isParagraph(node) && node.previousSibling === null) {
            node = /**@type{!Node}*/(node.parentNode);
        }
        return isParagraph(node) ? null : lastChild(/**@type{!Node}*/(node.previousSibling));
    }
    this.previousNode = previousNode;
    /**
     * @param {!Node} node
     * @return {?Node}
     */
    function nextNode(node) {
        while (!isParagraph(node) && node.nextSibling === null) {
            node = /**@type{!Node}*/(node.parentNode);
        }
        return isParagraph(node) ? null : firstChild(/**@type{!Node}*/(node.nextSibling));
    }
    this.nextNode = nextNode;

    /**
     * Walk to the left along the DOM and return true if the first thing
     * encountered is either a non-whitespace text character or a non-space
     * character element (i.e., any character element other than <text:s/>).
     * Walking goes through grouping elements.
     * @param {?Node} node the first node to scan
     * @return {!boolean}
     */
    function scanLeftForNonSpace(node) {
        var r = false,
            text;
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                text = /**@type{!Text}*/(node);
                if (text.length === 0) {
                    node = previousNode(text);
                } else {
                    return !isODFWhitespace(
                        text.data.substr(text.length - 1, 1)
                    );
                }
            } else if (isAnchoredAsCharacterElement(node)) {
                r = isSpaceElement(node) === false;
                node = null;
            } else {
                node = previousNode(node);
            }
        }
        return r;
    }
    this.scanLeftForNonSpace = scanLeftForNonSpace;
    /**
     * Walk to the left along the DOM and return the type of the first
     * thing encountered.
     * 0 none of the below
     * 1 non-whitespace character or a character element
     * 2 whitespace character that is preceded by a non-whitespace character
     *   or a character element
     *
     * @param {!Node} node the first node to scan
     * @return {!number}
     */
    function lookLeftForCharacter(node) {
        var text, r = 0, tl = 0;
        if (node.nodeType === Node.TEXT_NODE) {
            tl = /**@type{!Text}*/(node).length;
        }
        if (tl > 0) {
            text = /**@type{!Text}*/(node).data;
            if (!isODFWhitespace(text.substr(tl - 1, 1))) {
                r = 1; // character found
            } else if (tl === 1) {
                r = scanLeftForNonSpace(previousNode(node)) ? 2 : 0;
            } else {
                r = isODFWhitespace(text.substr(tl - 2, 1)) ? 0 : 2;
            }
        } else if (isAnchoredAsCharacterElement(node)) {
            r = 1;
        }
        return r;
    }
    this.lookLeftForCharacter = lookLeftForCharacter;
    /**
     * Look to the right along the DOM and return true if the first thing
     * encountered is either a non-whitespace character or a character
     * element.
     *
     * @param {?Node} node the first node to scan
     * @return {!boolean}
     */
    function lookRightForCharacter(node) {
        var r = false,
            l = 0;
        if (node && node.nodeType === Node.TEXT_NODE) {
            l = /**@type{!Text}*/(node).length;
        }
        if (l > 0) {
            r = !isODFWhitespace(/**@type{!Text}*/(node).data.substr(0, 1));
        } else if (isAnchoredAsCharacterElement(node)) {
            r = true;
        }
        return r;
    }
    this.lookRightForCharacter = lookRightForCharacter;
    /**
     * Walk to the left along the DOM and return true if either a
     * non-whitespace character or a character element is encountered.
     *
     * @param {?Node} node the first node to scan
     * @return {!boolean}
     */
    function scanLeftForAnyCharacter(node) {
        var r = false, l;
        node = node && lastChild(node);
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                l = /**@type{!Text}*/(node).length;
            } else {
                l = 0;
            }
            if (l > 0 && !isODFWhitespace(/**@type{!Text}*/(node).data)) {
                r = true;
                break;
            }
            if (isAnchoredAsCharacterElement(node)) {
                r = true;
                break;
            }
            node = previousNode(node);
        }
        return r;
    }
    this.scanLeftForAnyCharacter = scanLeftForAnyCharacter;
    /**
     * Walk to the right along the DOM and return true if either a
     * non-whitespace character or a character element is encountered.
     *
     * @param {?Node} node the first node to scan
     * @return {!boolean}
     */
    function scanRightForAnyCharacter(node) {
        var r = false, l;
        node = node && firstChild(node);
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                l = /**@type{!Text}*/(node).length;
            } else {
                l = 0;
            }
            if (l > 0 && !isODFWhitespace(/**@type{!Text}*/(node).data)) {
                r = true;
                break;
            }
            if (isAnchoredAsCharacterElement(node)) {
                r = true;
                break;
            }
            node = nextNode(node);
        }
        return r;
    }
    this.scanRightForAnyCharacter = scanRightForAnyCharacter;

    /**
     * check if the node is part of the trailing whitespace
     * @param {!Text} textnode
     * @param {!number} offset
     * @return {!boolean}
     */
    function isTrailingWhitespace(textnode, offset) {
        if (!isODFWhitespace(textnode.data.substr(offset))) {
            return false;
        }
        return !scanRightForAnyCharacter(nextNode(textnode));
    }
    this.isTrailingWhitespace = isTrailingWhitespace;

    /**
     * Takes a textNode and an offset, and returns true if the character
     * at that offset is a significant whitespace.
     *
     * Significant whitespace is defined as:
     * - Not part of the leading whitespace block in a paragraph
     * - Not part of the trailing whitespace block in a paragraph
     * - The first whitespace character after a text node or character
     *
     * All other whitespace elements are considered insignificant
     * @param {!Text} textNode
     * @param {!number} offset
     * @returns {!boolean}
     */
    function isSignificantWhitespace(textNode, offset) {
        var text = textNode.data,
            result;

        if (!isODFWhitespace(text[offset])) {
            // Character is not whitespace
            return false;
        }

        if (isAnchoredAsCharacterElement(textNode.parentNode)) {
            // Parent is a character element, and therefore does not actually contain text
            // This prevents a space element from being upgraded again
            return false;
        }

        if (offset > 0) {
            if (!isODFWhitespace(text[offset - 1])) {
                // First whitespace after a character is significant
                result = true;
            }
        } else if (scanLeftForNonSpace(previousNode(textNode))) {
            // If the first character found scanning to the left is non-whitespace, this might still be significant
            result = true;
        }

        if (result === true) {
            return isTrailingWhitespace(textNode, offset)
                ? false : true;
        }
        return false;
    }
    this.isSignificantWhitespace = isSignificantWhitespace;

    /**
     * Returns true if the supplied node is a downgradeable space element.
     * As per http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#element-text_s
     * a downgradeable whitespace element is a space element that is immediately preceded by something other than a space
     * and has at least one non-space character after it
     * @param {!Node} node
     * @returns {!boolean}
     */
    this.isDowngradableSpaceElement = function(node) {
        if (node.namespaceURI === textns && node.localName === "s") {
            return scanLeftForNonSpace(previousNode(node)) && scanRightForAnyCharacter(nextNode(node));
        }
        return false;
    };

    /**
     * Returns the first non-whitespace-only child of a given node
     * @param {Node|undefined} node
     * @returns {Node|undefined}
     */
    function getFirstNonWhitespaceChild(node) {
        var child = node && node.firstChild;
        while (child && child.nodeType === Node.TEXT_NODE && whitespaceOnly.test(child.nodeValue)) {
            child = child.nextSibling;
        }
        return child;
    }
    this.getFirstNonWhitespaceChild = getFirstNonWhitespaceChild;

    /**
     * Returns the length split as value and unit, from an ODF attribute
     * @param {!string} length
     * @return {?{value:!number,unit:!string}}
     */
    function parseLength(length) {
        var re = /(-?[0-9]*[0-9][0-9]*(\.[0-9]*)?|0+\.[0-9]*[1-9][0-9]*|\.[0-9]*[1-9][0-9]*)((cm)|(mm)|(in)|(pt)|(pc)|(px)|(%))/,
            m = re.exec(length);
        if (!m) {
            return null;
        }
        return {value: parseFloat(m[1]), unit: m[3]};
    }
    this.parseLength = parseLength;

    /**
     * Returns the value and unit of the length, if it is positive ( > 0)
     * @param {!string} length
     * @return {?{value:!number,unit:!string}}
     */
    function parsePositiveLength(length) {
        var result = parseLength(length);
        if (result && (result.value <= 0 || result.unit === '%')) {
            return null;
        }
        return result;
    }

    /**
     * Returns the value and unit of the length, if it is non-negative ( >= 0)
     * @param {!string} length
     * @return {?{value:!number,unit:!string}}
     */
    function parseNonNegativeLength(length) {
        var result = parseLength(length);
        if (result && (result.value < 0 || result.unit === '%')) {
            return null;
        }
        return result;
    }
    this.parseNonNegativeLength = parseNonNegativeLength;

    /**
     * Returns the value and unit(%) of the length, if it is specified in %age
     * @param {!string} length
     * @return {?{value:!number,unit:!string}}
     */
    function parsePercentage(length) {
        var result = parseLength(length);
        if (result && (result.unit !== '%')) {
            return null;
        }
        return result;
    }

    /**
     * Returns the value and unit of the font size, in conformance with fo:font-size
     * constraints
     * @param {!string} fontSize
     * @return {?{value:!number,unit:!string}}
     */
    function parseFoFontSize(fontSize) {
        return parsePositiveLength(fontSize) || parsePercentage(fontSize);
    }
    this.parseFoFontSize = parseFoFontSize;

    /**
     * Returns the value and unit of the line height, in conformance with fo:line-height
     * constraints
     * @param {!string} lineHeight
     * @return {?{value:!number,unit:!string}}
     */
    function parseFoLineHeight(lineHeight) {
        return parseNonNegativeLength(lineHeight) || parsePercentage(lineHeight);
    }
    this.parseFoLineHeight = parseFoLineHeight;

    /**
     * Adapted from instructions on how to generate plain text from an ODT document.
     * See algorithm at http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#__RefHeading__1415196_253892949
     * @param {!Node} node
     * @returns {boolean}
     */
    function isTextContentContainingNode(node) {
        switch (node.namespaceURI) {
            // Namespace skips
        case odf.Namespaces.drawns:
        case odf.Namespaces.svgns:
        case odf.Namespaces.dr3dns:
            return false;
        case odf.Namespaces.textns:
            // Specific node type skips
            //noinspection FallthroughInSwitchStatementJS
            switch (node.localName) {
            case 'note-body':
            case 'ruby-text':
                return false;
            }
            break;
        case odf.Namespaces.officens:
            // Specific node type skips
            //noinspection FallthroughInSwitchStatementJS
            switch (node.localName) {
            case 'annotation':
            case 'binary-data':
            case 'event-listeners':
                return false;
            }
            break;
        default:
            // Skip webodf edit markers or cursor information
            switch (node.localName) {
            case 'cursor':
            case 'editinfo':
                return false;
            }
            break;
        }
        return true;
    }
    this.isTextContentContainingNode = isTextContentContainingNode;

    /**
     * Returns true if the text node is within a paragraph and contains either non-whitespace characters, or
     * significant whitespace characters (as defined by the ODF standards).
     * WARNING this method is likely to be quite slow, so should be used as little as possible
     * @param {!Text} textNode
     * @returns {!boolean}
     */
    function isSignificantTextContent(textNode) {
        return Boolean(getParagraphElement(textNode)
            && (!isODFWhitespace(textNode.textContent) || isSignificantWhitespace(textNode, 0)));
    }

    /**
     * Returns true if the supplied nodeRange should be included in the parent range according
     * to the setting of the includePartial flag.
     * @param {!Range} range Selection range
     * @param {!Range} nodeRange Node character range
     * @param {!boolean} includePartial flag indicating whether partial intersections are acceptable
     * @returns {!boolean}
     */
    function includeNode(range, nodeRange, includePartial) {
        return (includePartial && domUtils.rangesIntersect(range, nodeRange))
                    || domUtils.containsRange(range, nodeRange);
    }

    /**
     * Returns a array of text nodes considered to be part of the supplied range.
     * This will exclude elements that are not part of the ODT main text body,
     * as well as insignificant whitespace text nodes.
     * @param {!Range} range    Range to search for nodes within
     * @param {boolean} includePartial Include partially intersecting text nodes
     *                                 in the result.
     * @returns {!Array.<Node>}
     */
    function getTextNodes(range, includePartial) {
        var document = range.startContainer.ownerDocument,
            nodeRange = document.createRange(),
            textNodes;

        /**
         * @param {Node} node
         * @return {number}
         */
        function nodeFilter(node) {
            nodeRange.selectNodeContents(node);

            if (node.nodeType === Node.TEXT_NODE) {
                if (includeNode(range, nodeRange, includePartial)) {
                    return isSignificantTextContent(/**@type{!Text}*/(node))
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            } else if (domUtils.rangesIntersect(range, nodeRange)) {
                if (isTextContentContainingNode(node)) {
                    return NodeFilter.FILTER_SKIP;
                }
            }
            return NodeFilter.FILTER_REJECT;
        }

        textNodes = domUtils.getNodesInRange(range, nodeFilter);

        nodeRange.detach();
        return textNodes;
    }
    this.getTextNodes = getTextNodes;

    /**
     * Get all character elements and text nodes fully contained within the
     * supplied range in document order.
     *
     * For example, given the following fragment, with the range starting at b,
     * and ending at c:
     *      <text:p>ab<text:s/>cd</text:p>
     * this function would return the following array:
     *      ["b", text:s, "c"]
     * @param {!Range} range
     * @param {!boolean} includePartial Include partially intersecting text &
     *                         character nodes in the result.
     * @param {!boolean} includeInsignificantWhitespace Include whitespace only
     *                         nodes that are not considered significant text
     *                         content. This includes whitespace only elements
     *                         used in pretty-formatted xml as LibreOffice
     *                         produces in flat ODT files.
     * @returns {!Array.<Node>}
     */
    function getTextElements(range, includePartial,
                includeInsignificantWhitespace) {
        var document = range.startContainer.ownerDocument,
            nodeRange = document.createRange(),
            elements;

        /**
         * @param {Node} node
         * @return {number}
         */
        function nodeFilter(node) {
            nodeRange.selectNodeContents(node);
            // do not return anything inside an character element or an inline root such as an annotation
            if (isCharacterElement(node.parentNode) || isInlineRoot(node.parentNode)) {
                return NodeFilter.FILTER_REJECT;
            }

            if (node.nodeType === Node.TEXT_NODE) {
                if (includeNode(range, nodeRange, includePartial)) {
                    if (includeInsignificantWhitespace
                            || isSignificantTextContent(
                              /**@type{!Text}*/(node)
                            )) {
                            // Text nodes should only be returned if they are
                            // fully contained within the range.
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            } else if (isAnchoredAsCharacterElement(node)) {
                if (includeNode(range, nodeRange, includePartial)) {
                    // Character elements should only be returned if they are
                    // fully contained within the range.
                    return NodeFilter.FILTER_ACCEPT;
                }
            } else if (isTextContentContainingNode(node) || isGroupingElement(node)) {
                return NodeFilter.FILTER_SKIP;
            }
            return NodeFilter.FILTER_REJECT;
        }

        elements = domUtils.getNodesInRange(range, nodeFilter);
        nodeRange.detach();

        return elements;
    }
    this.getTextElements = getTextElements;

    /**
     * Get all paragraph elements that intersect the supplied range in document
     * order.
     *
     * For example, given the following fragment, with the range starting at b,
     * and ending at c:
     *      <text:p id="A">ab</text:p><text:p id="B"><text:s/>cd</text:p>
     * this function would return the following array:
     *      [text:p{id="A"}, text:p{id="B"}]
     * @param {!Range} range
     * @returns {!Array.<!Element>}
     */
    this.getParagraphElements = function (range) {
        var document = range.startContainer.ownerDocument,
            nodeRange = document.createRange(),
            elements;

        /**
         * @param {Node} node
         * @return {number}
         */
        function nodeFilter(node) {
            nodeRange.selectNodeContents(node);
            if (isParagraph(node)) {
                if (domUtils.rangesIntersect(range, nodeRange)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
            } else if ((node && isTextContentContainingNode(node))
                    || isGroupingElement(node)) {
                return NodeFilter.FILTER_SKIP;
            }
            return NodeFilter.FILTER_REJECT;
        }

        elements = domUtils.getNodesInRange(range, nodeFilter);
        nodeRange.detach();

        return elements;
    };

    /**
     * Get all image elements that fully contained within the supplied range in
     * document order.
     * @param {!Range} range
     * @returns {!Array.<Node>}
     */
    this.getImageElements = function (range) {
        var document = range.startContainer.ownerDocument,
            nodeRange = document.createRange(),
            elements;

        /**
         * @param {Node} node
         * @return {number}
         */
        function nodeFilter(node) {
            nodeRange.selectNodeContents(node);
            if (isImage(node) && domUtils.containsRange(range, nodeRange)) {
                return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
        }

        elements = domUtils.getNodesInRange(range, nodeFilter);
        nodeRange.detach();

        return elements;
    };

    /**
     * Returns the node right after the given point.
     * @param {!Node} container
     * @param {!number} offset
     * @return {!Node}
     */
    function getRightNode(container, offset) {
        var node = container;
        if (offset < node.childNodes.length - 1) {
            node = /** @type {!Node} */(node.childNodes[offset + 1]);
        } else {
            while (!node.nextSibling) {
                node = node.parentNode;
            }
            node = node.nextSibling;
        }
        while (node.firstChild) {
            node = node.firstChild;
        }
        return node;
    }

    /**
     * Get all hyperlink elements that intersect the supplied range in document order
     *
     * For example, given the following fragment, with the range starting at b, and ending at c:
     *      <text:a xlink:href="google">ab</text:a><text:a xlink:href="apple">cd</text:a>
     * this function would return the following array:
     *      [text:a{xlink:href="google"}, text:a{xlink:href="apple"}]
     * @param {!Range} range
     * @returns {!Array.<Node>}
     */
    this.getHyperlinkElements = function (range) {
        var links = [],
            newRange = /** @type {!Range}*/(range.cloneRange()),
            node,
            textNodes;

        if (range.collapsed && range.endContainer.nodeType === Node.ELEMENT_NODE) {
            node = getRightNode(range.endContainer, range.endOffset);
            if (node.nodeType === Node.TEXT_NODE) {
                newRange.setEnd(node, 1);
            }
        }

        textNodes = getTextElements(newRange, true, false);
        textNodes.forEach(function (node) {
            var parent = node.parentNode;
            while (!isParagraph(parent)) {
                if (isHyperlink(parent) && links.indexOf(parent) === -1) {
                    links.push(parent);
                    break;
                }
                parent = parent.parentNode;
            }
        });
        newRange.detach();
        return links;
    };
};
