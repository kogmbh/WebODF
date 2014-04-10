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
/*global Node, odf, runtime, console, core*/


/**
 * @constructor
 */
odf.Formatting = function Formatting() {
    "use strict";
    var /**@type{odf.OdfContainer}*/
        odfContainer,
        /**@type{odf.StyleInfo}*/
        styleInfo = new odf.StyleInfo(),
        /**@const*/
        svgns = odf.Namespaces.svgns,
        /**@const*/
        stylens = odf.Namespaces.stylens,
        /**@const*/
        fons = odf.Namespaces.fons,
        odfUtils = new odf.OdfUtils(),
        domUtils = new core.DomUtils(),
        utils = new core.Utils(),
        cssUnits = new core.CSSUnits(),
        // TODO: needs to be extended. Possibly created together with CSS from sone default description?
        /**@const*/
        builtInDefaultStyleAttributesByFamily = {
            'paragraph' : {
                'style:paragraph-properties': {
                    'fo:text-align': 'left'
                }
            }
        },
        /**@const*/
        defaultPageFormatSettings = {
            width: "21.001cm", // showing as 21.00 in page format dialog but the value is actually 21.001 in the xml
            height: "29.7cm",
            margin: "2cm",
            padding: "0cm"
        }; // LO 4.1.1.2's default page format settings.

    /**
     * Returns a JSON representation of the built-in default style attributes
     * of a given style family.
     * Creates a deep copy, so the result can be modified by the callee.
     * If there are no such attributes, null is returned.
     * @param {string} styleFamily
     * @return {!Object.<string,!Object.<string,string>>}
     */
    function getSystemDefaultStyleAttributes(styleFamily) {
        var result,
            /**@type{!Object|undefined}*/
            builtInDefaultStyleAttributes = builtInDefaultStyleAttributesByFamily[styleFamily];

        if (builtInDefaultStyleAttributes) {
            // reusing mergeObjects to copy builtInDefaultStyleAttributes into the result
            result = utils.mergeObjects({}, builtInDefaultStyleAttributes);
        } else {
            result = {};
        }

        return result;
    }
    this.getSystemDefaultStyleAttributes = getSystemDefaultStyleAttributes;

    /**
     * @param {!odf.OdfContainer} odfcontainer
     * @return {undefined}
     */
    this.setOdfContainer = function (odfcontainer) {
        odfContainer = odfcontainer;
    };
    /**
     * Returns a font face declarations map, where the key is the style:name and
     * the value is the svg:font-family or null, if none set but a svg:font-face-uri
     * @return {!Object.<string,string>}
     */
    function getFontMap() {
        var fontFaceDecls = odfContainer.rootElement.fontFaceDecls,
            /**@type {!Object.<string,string>}*/
            fontFaceDeclsMap = {},
            node,
            name,
            family;

        node = fontFaceDecls && fontFaceDecls.firstElementChild;
        while (node) {
            name = node.getAttributeNS(stylens, 'name');
            if (name) {
                // add family name as value, or, if there is a
                // font-face-uri, an empty string
                family = node.getAttributeNS(svgns, 'font-family');
                if (family || node.getElementsByTagNameNS(svgns, 'font-face-uri').length > 0) {
                    fontFaceDeclsMap[name] = family;
                }
            }
            node = node.nextElementSibling;
        }

        return fontFaceDeclsMap;
    }
    this.getFontMap = getFontMap;

    /**
     * Loop over the <style:style> elements and place the attributes
     * style:name and style:display-name in an array.
     * @return {!Array}
     */
    this.getAvailableParagraphStyles = function () {
        var node = odfContainer.rootElement.styles,
            p_family,
            p_name,
            p_displayName,
            paragraphStyles = [];
        node = node && node.firstElementChild;
        while (node) {
            if (node.localName === "style" && node.namespaceURI === stylens) {
                p_family = node.getAttributeNS(stylens, 'family');
                if (p_family === "paragraph") {
                    p_name = node.getAttributeNS(stylens, 'name');
                    p_displayName = node.getAttributeNS(stylens, 'display-name') || p_name;
                    if (p_name && p_displayName) {
                        paragraphStyles.push({
                            name: p_name,
                            displayName: p_displayName
                        });
                    }
                }
            }
            node = node.nextElementSibling;
        }
        return paragraphStyles;
    };

    /**
     * Returns if the given style is used anywhere in the document.
     * @param {!Element} styleElement
     * @return {!boolean}
     */
    this.isStyleUsed = function (styleElement) {
        var hasDerivedStyles, isUsed,
            root = odfContainer.rootElement;

        hasDerivedStyles = styleInfo.hasDerivedStyles(root,
            odf.Namespaces.lookupNamespaceURI, styleElement);

        isUsed =
            new styleInfo.UsedStyleList(root.styles).uses(styleElement)
            || new styleInfo.UsedStyleList(root.automaticStyles).uses(styleElement)
            || new styleInfo.UsedStyleList(root.body).uses(styleElement);

        return hasDerivedStyles || isUsed;
    };

    /**
     * @param {!string} family
     * @return {?Element}
     */
    function getDefaultStyleElement(family) {
        var node = odfContainer.rootElement.styles.firstElementChild;

        while (node) {
            if (node.namespaceURI === stylens
                    && node.localName === "default-style"
                    && node.getAttributeNS(stylens, 'family') === family) {
                return node;
            }
            node = node.nextElementSibling;
        }
        return null;
    }
    this.getDefaultStyleElement = getDefaultStyleElement;

    /**
     * Fetch style element associated with the requested name and family
     * @param {!string} styleName
     * @param {!string} family
     * @param {!Array.<!Element>=} styleElements Specific style trees to search. If unspecified will search both automatic
     *  and user-created styles
     * @return {Element}
     */
    function getStyleElement(styleName, family, styleElements) {
        return styleInfo.getStyleElement(styleName, family, styleElements || [
            odfContainer.rootElement.automaticStyles,
            odfContainer.rootElement.styles
        ]);
    }
    this.getStyleElement = getStyleElement;

    /**
     * Returns a JSON representation of the style attributes of a given style element
     * @param {!Element} styleNode
     * @return {!Object}
     */
    function getStyleAttributes(styleNode) {
        var i, a, map, ai,
            propertiesMap = {},
            propertiesNode = styleNode.firstElementChild;

        while (propertiesNode) {
            if (propertiesNode.namespaceURI === stylens) {
                map = propertiesMap[propertiesNode.nodeName] = {};
                a = propertiesNode.attributes;
                for (i = 0; i < a.length; i += 1) {
                    ai = /**@type{!Attr}*/(a.item(i));
                    map[ai.name] = ai.value;
                }
            }
            propertiesNode = propertiesNode.nextElementSibling;
        }
        a = styleNode.attributes;
        for (i = 0; i < a.length; i += 1) {
            ai = /**@type{!Attr}*/(a.item(i));
            propertiesMap[ai.name] = ai.value;
        }

        return propertiesMap;
    }
    this.getStyleAttributes = getStyleAttributes;

    /**
     * Returns a JSON representation of the style attributes of a given style element, also containing attributes
     * inherited from it's ancestry - up to and including the document's default style for the family.
     * @param {!Element} styleNode
     * @param {!boolean=} includeSystemDefault True by default. Specify false to suppress inclusion of system defaults
     * @return {!Object.<string,!Object.<string,string>>}
     */
    function getInheritedStyleAttributes(styleNode, includeSystemDefault) {
        var styleListElement = odfContainer.rootElement.styles,
            parentStyleName,
            propertiesMap,
            inheritedPropertiesMap = {},
            styleFamily = styleNode.getAttributeNS(stylens, 'family'),
            node = styleNode;

        // Iterate through the style ancestry
        while (node) {
            propertiesMap = getStyleAttributes(node);
            // All child properties should override any matching parent properties
            inheritedPropertiesMap = utils.mergeObjects(propertiesMap, inheritedPropertiesMap);

            parentStyleName = node.getAttributeNS(stylens, 'parent-style-name');
            if (parentStyleName) {
                node = getStyleElement(parentStyleName, styleFamily, [styleListElement]);
            } else {
                node = null;
            }
        }

        // Next incorporate attributes from the default style
        node = getDefaultStyleElement(styleFamily);
        if (node) {
            propertiesMap = getStyleAttributes(node);
            // All child properties should override any matching parent properties
            inheritedPropertiesMap = utils.mergeObjects(propertiesMap, inheritedPropertiesMap);
        }

        // Last incorporate attributes from the built-in default style
        if (includeSystemDefault !== false) {
            propertiesMap = getSystemDefaultStyleAttributes(styleFamily);
            // All child properties should override any matching parent properties
            inheritedPropertiesMap = utils.mergeObjects(propertiesMap, inheritedPropertiesMap);
        }

        return inheritedPropertiesMap;
    }
    this.getInheritedStyleAttributes = getInheritedStyleAttributes;

    /**
     * Get the name of the first common style in the parent style chain.
     * If none is found, null is returned and you should assume the Default style.
     * @param {!string} styleName
     * @return {!string|null}
     */
    this.getFirstCommonParentStyleNameOrSelf = function (styleName) {
        var automaticStyleElementList = odfContainer.rootElement.automaticStyles,
            styleElementList = odfContainer.rootElement.styles,
            styleElement;

        // first look for automatic style with the name
        styleElement = getStyleElement(styleName, "paragraph", [automaticStyleElementList]);
        while (styleElement) {
            styleName = styleElement.getAttributeNS(stylens, 'parent-style-name');
            styleElement = getStyleElement(styleName, "paragraph", [automaticStyleElementList]);
        }
        // then see if that style is in common styles
        styleElement = getStyleElement(styleName, "paragraph", [styleElementList]);
        if (!styleElement) {
            return null;
        }
        return styleName;
    };

    /**
     * Returns if there is an automatic or common paragraph style with the given name.
     * @param {!string} styleName
     * @return {!boolean}
     */
    this.hasParagraphStyle = function (styleName) {
        return Boolean(getStyleElement(styleName, "paragraph"));
    };

    /**
     * Builds up a style chain for a given node by climbing up all parent nodes and checking for style information
     * @param {!Node} node
     * @param {!Object.<!string, !Array.<!Object>>=} collectedChains Dictionary to add any new style chains to
     * @return {!Array.<!Object>|undefined}
     */
    function buildStyleChain(node, collectedChains) {
        var parent = /**@type{!Element}*/(node.nodeType === Node.TEXT_NODE
                  ? node.parentNode : node),
            nodeStyles,
            appliedStyles = [],
            /**@type{string}*/
            chainKey = '',
            foundContainer = false;
        while (parent) {
            if (!foundContainer && odfUtils.isGroupingElement(parent)) {
                foundContainer = true;
            }
            nodeStyles = styleInfo.determineStylesForNode(parent);
            if (nodeStyles) {
                appliedStyles.push(nodeStyles);
            }
            parent = /**@type{!Element}*/(parent.parentNode);
        }

        /**
         * @param {!Array.<!Object.<string,!Object.<string,number>>>} usedStyleMap
         */
        function chainStyles(usedStyleMap) {
            Object.keys(usedStyleMap).forEach(function (styleFamily) {
                Object.keys(usedStyleMap[styleFamily]).forEach(function (styleName) {
                    chainKey += '|' + styleFamily + ':' + styleName + '|';
                });
            });
        }
        if (foundContainer) {
            appliedStyles.forEach(chainStyles);
            if (collectedChains) {
                collectedChains[chainKey] = appliedStyles;
            }
        }

        return foundContainer ? appliedStyles : undefined;
    }

    /**
     * Returns true if the supplied style node is a common style.
     * From the OpenDocument spec:
     *
     * "Common and automatic styles behave differently in OpenDocument editing consumers. Common
     *  styles are presented to the user as a named set of formatting properties. The formatting
     *  properties of an automatic style are presented to a user as properties of the object to
     *  which the style is applied."
     *
     * http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#element-office_automatic-styles
     *
     * @param {!Node} styleNode
     * @return {!boolean}
     */
    function isCommonStyleElement(styleNode) {
        return styleNode.parentNode === odfContainer.rootElement.styles;
    }

    /**
     * Takes a provided style chain and calculates the resulting inherited style, starting from the outer-most to the
     * inner-most style
     * @param {!Array.<!Object>} styleChain Ordered list starting from inner-most style to outer-most style
     * @return {!Object}
     */
    function calculateAppliedStyle(styleChain) {
        var mergedChildStyle = { orderedStyles: [] };

        // The complete style is built up by starting at the base known style and merging each new entry
        // on top of it, so the inner-most style properties override the outer-most
        styleChain.forEach(function (elementStyleSet) {
            Object.keys(/**@type{!Object}*/(elementStyleSet)).forEach(function (styleFamily) {
                // Expect there to only be a single style for a given family per element (e.g., 1 text, 1 paragraph)
                var styleName = Object.keys(elementStyleSet[styleFamily])[0],
                    styleSummary = {
                        name: styleName,
                        family: styleFamily,
                        displayName: undefined,
                        isCommonStyle: false
                    },
                    styleElement,
                    parentStyle;

                styleElement = getStyleElement(styleName, styleFamily);
                if (styleElement) {
                    parentStyle = getInheritedStyleAttributes(/**@type{!Element}*/(styleElement));
                    mergedChildStyle = utils.mergeObjects(parentStyle, mergedChildStyle);
                    styleSummary.displayName = styleElement.getAttributeNS(stylens, 'display-name');
                    styleSummary.isCommonStyle = isCommonStyleElement(styleElement);
                } else {
                    runtime.log("No style element found for '" + styleName + "' of family '" + styleFamily + "'");
                }
                mergedChildStyle.orderedStyles.push(styleSummary);
            });
        });
        return mergedChildStyle;
    }

    /**
     * Returns an array of all unique styles in the given text nodes
     * @param {!Array.<!Node>} nodes
     * @param {Object.<!string, !Object>=} calculatedStylesCache Short-lived cache of calculated styles.
     *      Useful if a function is looking up the style information for multiple nodes without updating
     *      any style definitions.
     * @return {!Array.<!Object>}
     */
    function getAppliedStyles(nodes, calculatedStylesCache) {
        var styleChains = {},
            styles = [];

        if (!calculatedStylesCache) {
            calculatedStylesCache = {}; // Makes the following logic easier as a cache can be assumed to exist
        }
        nodes.forEach(function (n) {
            buildStyleChain(n, styleChains);
        });

        Object.keys(styleChains).forEach(function (key) {
            if (!calculatedStylesCache[key]) {
                calculatedStylesCache[key] = calculateAppliedStyle(styleChains[key]);
            }
            styles.push(calculatedStylesCache[key]);
        });
        return styles;
    }
    this.getAppliedStyles = getAppliedStyles;

    /**
     * Returns a the applied style to the current node
     * @param {!Node} node
     * @param {Object.<!string, !Object>=} calculatedStylesCache Short-lived cache of calculated styles.
     *      Useful if a function is looking up the style information for multiple nodes without updating
     *      any style definitions.
     * @return {Object|undefined}
     */
    this.getAppliedStylesForElement = function (node, calculatedStylesCache) {
        return getAppliedStyles([node], calculatedStylesCache)[0];
    };

    /**
     * Overrides the specific properties on the styleNode from the values in the supplied properties Object.
     * If a newStylePrefix is supplied, this method will automatically generate a unique name for the style node
     * @param {!Element} styleNode
     * @param {!Object.<string,!Object.<string,string>>} properties Prefix to put in front of new auto styles
     */
    this.updateStyle = function (styleNode, properties) {
        var fontName, fontFaceNode;

        domUtils.mapObjOntoNode(styleNode, properties, odf.Namespaces.lookupNamespaceURI);

        fontName = properties["style:text-properties"] && properties["style:text-properties"]["style:font-name"];
        if (fontName && !getFontMap().hasOwnProperty(fontName)) {
            fontFaceNode = styleNode.ownerDocument.createElementNS(stylens, 'style:font-face');
            fontFaceNode.setAttributeNS(stylens, 'style:name', fontName);
            fontFaceNode.setAttributeNS(svgns, 'svg:font-family', fontName);
            odfContainer.rootElement.fontFaceDecls.appendChild(fontFaceNode);
        }
    };

    /**
     * Create a style object (JSON-equivalent) that is equivalent to inheriting from the parent
     * style and family, and applying the specified overrides.
     * This contains logic for simulating inheritance for automatic styles
     * @param {!string} parentStyleName
     * @param {!string} family
     * @param {!Object} overrides
     * @return {!Object}
     */
    this.createDerivedStyleObject = function(parentStyleName, family, overrides) {
        var originalStyleElement = /**@type{!Element}*/(getStyleElement(parentStyleName, family)),
            newStyleObject;
        runtime.assert(Boolean(originalStyleElement), "No style element found for '" + parentStyleName + "' of family '" + family + "'");
        if (isCommonStyleElement(originalStyleElement)) {
            newStyleObject = { "style:parent-style-name": parentStyleName };
        } else {
            // Automatic styles cannot be inherited from. The way to create a derived style is to clone it entirely
            newStyleObject = getStyleAttributes(originalStyleElement);
        }
        newStyleObject["style:family"] =  family;
        utils.mergeObjects(newStyleObject, overrides);
        return newStyleObject;
    };

    /**
     * Get the default tab-stop distance defined for this document
     * See http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#property-style_tab-stop-distance
     * @return {?{value: !number, unit: !string}}
     */
    this.getDefaultTabStopDistance = function () {
        var defaultParagraph = getDefaultStyleElement('paragraph'),
            paragraphProperties = defaultParagraph && defaultParagraph.firstElementChild,
            tabStopDistance;
        while (paragraphProperties) {
            if (paragraphProperties.namespaceURI === stylens && paragraphProperties.localName === "paragraph-properties") {
                tabStopDistance = paragraphProperties.getAttributeNS(stylens, "tab-stop-distance");
            }
            paragraphProperties = paragraphProperties.nextElementSibling;
        }

        if (!tabStopDistance) {
            tabStopDistance =  "1.25cm"; // What is the default value for tab stops? Pulled this from LO 4.1.1
        }
        return odfUtils.parseNonNegativeLength(tabStopDistance);
    };

    /**
     * Find a master page definition with the specified name
     * @param {!string} pageName
     * @return {?Element}
     */
    function getMasterPageElement(pageName) {
        var node = odfContainer.rootElement.masterStyles.firstElementChild;
        while (node) {
            if (node.namespaceURI === stylens
                && node.localName === "master-page"
                && node.getAttributeNS(stylens, "name") === pageName) {
                break;
            }
            node = node.nextElementSibling;
        }
        return node;
    }
    this.getMasterPageElement = getMasterPageElement;

    /**
     * Gets the associated page layout style node for the given style and family.
     * @param {!string} styleName
     * @param {!string} styleFamily either 'paragraph' or 'table'
     * @return {?Element}
     */
    function getPageLayoutStyleElement(styleName, styleFamily) {
        var masterPageName,
            layoutName,
            pageLayoutElements,
            /**@type{?Element}*/
            node,
            i,
            styleElement = getStyleElement(styleName, styleFamily);

        runtime.assert(styleFamily === "paragraph" || styleFamily === "table",
            "styleFamily must be either paragraph or table");

        if (styleElement) {
            masterPageName = styleElement.getAttributeNS(stylens, "master-page-name");
            if (masterPageName) {
                node = getMasterPageElement(masterPageName);
                if (!node) {
                    runtime.log("WARN: No master page definition found for " + masterPageName);
                }
            }
            // TODO If element has no master-page-name defined find the master-page-name from closest previous sibling
            // See http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#__RefHeading__1417948_253892949
            if (!node) {
                // Fallback 1: LibreOffice usually puts a page layout in called "Standard"
                node = getMasterPageElement("Standard");
            }
            if (!node) {
                // Fallback 2: Find any page style
                node = /**@type{?Element}*/(odfContainer.rootElement.masterStyles.getElementsByTagNameNS(stylens, "master-page")[0]);
                if (!node) {
                    // See http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#element-style_master-page
                    // "All documents shall contain at least one master page element."
                    runtime.log("WARN: Document has no master pages defined");
                }
            }

            if (node) {
                // It would be surprising if we still haven't found a page by now. Still, better safe than sorry!
                // Note, all warnings are already logged in the above conditions
                layoutName = node.getAttributeNS(stylens, "page-layout-name");
                pageLayoutElements = domUtils.getElementsByTagNameNS(odfContainer.rootElement.automaticStyles, stylens, "page-layout");
                for (i = 0; i < pageLayoutElements.length; i += 1) {
                    node = pageLayoutElements[i];
                    if (node.getAttributeNS(stylens, "name") === layoutName) {
                        return /** @type {!Element} */(node);
                    }
                }
            }
        }
        return null;
    }

    /**
     * @param {!string} length
     * @param {string=} defaultValue
     * @return {!number|undefined}
     */
    function lengthInPx(length, defaultValue) {
        var measure;
        if (length) {
            measure = cssUnits.convertMeasure(length, "px");
        }
        if (measure === undefined && defaultValue) {
            measure = cssUnits.convertMeasure(defaultValue, "px");
        }
        return measure;
    }

    /**
     * Gets the width and height of content area in pixels.
     * @param {string} styleName
     * @param {string} styleFamily
     * @return {!{width: number, height: number}} Available content size in pixels
     */
    this.getContentSize = function(styleName, styleFamily) {
        var pageLayoutElement,
            props,
            defaultOrientedPageWidth,
            defaultOrientedPageHeight,
            pageWidth,
            pageHeight,
            margin,
            marginLeft,
            marginRight,
            marginTop,
            marginBottom,
            padding,
            paddingLeft,
            paddingRight,
            paddingTop,
            paddingBottom;

        pageLayoutElement = getPageLayoutStyleElement(styleName, styleFamily);
        if (!pageLayoutElement) {
            pageLayoutElement = domUtils.getDirectChild(odfContainer.rootElement.styles, stylens, "default-page-layout");
        }
        props = domUtils.getDirectChild(pageLayoutElement, stylens, "page-layout-properties");
        if (props) {
            // set page's default width and height based on print orientation
            if (props.getAttributeNS(stylens, "print-orientation") === "landscape") {
                // swap the default width and height around in landscape
                defaultOrientedPageWidth = defaultPageFormatSettings.height;
                defaultOrientedPageHeight = defaultPageFormatSettings.width;
            } else {
                defaultOrientedPageWidth = defaultPageFormatSettings.width;
                defaultOrientedPageHeight = defaultPageFormatSettings.height;
            }

            pageWidth = lengthInPx(props.getAttributeNS(fons, "page-width"), defaultOrientedPageWidth);
            pageHeight = lengthInPx(props.getAttributeNS(fons, "page-height"), defaultOrientedPageHeight);

            margin = lengthInPx(props.getAttributeNS(fons, "margin"));
            if (margin === undefined) {
                marginLeft = lengthInPx(props.getAttributeNS(fons, "margin-left"), defaultPageFormatSettings.margin);
                marginRight = lengthInPx(props.getAttributeNS(fons, "margin-right"), defaultPageFormatSettings.margin);
                marginTop = lengthInPx(props.getAttributeNS(fons, "margin-top"), defaultPageFormatSettings.margin);
                marginBottom = lengthInPx(props.getAttributeNS(fons, "margin-bottom"), defaultPageFormatSettings.margin);
            } else {
                marginLeft = marginRight = marginTop = marginBottom = margin;
            }

            padding = lengthInPx(props.getAttributeNS(fons, "padding"));
            if (padding === undefined) {
                paddingLeft = lengthInPx(props.getAttributeNS(fons, "padding-left"), defaultPageFormatSettings.padding);
                paddingRight = lengthInPx(props.getAttributeNS(fons, "padding-right"), defaultPageFormatSettings.padding);
                paddingTop = lengthInPx(props.getAttributeNS(fons, "padding-top"), defaultPageFormatSettings.padding);
                paddingBottom = lengthInPx(props.getAttributeNS(fons, "padding-bottom"), defaultPageFormatSettings.padding);
            } else {
                paddingLeft = paddingRight = paddingTop = paddingBottom = padding;
            }
        } else {
            pageWidth = lengthInPx(defaultPageFormatSettings.width);
            pageHeight = lengthInPx(defaultPageFormatSettings.height);
            margin = lengthInPx(defaultPageFormatSettings.margin);
            marginLeft = marginRight = marginTop = marginBottom = margin;
            padding = lengthInPx(defaultPageFormatSettings.padding);
            paddingLeft = paddingRight = paddingTop = paddingBottom = padding;
        }
        return {
            width: pageWidth - marginLeft - marginRight - paddingLeft - paddingRight,
            height: pageHeight - marginTop - marginBottom - paddingTop - paddingBottom
        };
    };
};
