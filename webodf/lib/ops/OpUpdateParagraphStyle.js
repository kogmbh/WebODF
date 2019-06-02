/**
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, odf, ops*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpUpdateParagraphStyle = function OpUpdateParagraphStyle() {
    "use strict";

    var memberid, timestamp, styleName,
        /**@type{!odf.Formatting.StyleData}*/
        setProperties,
        /**@type{{attributes:string}}*/
        removedProperties,
        /**@const*/
        paragraphPropertiesName = 'style:paragraph-properties',
        /**@const*/
        textPropertiesName = 'style:text-properties',
        /**@const*/
        stylens = odf.Namespaces.stylens;

    /**
     * Removes attributes of a node by the names listed in removedAttributeNames.
     * @param {!Element} node
     * @param {!string} removedAttributeNames
     */
    function removedAttributesFromStyleNode(node, removedAttributeNames) {
        var i, attributeNameParts,
            /**@type{!Array.<string>}*/
            attributeNameList = removedAttributeNames ? removedAttributeNames.split(',') : [];

        for (i = 0; i < attributeNameList.length; i += 1) {
            attributeNameParts = attributeNameList[i].split(":");
            // TODO: ensure all used prefixes have a namespaces listed
            node.removeAttributeNS(/**@type{string}*/(odf.Namespaces.lookupNamespaceURI(attributeNameParts[0])), attributeNameParts[1]);
        }
    }

    /**
     * @param {!ops.OpUpdateParagraphStyle.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        styleName = data.styleName;
        setProperties = data.setProperties;
        removedProperties = data.removedProperties;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     * @return {?Array.<!ops.Operation.Event>}
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            formatting = odtDocument.getFormatting(),
            styleNode, object,
            paragraphPropertiesNode, textPropertiesNode;

        if (styleName !== "") {
            // Common Style
            styleNode = formatting.getStyleElement(styleName, 'paragraph');
        } else {
            // Default Style
            styleNode = formatting.getDefaultStyleElement('paragraph');
        }

        if (styleNode) {
            paragraphPropertiesNode = /**@type{Element}*/(styleNode.getElementsByTagNameNS(stylens, 'paragraph-properties').item(0));
            textPropertiesNode = /**@type{Element}*/(styleNode.getElementsByTagNameNS(stylens, 'text-properties').item(0));

            if (setProperties) {
                formatting.updateStyle(styleNode, setProperties);
            }

            // remove attributes in the style nodes
            if (removedProperties) {
                object = /**@type{{attributes:string}}*/(removedProperties[paragraphPropertiesName]);
                if (paragraphPropertiesNode && object) {
                    removedAttributesFromStyleNode(paragraphPropertiesNode, object.attributes);
                    if (paragraphPropertiesNode.attributes.length === 0) {
                        styleNode.removeChild(paragraphPropertiesNode);
                    }
                }

                object = /**@type{{attributes:string}}*/(removedProperties[textPropertiesName]);
                if (textPropertiesNode && object) {
                    // TODO: check if fontname can be removed from font-face-declaration
                    removedAttributesFromStyleNode(textPropertiesNode, object.attributes);
                    if (textPropertiesNode.attributes.length === 0) {
                        styleNode.removeChild(textPropertiesNode);
                    }
                }

                removedAttributesFromStyleNode(styleNode, removedProperties.attributes);
            }

            odtDocument.getOdfCanvas().refreshCSS();
            odtDocument.getOdfCanvas().rerenderAnnotations();
            return [{eventid:ops.OdtDocument.signalParagraphStyleModified, args: styleName}];
        }
        return null;
    };

    /**
     * @return {!ops.OpUpdateParagraphStyle.Spec}
     */
    this.spec = function () {
        return {
            optype: "UpdateParagraphStyle",
            memberid: memberid,
            timestamp: timestamp,
            styleName: styleName,
            setProperties: setProperties,
            removedProperties: removedProperties
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    styleName:string,
    setProperties:!odf.Formatting.StyleData,
    removedProperties:{attributes:string}
}}*/
ops.OpUpdateParagraphStyle.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    styleName:string,
    setProperties:!odf.Formatting.StyleData,
    removedProperties:{attributes:string}
}}*/
ops.OpUpdateParagraphStyle.InitSpec;
