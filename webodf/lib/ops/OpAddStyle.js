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

/*global runtime, odf, ops*/

runtime.loadClass("odf.Namespaces");

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpAddStyle = function OpAddStyle() {
    "use strict";

    var memberid, timestamp,
        styleName, styleFamily, isAutomaticStyle,
        /**@type{Object}*/setProperties,
        /** @const */stylens = odf.Namespaces.stylens;

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

    this.execute = function (odtDocument) {
        var odfContainer = odtDocument.getOdfCanvas().odfContainer(),
            formatting = odtDocument.getFormatting(),
            dom = odtDocument.getDOMDocument(),
            styleNode = dom.createElementNS(stylens, 'style:style');

        if (!styleNode) {
            return false;
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
            odtDocument.emit(ops.OdtDocument.signalCommonStyleCreated, {name: styleName, family: styleFamily});
        }
        return true;
    };

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
    setProperties:Object
}}*/
ops.OpAddStyle.Spec;
