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

/*global odf, runtime, xmldom, core, document*/

runtime.loadClass("odf.Namespaces");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("xmldom.XPath");
runtime.loadClass("core.CSSUnits");

/**
 * @constructor
 */
odf.Style2CSS = function Style2CSS() {
    "use strict";
    var // helper constants
        /**@const@type{!string}*/ drawns = odf.Namespaces.drawns,
        /**@const@type{!string}*/ fons = odf.Namespaces.fons,
        /**@const@type{!string}*/ stylens = odf.Namespaces.stylens,
        /**@const@type{!string}*/ svgns = odf.Namespaces.svgns,
        /**@const@type{!string}*/ tablens = odf.Namespaces.tablens,
        /**@const@type{!string}*/ textns = odf.Namespaces.textns,
        /**@const@type{!string}*/ xlinkns = odf.Namespaces.xlinkns,
        /**@const@type{!string}*/ presentationns = odf.Namespaces.presentationns,

        /**@const@type{!Object.<string,!string>}*/
        familynamespaceprefixes = {
            'graphic': 'draw',
            'drawing-page': 'draw',
            'paragraph': 'text',
            'presentation': 'presentation',
            'ruby': 'text',
            'section': 'text',
            'table': 'table',
            'table-cell': 'table',
            'table-column': 'table',
            'table-row': 'table',
            'text': 'text',
            'list': 'text',
            'page': 'office'
        },

        /**@const@type{!Object.<string,!Array.<!string>>}*/
        familytagnames = {
            'graphic': ['circle', 'connected', 'control', 'custom-shape',
                'ellipse', 'frame', 'g', 'line', 'measure', 'page',
                'page-thumbnail', 'path', 'polygon', 'polyline', 'rect',
                'regular-polygon' ],
            'paragraph': ['alphabetical-index-entry-template', 'h',
                'illustration-index-entry-template', 'index-source-style',
                'object-index-entry-template', 'p',
                'table-index-entry-template', 'table-of-content-entry-template',
                'user-index-entry-template'],
            'presentation': ['caption', 'circle', 'connector', 'control',
                'custom-shape', 'ellipse', 'frame', 'g', 'line', 'measure',
                'page-thumbnail', 'path', 'polygon', 'polyline', 'rect',
                'regular-polygon'],
            'drawing-page': ['caption', 'circle', 'connector', 'control', 'page',
                'custom-shape', 'ellipse', 'frame', 'g', 'line', 'measure',
                'page-thumbnail', 'path', 'polygon', 'polyline', 'rect',
                'regular-polygon'],
            'ruby': ['ruby', 'ruby-text'],
            'section': ['alphabetical-index', 'bibliography',
                'illustration-index', 'index-title', 'object-index', 'section',
                'table-of-content', 'table-index', 'user-index'],
            'table': ['background', 'table'],
            'table-cell': ['body', 'covered-table-cell', 'even-columns',
                'even-rows', 'first-column', 'first-row', 'last-column',
                'last-row', 'odd-columns', 'odd-rows', 'table-cell'],
            'table-column': ['table-column'],
            'table-row': ['table-row'],
            'text': ['a', 'index-entry-chapter', 'index-entry-link-end',
                'index-entry-link-start', 'index-entry-page-number',
                'index-entry-span', 'index-entry-tab-stop', 'index-entry-text',
                'index-title-template', 'linenumbering-configuration',
                'list-level-style-number', 'list-level-style-bullet',
                'outline-level-style', 'span'],
            'list': ['list-item']
        },

        /**@const@type{!Array.<!Array.<!string>>}*/
        textPropertySimpleMapping = [
            [ fons, 'color', 'color' ],
            // this sets the element background, not just the text background
            [ fons, 'background-color', 'background-color' ],
            [ fons, 'font-weight', 'font-weight' ],
            [ fons, 'font-style', 'font-style' ]
        ],

        /**@const@type{!Array.<!Array.<!string>>}*/
        bgImageSimpleMapping = [
            [ stylens, 'repeat', 'background-repeat' ]
        ],

        /**@const@type{!Array.<!Array.<!string>>}*/
        paragraphPropertySimpleMapping = [
            [ fons, 'background-color', 'background-color' ],
            [ fons, 'text-align', 'text-align' ],
            [ fons, 'text-indent', 'text-indent' ],
            [ fons, 'padding', 'padding' ],
            [ fons, 'padding-left', 'padding-left' ],
            [ fons, 'padding-right', 'padding-right' ],
            [ fons, 'padding-top', 'padding-top' ],
            [ fons, 'padding-bottom', 'padding-bottom' ],
            [ fons, 'border-left', 'border-left' ],
            [ fons, 'border-right', 'border-right' ],
            [ fons, 'border-top', 'border-top' ],
            [ fons, 'border-bottom', 'border-bottom' ],
            [ fons, 'margin', 'margin' ],
            [ fons, 'margin-left', 'margin-left' ],
            [ fons, 'margin-right', 'margin-right' ],
            [ fons, 'margin-top', 'margin-top' ],
            [ fons, 'margin-bottom', 'margin-bottom' ],
            [ fons, 'border', 'border' ]
        ],

        /**@const@type{!Array.<!Array.<!string>>}*/
        graphicPropertySimpleMapping = [
            [ fons, 'background-color', 'background-color'],
            [ fons, 'min-height', 'min-height' ],
            [ drawns, 'stroke', 'border' ],
            [ svgns, 'stroke-color', 'border-color' ],
            [ svgns, 'stroke-width', 'border-width' ],
            [ fons, 'border', 'border' ],
            [ fons, 'border-left', 'border-left' ],
            [ fons, 'border-right', 'border-right' ],
            [ fons, 'border-top', 'border-top' ],
            [ fons, 'border-bottom', 'border-bottom' ]
        ],

        /**@const@type{!Array.<!Array.<!string>>}*/
        tablecellPropertySimpleMapping = [
            [ fons, 'background-color', 'background-color' ],
            [ fons, 'border-left', 'border-left' ],
            [ fons, 'border-right', 'border-right' ],
            [ fons, 'border-top', 'border-top' ],
            [ fons, 'border-bottom', 'border-bottom' ],
            [ fons, 'border', 'border' ]
        ],

        tablecolumnPropertySimpleMapping = [
            [ stylens, 'column-width', 'width' ]
        ],

        /**@const@type{!Array.<!Array.<!string>>}*/
        tablerowPropertySimpleMapping = [
            [ stylens, 'row-height', 'height' ],
            [ fons, 'keep-together', null ]
        ],

        /**@const@type{!Array.<!Array.<!string>>}*/
        tablePropertySimpleMapping = [
            [ stylens, 'width', 'width' ],
            [ fons, 'margin-left', 'margin-left' ],
            [ fons, 'margin-right', 'margin-right' ],
            [ fons, 'margin-top', 'margin-top' ],
            [ fons, 'margin-bottom', 'margin-bottom' ]
        ],

        /**@const@type{!Array.<!Array.<!string>>}*/
        pageContentPropertySimpleMapping = [
            [ fons, 'background-color', 'background-color' ],
            [ fons, 'padding', 'padding' ],
            [ fons, 'padding-left', 'padding-left' ],
            [ fons, 'padding-right', 'padding-right' ],
            [ fons, 'padding-top', 'padding-top' ],
            [ fons, 'padding-bottom', 'padding-bottom' ],
            [ fons, 'border', 'border' ],
            [ fons, 'border-left', 'border-left' ],
            [ fons, 'border-right', 'border-right' ],
            [ fons, 'border-top', 'border-top' ],
            [ fons, 'border-bottom', 'border-bottom' ],
            [ fons, 'margin', 'margin' ],
            [ fons, 'margin-left', 'margin-left' ],
            [ fons, 'margin-right', 'margin-right' ],
            [ fons, 'margin-top', 'margin-top' ],
            [ fons, 'margin-bottom', 'margin-bottom' ]
        ],

        /**@const@type{!Array.<!Array.<!string>>}*/
        pageSizePropertySimpleMapping = [
            [ fons, 'page-width', 'width' ],
            [ fons, 'page-height', 'height' ]
        ],

        /**@const@type{!Object.<!boolean>}*/
        borderPropertyMap = {
            'border': true,
            'border-left': true,
            'border-right': true,
            'border-top': true,
            'border-bottom': true,
            'stroke-width': true
        },

        // A font-face declaration map, to be populated once style2css is called.
        /**@type{!Object.<string,string>}*/
        fontFaceDeclsMap = {},
        utils = new odf.OdfUtils(),
        documentType,
        odfRoot,
        defaultFontSize,
        xpath = new xmldom.XPath(),
        cssUnits = new core.CSSUnits();

    // helper functions
    /**
     * @param {!Element} stylesnode
     * @return {!Object}
     */
    function getStyleMap(stylesnode) {
        // put all style elements in a hash map by family and name
        var stylemap = {}, node, name, family, style;
        if (!stylesnode) {
            return stylemap;
        }
        node = stylesnode.firstChild;
        while (node) {
            if (node.namespaceURI === stylens &&
                    ((node.localName === 'style') ||
                     (node.localName === 'default-style'))) {
                family = node.getAttributeNS(stylens, 'family');
            } else if (node.namespaceURI === textns &&
                    node.localName === 'list-style') {
                family = "list";
            } else if (node.namespaceURI === stylens &&
                    (node.localName === 'page-layout' || node.localName === 'default-page-layout')) {
                family = "page";
            } else {
                // Skip insignificant white-space only nodes in the style tree
                family = undefined;
            }

            if (family) {
                // get style name
                name = node.getAttributeNS &&
                       node.getAttributeNS(stylens, 'name');
                if (!name) {
                    // For a default style, there is no name
                    name = '';
                }

                // get style (and create, if not yet existing)
                style = stylemap[family] = stylemap[family] || {};

                // then store style node in map
                style[name] = node;
            }

            node = node.nextSibling;
        }

        return stylemap;
    }
    /**
     * @param {?Object} stylestree
     * @param {?string} name
     * @return {?string}
     */
    function findStyle(stylestree, name) {
        if (!name || !stylestree) {
            return null;
        }
        if (stylestree[name]) {
            return stylestree[name];
        }
        var n,
            style;
        for (n in stylestree) {
            if (stylestree.hasOwnProperty(n)) {
                style = findStyle(stylestree[n].derivedStyles, name);
                if (style) {
                    return style;
                }
            }
        }
        return null;
    }
    /**
     * @param {!string} stylename
     * @param {!Object} stylesmap
     * @param {!Object} stylestree
     * @return {undefined}
     */
    function addStyleToStyleTree(stylename, stylesmap, stylestree) {
        var style = stylesmap[stylename], parentname, parentstyle;
        if (!style) {
            return;
        }
        parentname = style.getAttributeNS(stylens, 'parent-style-name');
        parentstyle = null;
        if (parentname) {
            parentstyle = findStyle(stylestree, parentname);
            if (!parentstyle && stylesmap[parentname]) {
                // parent style has not been handled yet, do that now
                addStyleToStyleTree(parentname, stylesmap, stylestree);
                parentstyle = stylesmap[parentname];
                stylesmap[parentname] = null;
            }
        }
        if (parentstyle) {
            if (!parentstyle.derivedStyles) {
                parentstyle.derivedStyles = {};
            }
            parentstyle.derivedStyles[stylename] = style;
        } else {
            // no parent so add the root
            stylestree[stylename] = style;
        }
    }
    /**
     * @param {!Object} stylesmap
     * @param {!Object} stylestree
     * @return {undefined}
     */
    function addStyleMapToStyleTree(stylesmap, stylestree) {
        var name;
        for (name in stylesmap) {
            if (stylesmap.hasOwnProperty(name)) {
                addStyleToStyleTree(name, stylesmap, stylestree);
                stylesmap[name] = null;
            }
        }
    }
    /**
     * @param {!string} family
     * @param {!string} name
     * @return {?string}
     */
    function createSelector(family, name) {
        var prefix = familynamespaceprefixes[family],
            namepart,
            selector;
        if (prefix === null) {
            return null;
        }

        // If there is no name, it is a default style, in which case style-name shall be used without a value
        if (name) {
            namepart = '[' + prefix + '|style-name="' + name + '"]';
        } else {
            namepart = '';
        }
        if (prefix === 'presentation') {
            prefix = 'draw';
            if (name) {
                namepart = '[presentation|style-name="' + name + '"]';
            } else {
                namepart = '';
            }
        }
        selector = prefix + '|' + familytagnames[family].join(
            namepart + ',' + prefix + '|'
        ) + namepart;
        return selector;
    }
    /**
     * @param {!string} family
     * @param {!string} name
     * @param {!Element} node
     * @return {!Array}
     */
    function getSelectors(family, name, node) {
        var selectors = [], n, ss, s;
        selectors.push(createSelector(family, name));
        for (n in node.derivedStyles) {
            if (node.derivedStyles.hasOwnProperty(n)) {
                ss = getSelectors(family, n, node.derivedStyles[n]);
                for (s in ss) {
                    if (ss.hasOwnProperty(s)) {
                        selectors.push(ss[s]);
                    }
                }
            }
        }
        return selectors;
    }
    /**
     * @param {?Element} node
     * @param {!string} ns
     * @param {!string} name
     * @return {?Element}
     */
    function getDirectChild(node, ns, name) {
        if (!node) {
            return null;
        }
        var c = node.firstChild, e;
        while (c) {
            if (c.namespaceURI === ns && c.localName === name) {
                e = /**@type{Element}*/(c);
                return e;
            }
            c = c.nextSibling;
        }
        return null;
    }
    /**
     * Make sure border width is no less than 1px wide; otherwise border is not rendered.
     * Only have problems with point unit at the moment. Please add more rule if needed.
     * @param {!string} value a string contains border attributes eg. 1pt solid black or 1px
     * @return {!string}
     */
    function fixBorderWidth(value) {
        var index = value.indexOf(' '),
            width, theRestOfBorderAttributes;

        if (index !== -1) {
            width = value.substring(0, index);
            theRestOfBorderAttributes = value.substring(index); // everything after the width attribute
        } else {
            width = value;
            theRestOfBorderAttributes = '';
        }

        width = utils.parseLength(width);
        // According to CSS 2.1, 1px is equal to 0.75pt http://www.w3.org/TR/CSS2/syndata.html#length-units
        if (width && width.unit === 'pt' && width.value < 0.75) {
            value = '0.75pt' + theRestOfBorderAttributes;
        }
        return value;
    }
    /**
     * @param {!Element} props
     * @param {!Object} mapping
     * @return {!string}
     */
    function applySimpleMapping(props, mapping) {
        var rule = '', r, value;
        for (r in mapping) {
            if (mapping.hasOwnProperty(r)) {
                r = mapping[r];
                value = props.getAttributeNS(r[0], r[1]);

                if (value) {
                    value = value.trim();

                    if (borderPropertyMap.hasOwnProperty(r[1])) {
                        value = fixBorderWidth(value);
                    }
                    if (r[2]) {
                        rule += r[2] + ':' + value + ';';
                    }
                }
            }
        }
        return rule;
    }

    /**
     * Returns the font size attribute value from the text properties of a style node
     * @param {!Node} styleNode
     * @return {?{value: !number, unit: !string}}
     */
    function getFontSize(styleNode) {
        var props = getDirectChild(/**@type{Element}*/(styleNode), stylens, 'text-properties');
        if (props) {
            return utils.parseFoFontSize(props.getAttributeNS(fons, 'font-size'));
        }
        return null;
    }

    /**
     * Returns the parent style node of a given style node
     * @param {!Node} styleNode
     * @return {Node}
     */
    function getParentStyleNode(styleNode) {
        var parentStyleName = '',
            parentStyleFamily = '',
            parentStyleNode = null,
            xp;

        if (styleNode.localName === 'default-style') {
            return null;
        }

        parentStyleName = styleNode.getAttributeNS(stylens, 'parent-style-name');
        parentStyleFamily = styleNode.getAttributeNS(stylens, 'family');
        
        if (parentStyleName) {
            xp = "//style:*[@style:name='" + parentStyleName + "'][@style:family='" + parentStyleFamily + "']";
        } else {
            xp = "//style:default-style[@style:family='" + parentStyleFamily + "']";
        }
        parentStyleNode = xpath.getODFElementsWithXPath(/**@type{!Element}*/(odfRoot), xp, odf.Namespaces.resolvePrefix)[0];
        return parentStyleNode;
    }
    /**
     * @param {!Element} props
     * @return {!string}
     */
    function getTextProperties(props) {
        var rule = '', fontName, fontSize, value, textDecoration = '',
            fontSizeRule = '',
            sizeMultiplier = 1,
            parentStyle;

        rule += applySimpleMapping(props, textPropertySimpleMapping);

        value = props.getAttributeNS(stylens, 'text-underline-style');
        if (value === 'solid') {
            textDecoration += ' underline';
        }
        value = props.getAttributeNS(stylens, 'text-line-through-style');
        if (value === 'solid') {
            textDecoration += ' line-through';
        }

        if (textDecoration.length) {
            textDecoration = 'text-decoration:' + textDecoration + ';';
            rule += textDecoration;
        }

        fontName = props.getAttributeNS(stylens, 'font-name')
            || props.getAttributeNS(fons, 'font-family');
        if (fontName) {
            value = fontFaceDeclsMap[fontName];
            // TODO: use other information from style:font-face, like style:font-family-generic
            rule += 'font-family: ' + (value || fontName) + ';';
        }

        parentStyle = props.parentNode;
        fontSize = getFontSize(/**@type{!Node}*/(parentStyle));
        // This is actually the font size of the current style.
        if (!fontSize) {
            return rule;
        }

        while (parentStyle) {
            fontSize = getFontSize(/**@type{!Node}*/(parentStyle));
            if (fontSize) {
                // If the current style's font size is a non-% value, then apply the multiplier to get the child style (with the %)'s
                // actual font size. And now we can stop crawling up the style ancestry since we have a concrete font size.
                if (fontSize.unit !== '%') {
                    fontSizeRule = 'font-size: ' + (fontSize.value * sizeMultiplier) + fontSize.unit + ';';
                    break;
                }
                // If we got a % font size for the current style, then update the multiplier with it's 'normalized' multiplier
                sizeMultiplier *= (fontSize.value / 100);
            }
            // Crawl up the style ancestry
            parentStyle = getParentStyleNode(parentStyle);
        }

        // If there was nothing in the ancestry that specified a concrete font size, just apply the multiplier onto the page's default font size.
        if (!fontSizeRule) {
            fontSizeRule = 'font-size: ' + parseFloat(defaultFontSize) * sizeMultiplier + cssUnits.getUnits(defaultFontSize) + ';';
        }

        rule += fontSizeRule;
        return rule;
    }
    /**
     * @param {!Element} props
     * @return {!string}
     */
    function getParagraphProperties(props) {
        var rule = '', imageProps, url, element, lineHeight;
        rule += applySimpleMapping(props, paragraphPropertySimpleMapping);
        imageProps = props.getElementsByTagNameNS(stylens, 'background-image');
        if (imageProps.length > 0) {
            url = imageProps.item(0).getAttributeNS(xlinkns, 'href');
            if (url) {
                rule += "background-image: url('odfkit:" + url + "');";
                //rule += "background-repeat: repeat;"; //FIXME test
                element = /**@type{!Element}*/(imageProps.item(0));
                rule += applySimpleMapping(element, bgImageSimpleMapping);
            }
        }

        lineHeight = props.getAttributeNS(fons, 'line-height');
        if (lineHeight && lineHeight !== 'normal') {
            lineHeight = utils.parseFoLineHeight(lineHeight);
            if (lineHeight.unit !== '%') {
                rule += 'line-height: ' + lineHeight.value + lineHeight.unit + ';';
            } else {
                rule += 'line-height: ' + lineHeight.value / 100 + ';';
            }
        }

        return rule;
    }

    /**
     * @param {!string} hex
     * @return {?{ r: number, g: number, b: number}}
     */
    function hexToRgb(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var result,
            shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
/*jslint unparam: true*/
        hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
        });
/*jslint unparam: false*/

        result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function isNumber(n) {
        return !isNaN(parseFloat(n));
    }

   /**
     * @param {!Element} props
     * @return {!string}
     */
    function getGraphicProperties(props) {
        var rule = '', alpha, bgcolor, fill;

        rule += applySimpleMapping(props, graphicPropertySimpleMapping);
        alpha = props.getAttributeNS(drawns, 'opacity');
        fill = props.getAttributeNS(drawns, 'fill');
        bgcolor = props.getAttributeNS(drawns, 'fill-color');

        if (fill === 'solid' || fill === 'hatch') {
            if (bgcolor && bgcolor !== 'none') {
                alpha = isNumber(alpha) ? parseFloat(alpha) / 100 : 1;
                bgcolor = hexToRgb(bgcolor);
                if (bgcolor) {
                    rule += "background-color: rgba("
                        + bgcolor.r + ","
                        + bgcolor.g + ","
                        + bgcolor.b + ","
                        + alpha + ");";
                }
            } else {
                rule += "background: none;";
            }
        } else if (fill === "none") {
            rule += "background: none;";
        }

        return rule;
    }
   /**
     * @param {!Element} props
     * @return {!string}
     */
    function getDrawingPageProperties(props) {
        var rule = '';

        rule += applySimpleMapping(props, graphicPropertySimpleMapping);
        if (props.getAttributeNS(presentationns, 'background-visible') === 'true') {
            rule += "background: none;";
        }
        return rule;
    }
    /**
     * @param {!Element} props
     * @return {!string}
     */
    function getTableCellProperties(props) {
        var rule = '';
        rule += applySimpleMapping(props, tablecellPropertySimpleMapping);
        return rule;
    }
    /**
     * @param {!Element} props
     * @return {!string}
     */
    function getTableRowProperties(props) {
        var rule = '';
        rule += applySimpleMapping(props, tablerowPropertySimpleMapping);
        return rule;
    }
    /**
     * @param {!Element} props
     * @return {!string}
     */
    function getTableColumnProperties(props) {
        var rule = '';
        rule += applySimpleMapping(props, tablecolumnPropertySimpleMapping);
        return rule;
    }
    /**
     * @param {!Element} props
     * @return {!string}
     */
    function getTableProperties(props) {
        var rule = '', borderModel;
        rule += applySimpleMapping(props, tablePropertySimpleMapping);
        borderModel = props.getAttributeNS(tablens, 'border-model');

        if (borderModel === 'collapsing') {
            rule += 'border-collapse:collapse;';
        } else if (borderModel === 'separating') {
            rule += 'border-collapse:separate;';
        }

        return rule;
    }
    /**
     * @param {!StyleSheet} sheet
     * @param {!string} family
     * @param {!string} name
     * @param {!Element} node
     * @return {undefined}
     */
    function addStyleRule(sheet, family, name, node) {
        var selectors = getSelectors(family, name, node),
            selector = selectors.join(','),
            rule = '',
            properties = getDirectChild(node, stylens, 'text-properties');
        if (properties) {
            rule += getTextProperties(properties);
        }
        properties = getDirectChild(node, stylens, 'paragraph-properties');
        if (properties) {
            rule += getParagraphProperties(properties);
        }
        properties = getDirectChild(node, stylens, 'graphic-properties');
        if (properties) {
            rule += getGraphicProperties(properties);
        }
        properties = getDirectChild(node, stylens, 'drawing-page-properties');
        if (properties) {
            rule += getDrawingPageProperties(properties);
        }
        properties = getDirectChild(node, stylens, 'table-cell-properties');
        if (properties) {
            rule += getTableCellProperties(properties);
        }
        properties = getDirectChild(node, stylens, 'table-row-properties');
        if (properties) {
            rule += getTableRowProperties(properties);
        }
        properties = getDirectChild(node, stylens, 'table-column-properties');
        if (properties) {
            rule += getTableColumnProperties(properties);
        }
        properties = getDirectChild(node, stylens, 'table-properties');
        if (properties) {
            rule += getTableProperties(properties);
        }
        if (rule.length === 0) {
            return;
        }
        rule = selector + '{' + rule + '}';
        try {
            sheet.insertRule(rule, sheet.cssRules.length);
        } catch (e) {
            throw e;
        }
    }
    /**
     * @param {!Element} node
     * @return {!string}
     */
    function getNumberRule(node) {
        var style = node.getAttributeNS(stylens, "num-format"),
            suffix = node.getAttributeNS(stylens, "num-suffix"),
            prefix = node.getAttributeNS(stylens, "num-prefix"),
            stylemap = {'1': 'decimal', 'a': 'lower-latin', 'A': 'upper-latin',
                'i': 'lower-roman', 'I': 'upper-roman'},
            content = prefix || "";

        if (stylemap.hasOwnProperty(style)) {
            content += " counter(list, " + stylemap[style] + ")";
        } else if (style) {
            content += "'" + style + "';";
        } else {
            content += " ''";
        }
        if (suffix) {
            content += " '" + suffix + "'";
        }
        return "content: " + content + ";";
    }
    /**
     * @return {!string}
     */
    function getImageRule() {
        var rule = "content: none;";
        return rule;
    }
    /**
     * @param {!Element} node
     * @return {!string}
     */
    function getBulletRule(node) {
        var bulletChar = node.getAttributeNS(textns, "bullet-char");
        return "content: '" + bulletChar + "';";
    }
    /**
     * @param {!StyleSheet} sheet
     * @param {!string} name
     * @param {!Element} node
     * @return {undefined}
     */
    function addListStyleRule(sheet, name, node, itemrule) {
        var selector = 'text|list[text|style-name="' + name + '"]',
            level = node.getAttributeNS(textns, "level"),
            itemSelector,
            listItemRule,
            listLevelProps = utils.getFirstNonWhitespaceChild(node), // {Element}
            listLevelLabelAlign = utils.getFirstNonWhitespaceChild(listLevelProps), // {Element}
            labelAlignAttr,
            bulletIndent,
            listIndent,
            bulletWidth,
            rule;

        if (listLevelLabelAlign) {
            labelAlignAttr = listLevelLabelAlign.attributes;
            bulletIndent = labelAlignAttr["fo:text-indent"] ? labelAlignAttr["fo:text-indent"].value : undefined;
            listIndent = labelAlignAttr["fo:margin-left"] ? labelAlignAttr["fo:margin-left"].value : undefined;
        }

        // If no values are specified, use default values
        if (!bulletIndent) {
            bulletIndent = "-0.6cm";
        }

        // bulletWidth is the negative of bulletIndent
        // Obtain this my stripping the fist character
        if (bulletIndent.charAt(0) === '-') {
            bulletWidth = bulletIndent.substring(1);
        } else {
            bulletWidth = "-" + bulletIndent;
        }

        level = level && parseInt(level, 10);
        while (level > 1) {
            selector += ' > text|list-item > text|list';
            level -= 1;
        }
        itemSelector = selector;
        itemSelector += ' > text|list-item > *:not(text|list):first-child';
        if (listIndent !== undefined) {
            listItemRule = itemSelector + '{margin-left:' + listIndent + ';}';
            sheet.insertRule(listItemRule, sheet.cssRules.length);
        }
        // insert a block before every immediate child of the list-item, except for lists
        selector += ' > text|list-item > *:not(text|list):first-child:before';
        rule = itemrule;
        rule = selector + '{' + rule + ';';

        rule += 'counter-increment:list;';
        rule += 'margin-left:' + bulletIndent + ';';
        rule += 'width:' + bulletWidth + ';';
        rule += 'display:inline-block}';

        try {
            sheet.insertRule(rule, sheet.cssRules.length);
        } catch (e) {
            throw e;
        }
    }
    /**
     * @param {!StyleSheet} sheet
     * @param {!Element} node
     * @return {undefined}
     */
    function addPageStyleRules(sheet, node) {
        var rule = '', imageProps, url, element,
            contentLayoutRule = '',
            pageSizeRule = '',
            props = node.getElementsByTagNameNS(stylens, 'page-layout-properties')[0],
            masterStyles = props.parentNode.parentNode.parentNode.masterStyles,
            masterPages,
            masterStyleName = '',
            i;

        rule += applySimpleMapping(props, pageContentPropertySimpleMapping);
        imageProps = props.getElementsByTagNameNS(stylens, 'background-image');
        if (imageProps.length > 0) {
            url = imageProps.item(0).getAttributeNS(xlinkns, 'href');
            if (url) {
                rule += "background-image: url('odfkit:" + url + "');";
                //rule += "background-repeat: repeat;"; //FIXME test
                element = /**@type{!Element}*/(imageProps.item(0));
                rule += applySimpleMapping(element, bgImageSimpleMapping);
            }
        }

        if (documentType === 'presentation') {
            if (masterStyles) {
                masterPages = masterStyles.getElementsByTagNameNS(stylens, 'master-page');
                for (i = 0; i < masterPages.length; i += 1) {

                    // Generate CSS for all the pages that use the master page that use this page-layout
                    if (masterPages[i].getAttributeNS(stylens, 'page-layout-name') === props.parentNode.getAttributeNS(stylens, 'name')) {
                        masterStyleName = masterPages[i].getAttributeNS(stylens, 'name');

                        contentLayoutRule = 'draw|page[draw|master-page-name=' + masterStyleName + '] {' + rule + '}';
                        pageSizeRule = 'office|body, draw|page[draw|master-page-name=' + masterStyleName + '] {'
                            + applySimpleMapping(props, pageSizePropertySimpleMapping)
                            + ' }';

                        try {
                            sheet.insertRule(contentLayoutRule, sheet.cssRules.length);
                            sheet.insertRule(pageSizeRule, sheet.cssRules.length);
                        } catch (e1) {
                            throw e1;
                        }
                    }
                }
            }

        } else if (documentType === 'text') {
            contentLayoutRule = 'office|text {' + rule + '}';
            rule = '';

            // TODO: We want to use the simpleMapping for ODTs, but not until we have pagination.
            // So till then, set only the width.
            //rule += applySimpleMapping(props, pageSizePropertySimpleMapping);
            pageSizeRule = 'office|body {'
                + 'width: ' + props.getAttributeNS(fons, 'page-width') + ';'
                + '}';

            try {
                sheet.insertRule(contentLayoutRule, sheet.cssRules.length);
                sheet.insertRule(pageSizeRule, sheet.cssRules.length);
            } catch (e2) {
                throw e2;
            }
        }

    }

    /**
     * @param {!StyleSheet} sheet
     * @param {!string} name
     * @param {!Element} node
     * @return {undefined}
     */
    function addListStyleRules(sheet, name, node) {
        var n = node.firstChild, e, itemrule;
        while (n) {
            if (n.namespaceURI === textns) {
                e = /**@type{!Element}*/(n);
                if (n.localName === "list-level-style-number") {
                    itemrule = getNumberRule(e);
                    addListStyleRule(sheet, name, e, itemrule);
                } else if (n.localName === "list-level-style-image") {
                    itemrule = getImageRule();
                    addListStyleRule(sheet, name, e, itemrule);
                } else if (n.localName === "list-level-style-bullet") {
                    itemrule = getBulletRule(e);
                    addListStyleRule(sheet, name, e, itemrule);
                }
            }
            n = n.nextSibling;
        }
    }
    /**
     * @param {!StyleSheet} sheet
     * @param {!string} family
     * @param {!string} name
     * @param {!Element} node
     * @return {undefined}
     */
    function addRule(sheet, family, name, node) {
        if (family === "list") {
            addListStyleRules(sheet, name, node);
        } else if (family === "page") {
            addPageStyleRules(sheet, node);
        } else {
            addStyleRule(sheet, family, name, node);
        }
    }
    /**
     * @param {!StyleSheet} sheet
     * @param {!string} family
     * @param {!string} name
     * @param {!Element} node
     * @return {undefined}
     */
    function addRules(sheet, family, name, node) {
        addRule(sheet, family, name, node);
        var n;
        for (n in node.derivedStyles) {
            if (node.derivedStyles.hasOwnProperty(n)) {
                addRules(sheet, family, n, node.derivedStyles[n]);
            }
        }
    }

    // css vs odf styles
    // ODF styles occur in families. A family is a group of odf elements to
    // which an element applies. ODF families can be mapped to a group of css
    // elements

    /**
     * @param {!string} doctype
     * @param {!StyleSheet} stylesheet
     * @param {!Object.<string,string>} fontFaceMap
     * @param {!Element} styles
     * @param {!Element} autostyles
     * @return {undefined}
     */
    this.style2css = function (doctype, stylesheet, fontFaceMap, styles, autostyles) {
        var doc, styletree, tree, name, rule, family,
            stylenodes, styleautonodes;

        // make stylesheet empty
        while (stylesheet.cssRules.length) {
            stylesheet.deleteRule(stylesheet.cssRules.length - 1);
        }
        doc = null;
        if (styles) {
            doc = styles.ownerDocument;
            odfRoot = styles.parentNode;
        }
        if (autostyles) {
            doc = autostyles.ownerDocument;
            odfRoot = autostyles.parentNode;
        }
        if (!doc) {
            return;
        }

        // add @namodfRoot espace rules
        odf.Namespaces.forEachPrefix(function (prefix, ns) {
            rule = '@namespace ' + prefix + ' url(' + ns + ');';
            try {
                stylesheet.insertRule(rule, stylesheet.cssRules.length);
            } catch (ignore) {
                // WebKit can throw an exception here, but it will have
                // retained the namespace declarations anyway.
            }
        });

        fontFaceDeclsMap = fontFaceMap;
        documentType = doctype;
        defaultFontSize = runtime.getWindow().getComputedStyle(document.body, null).getPropertyValue('font-size') || '12pt';

        // add the various styles
        stylenodes = getStyleMap(styles);
        styleautonodes = getStyleMap(autostyles);
        styletree = {};
        for (family in familynamespaceprefixes) {
            if (familynamespaceprefixes.hasOwnProperty(family)) {
                tree = styletree[family] = {};
                addStyleMapToStyleTree(stylenodes[family], tree);
                addStyleMapToStyleTree(styleautonodes[family], tree);

                for (name in tree) {
                    if (tree.hasOwnProperty(name)) {
                        addRules(stylesheet, family, name, tree[name]);
                    }
                }
            }
        }
    };
};
