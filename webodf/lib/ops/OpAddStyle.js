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
ops.OpAddStyle = function OpAddStyle() {
    "use strict";

    var memberid, timestamp,
        styleName, styleFamily, isAutomaticStyle,
        /**@type{!odf.Formatting.StyleData}*/setProperties,
        /** @const */stylens = odf.Namespaces.stylens;

    /**
     * @param {!ops.OpAddStyle.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        styleName = data.styleName;
        styleFamily = data.styleFamily;
        // Input is either from an xml doc or potentially a manually created op
        // This means isAutomaticStyles is either a raw string of 'true', or a a native bool
        // Can't use Boolean(...) as Boolean('false') === true
        isAutomaticStyle = data.isAutomaticStyle === 'true' || data.isAutomaticStyle === true;
        setProperties = data.setProperties;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     * @return {?Array.<!ops.Operation.Event>}
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            odfContainer = odtDocument.getOdfCanvas().odfContainer(),
            formatting = odtDocument.getFormatting(),
            dom = odtDocument.getDOMDocument(),
            styleNode = dom.createElementNS(stylens, 'style:style');

        if (!styleNode) {
            return null;
        }

        if (setProperties) {
            formatting.updateStyle(styleNode, setProperties);
        }

        styleNode.setAttributeNS(stylens, 'style:family', styleFamily);
        styleNode.setAttributeNS(stylens, 'style:name', styleName);

        if (isAutomaticStyle) {
            odfContainer.rootElement.automaticStyles.appendChild(styleNode);
        } else {
            odfContainer.rootElement.styles.appendChild(styleNode);
        }

        odtDocument.getOdfCanvas().refreshCSS();
        if (!isAutomaticStyle) {
            return [{eventid: ops.OdtDocument.signalCommonStyleCreated, args: {name: styleName, family: styleFamily}}];
        }
        return [];
    };

    /**
     * @return {!ops.OpAddStyle.Spec}
     */
    this.spec = function () {
        return {
            optype: "AddStyle",
            memberid: memberid,
            timestamp: timestamp,
            styleName: styleName,
            styleFamily: styleFamily,
            isAutomaticStyle: isAutomaticStyle,
            setProperties: setProperties
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    styleName:string,
    styleFamily:string,
    isAutomaticStyle:boolean,
    setProperties:odf.Formatting.StyleData
}}*/
ops.OpAddStyle.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    styleName:string,
    styleFamily:string,
    isAutomaticStyle:(boolean|string),
    setProperties:odf.Formatting.StyleData
}}*/
ops.OpAddStyle.InitSpec;
