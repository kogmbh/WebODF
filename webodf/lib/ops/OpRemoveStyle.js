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

/*global ops*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpRemoveStyle = function OpRemoveStyle() {
    "use strict";

    var memberid, timestamp, styleName, styleFamily;

    /**
     * @param {!ops.OpRemoveStyle.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        styleName = data.styleName;
        styleFamily = data.styleFamily;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     * @return {?Array.<!ops.Operation.Event>}
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            styleNode = odtDocument.getFormatting().getStyleElement(styleName, styleFamily);

        if (!styleNode) {
            return null;
        }

        styleNode.parentNode.removeChild(styleNode);

        odtDocument.getOdfCanvas().refreshCSS();

        return [{eventid: ops.OdtDocument.signalCommonStyleDeleted, args: {name: styleName, family: styleFamily}}];
    };

    /**
     * @return {!ops.OpRemoveStyle.Spec}
     */
    this.spec = function () {
        return {
            optype: "RemoveStyle",
            memberid: memberid,
            timestamp: timestamp,
            styleName: styleName,
            styleFamily: styleFamily
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    styleName:string,
    styleFamily:string
 }}*/
ops.OpRemoveStyle.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    styleName:string,
    styleFamily:string
 }}*/
ops.OpRemoveStyle.InitSpec;
