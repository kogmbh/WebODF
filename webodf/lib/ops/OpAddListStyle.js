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

/*global ops, runtime, odf, core*/

/**
 *
 * @constructor
 * @implements ops.Operation
 */
ops.OpAddListStyle = function OpAddListStyle() {
    "use strict";

    var memberid,
        timestamp,
        isAutomaticStyle,
        styleName,
        /**@type{!ops.OpAddListStyle.ListStyle}*/
        listStyle,
        /**@const*/
        textns = odf.Namespaces.textns,
        /**@const*/
        stylens = odf.Namespaces.stylens;

    /**
     * @param {!ops.OpAddListStyle.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        isAutomaticStyle = data.isAutomaticStyle;
        styleName = data.styleName;
        listStyle = data.listStyle;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @return {!ops.OpAddListStyle.Spec}
     */
    this.spec = function () {
        return {
            optype: "AddListStyle",
            memberid: memberid,
            timestamp: timestamp,
            isAutomaticStyle: isAutomaticStyle,
            styleName: styleName,
            listStyle: listStyle
        };
    };

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{!ops.OdtDocument}*/(document),
            odfContainer = odtDocument.getOdfCanvas().odfContainer(),
            ownerDocument = odtDocument.getDOMDocument(),
            formatting = odtDocument.getFormatting(),
            styleNode = ownerDocument.createElementNS(textns, "text:list-style");

        if(!styleNode) {
            return false;
        }

        listStyle.forEach(function (listLevelStyle) {
            var newListLevelNode = ownerDocument.createElementNS(textns, listLevelStyle.styleType);
            formatting.updateStyle(newListLevelNode, listLevelStyle.styleProperties);
            styleNode.appendChild(newListLevelNode);
        });

        styleNode.setAttributeNS(stylens, 'style:name', styleName);

        if (isAutomaticStyle) {
            odfContainer.rootElement.automaticStyles.appendChild(styleNode);
        } else {
            odfContainer.rootElement.styles.appendChild(styleNode);
        }

        odtDocument.getOdfCanvas().refreshCSS();
        if (!isAutomaticStyle) {
            odtDocument.emit(ops.OdtDocument.signalCommonStyleCreated, {name: styleName, family: "list-style"});
        }
        return true;
    };
};

/**@typedef{{
    optype: !string,
    memberid: !string,
    timestamp: !number,
    isAutomaticStyle: !boolean,
    styleName: !string,
    listStyle: !ops.OpAddListStyle.ListStyle
}}*/
ops.OpAddListStyle.Spec;

/**@typedef{{
    memberid: !string,
    timestamp:(!number|undefined),
    isAutomaticStyle: !boolean,
    styleName: !string,
    listStyle: !ops.OpAddListStyle.ListStyle
}}*/
ops.OpAddListStyle.InitSpec;

/**@typedef{!Array.<{styleType: !string, styleProperties: !Object}>}*/
ops.OpAddListStyle.ListStyle;