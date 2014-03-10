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
/*global runtime, odf, console*/
/**
 * @constructor
 * @param {!function(!Element,!Object):undefined} parser
 * @param {!Object} implementationDefault
 */
odf.StylePile = function (parser, implementationDefault) {
    "use strict";
    var /**@type{!Object}*/
        defaultStyle = implementationDefault,
        /**@type{!Object.<!string,!Element>}*/
        styles = {},
        /**@type{!Object.<!string,!Element>}*/
        automaticStyles = {},
        /**@type{!Object.<!string,!Object>}*/
        parsedAutomaticStyles = {},
        /**@type{!Object.<!string,!Object>}*/
        parsedStyles = {},
        stylens = odf.Namespaces.stylens,
        /**@type{!function(!string,!Array.<!string>):!Object}*/
        getNotAutomaticStyle,
        /**@type{!Array.<!string>}*/
        propertyGroups = ["text", "paragraph"];
    /**
     * @param {!Object} parent
     * @return {!Object}
     */
    function cloneStyle(parent) {
        var style, i, group;
        if (parent) {
            style = Object.create(parent);
            for (i = 0; i < propertyGroups.length; i += 1) {
                group = propertyGroups[i];
                if (parent[group]) {
                    style[group] = Object.create(parent[group]);
                }
            }
        } else {
            style = {};
        }
        return style;
    }
    /**
     * @param {!Element} element
     * @param {!Array.<!string>} visited
     * @return {!Object}
     */
    function parseStyle(element, visited) {
        var /**@type{!Object}*/
            parent = defaultStyle,
            parentName,
            style;
        if (element.hasAttributeNS(stylens, "parent-style-name")) {
            parentName = element.getAttributeNS(stylens, "parent-style-name");
            if (visited.indexOf(parentName) === -1) {
                parent = getNotAutomaticStyle(parentName, visited);
            }
        }
        try {
            style = cloneStyle(parent);
            parser(element, style);
        } catch (ignored) {
            style = parent;
        }
        return style;
    }
    /**
     * @param {!string} styleName
     * @param {!Array.<!string>} visited
     * @return {!Object}
     */
    getNotAutomaticStyle = function (styleName, visited) {
        var /**@type{!Object|undefined}*/
            style = parsedStyles[styleName],
            element;
        if (!style) {
            element = styles[styleName];
            if (element) {
                visited.push(element.getAttributeNS(stylens, "name"));
                style = parseStyle(element, visited);
                parsedStyles[styleName] = style;
            } else {
                style = defaultStyle;
            }
        }
        return style;
    };
    /**
     * @param {!string} styleName
     * @return {!Object}
     */
    function getStyle(styleName) {
        var style = parsedAutomaticStyles[styleName],
            element;
        if (!style) {
            element = automaticStyles[styleName];
            if (element) {
                style = parseStyle(element, []);
            } else {
                style = defaultStyle;
            }
        }
        return style;
    }
    /**
     * @param {!string} styleName
     * @return {!Object}
     */
    this.getStyle = getStyle;
    /**
     * @param {!Element} style
     * @return {undefined}
     */
    this.setDefaultStyle = function (style) {
        if (defaultStyle === implementationDefault) {
            defaultStyle = parseStyle(style, []);
        }
    };
    /**
     * @param {!Element} style
     * @return {undefined}
     */
    this.addStyle = function (style) {
        var name;
        if (style.hasAttributeNS(stylens, "name")) {
            name = style.getAttributeNS(stylens, "name");
            if (!styles.hasOwnProperty(name)) {
                styles[name] = style;
            }
        }
    };
    /**
     * @param {!Element} style
     * @return {undefined}
     */
    this.addAutomaticStyle = function (style) {
        var name;
        if (style.hasAttributeNS(stylens, "name")) {
            name = style.getAttributeNS(stylens, "name");
            if (!automaticStyles.hasOwnProperty(name)) {
                automaticStyles[name] = style;
            }
        }
    };
};
/**
 * Fast and type-safe access to styling properties an ODF document.
 * When the document changes, update() has to be called to update the
 * information.
 * @constructor
 * @param {!odf.ODFDocumentElement} odfroot
 */
odf.Style = function Style(odfroot) {
    "use strict";
    var /**@type{!odf.StylePile}*/
        textStylePile,
        /**@type{!odf.StylePile}*/
        paragraphStylePile,
        fons = odf.Namespaces.fons,
        stylens = odf.Namespaces.stylens,
        /**@type{!odf.Style.TextProperties}*/
        defaultTextProperties = {
            fontWeight: "normal",
            fontName: "Times New Roman"
        },
        /**@type{!odf.Style.ParagraphProperties}*/
        defaultParagraphProperties = {
            marginTop: "1cm"
        };
    /**
     * @param {!string} family
     * @return {!odf.StylePile|undefined}
     */
    function getPile(family) {
        var pile;
        if (family === "text") {
            pile = textStylePile;
        } else if (family === "paragraph") {
            pile = paragraphStylePile;
        }
        return pile;
    }
    /**
     * @param {!string} styleName
     * @return {!odf.Style.TextStyle}
     */
    this.getTextStyle = function (styleName) {
        var style = textStylePile.getStyle(styleName);
        return /**@type{!odf.Style.TextStyle}*/(style);
    };
    /**
     * @param {!string} styleName
     * @return {!odf.Style.ParagraphStyle}
     */
    this.getParagraphStyle = function (styleName) {
        var style = paragraphStylePile.getStyle(styleName);
        return /**@type{!odf.Style.ParagraphStyle}*/(style);
    };
    /**
     * @param {!Element} element
     * @return {!odf.StylePile|undefined}
     */
    function getPileFromElement(element) {
        var family = element.getAttributeNS(stylens, "family");
        return getPile(family);
    }
    /**
     * @param {!string} value
     * @return {!string|undefined}
     */
    function parseFontWeight(value) {
        var ok = ["normal", "bold", "100", "200", "300", "400", "500", "600",
                "700", "800", "900"],
            v = value;
        if (ok.indexOf(v) === -1) {
            v = undefined;
        }
        return v;
    }
    /**
     * Advance to a sibling with the given namespace and localname.
     * If the given element matches, that element is returned.
     * @param {?Element} e
     * @param {!string} ns
     * @param {!string} localName
     * @return {?Element}
     */
    function advanceToSibling(e, ns, localName) {
        var s = e;
        while (s && (s.localName !== localName || s.namespaceURI !== ns)) {
            s = s.nextElementSibling;
        }
        return s;
    }
    /**
     * @param {?Element} styleChild
     * @param {!odf.Style.TextProperties} text
     * @return {?Element}
     */
    function parseTextProperties(styleChild, text) {
        var e = advanceToSibling(styleChild, stylens, "text-properties"),
            value;
        if (e === null) {
            return e;
        }
        value = parseFontWeight(e.getAttributeNS(fons, "font-weight"));
        if (value !== undefined) {
            text.fontWeight = value;
        }
        if (e.hasAttributeNS(stylens, "font-name")) {
            text.fontName = e.getAttributeNS(stylens, "font-name");
        }
        return e;
    }
    /**
     * @param {?Element} styleChild
     * @param {!odf.Style.ParagraphProperties} paragraph
     * @return {?Element}
     */
    function parseParagraphProperties(styleChild, paragraph) {
        var e = advanceToSibling(styleChild, stylens, "text-properties");
        if (e === null) {
            return e;
        }
        if (e.hasAttributeNS(fons, "margin-top")) {
            paragraph.marginTop = e.getAttributeNS(fons, "margin-top");
        }
        return e;
    }
    /**
     * @param {!Element} e
     * @param {!Object} styleObject
     * @return {undefined}
     */
    function parseTextStyle(e, styleObject) {
        var style = /**@type{!odf.Style.TextStyle}*/(styleObject),
            c = e.firstElementChild;
        parseTextProperties(c, style.text);
    }
    /**
     * @param {!Element} e
     * @param {!Object} styleObject
     * @return {undefined}
     */
    function parseParagraphStyle(e, styleObject) {
        var style = /**@type{!odf.Style.ParagraphStyle}*/(styleObject),
            c = e.firstElementChild;
        c = parseTextProperties(c, style.text);
        parseParagraphProperties(c, style.paragraph);
    }
    /**
     * @return {undefined}
     */
    function createTextStylePile() {
        var /**@type{!odf.Style.TextStyle}*/
            def = {
                text: defaultTextProperties
            };
        textStylePile = new odf.StylePile(parseTextStyle, def);
    }
    /**
     * @return {undefined}
     */
    function createParagraphStylePile() {
        var /**@type{!odf.Style.ParagraphStyle}*/
            def = {
                text: defaultTextProperties,
                paragraph: defaultParagraphProperties
            };
        paragraphStylePile = new odf.StylePile(parseParagraphStyle, def);
    }
    /**
     * @return {undefined}
     */
    function update() {
        var e = odfroot.styles.firstElementChild,
            pile;
        createTextStylePile();
        createParagraphStylePile();
        while (e) {
            pile = getPileFromElement(e);
            if (pile && e.namespaceURI === stylens) {
                if (e.localName === "style") {
                    pile.addStyle(e);
                } else if (e.localName === "default-style") {
                    pile.setDefaultStyle(e);
                }
            }
            e = e.nextElementSibling;
        }
        e = odfroot.automaticStyles.firstElementChild;
        while (e) {
            pile = getPileFromElement(e);
            if (pile && e.namespaceURI === stylens && e.localName === "style") {
                pile.addAutomaticStyle(e);
            }
            e = e.nextElementSibling;
        }
    }
    this.update = update;
    update();
    console.log(JSON.stringify(this.getParagraphStyle("P1")));
    console.log(JSON.stringify(this.getTextStyle("T2").text.fontWeight));
};
/**@typedef{{
    fontWeight:!string,
    fontName:!string
}}*/
odf.Style.TextProperties;
/**@typedef{{
    marginTop:!string
}}*/
odf.Style.ParagraphProperties;
/**@typedef{{
    text:!odf.Style.TextProperties
}}*/
odf.Style.TextStyle;
/**@typedef{{
    text:!odf.Style.TextProperties,
    paragraph:!odf.Style.ParagraphProperties
}}*/
odf.Style.ParagraphStyle;
