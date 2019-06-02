/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global ops, xmldom, odf, runtime*/

/**
 * OpUpdateMember allows you to set and remove
 * certain properties.
 * 'fullName', 'color', and 'imageUrl' are not
 * removable, they will be filtered out of 
 * removedProperties if found.
 * @constructor
 * @implements ops.Operation
 */
ops.OpUpdateMember = function OpUpdateMember() {
    "use strict";

    var /**@type{string}*/
        memberid,
        timestamp,
        /**@type{ops.MemberProperties}*/
        setProperties,
        removedProperties;

    /**
     * @param {!ops.OpUpdateMember.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = parseInt(data.timestamp, 10);
        setProperties = data.setProperties;
        removedProperties = data.removedProperties;
    };

    this.isEdit = false;
    this.group = undefined;

    /**
     * @param {!ops.OdtDocument} doc
     */
    function updateCreators(doc) {
        var xpath = xmldom.XPath,
            xp = "//dc:creator[@editinfo:memberid='" + memberid + "']",
            creators = xpath.getODFElementsWithXPath(doc.getRootNode(), xp, function (prefix) {
                if (prefix === "editinfo") {
                    return "urn:webodf:names:editinfo";
                }
                return odf.Namespaces.lookupNamespaceURI(prefix);
            }),
            i;

        for (i = 0; i < creators.length; i += 1) {
            creators[i].textContent = setProperties.fullName;
        }
    }

    /**
     * @param {!ops.Document} document
     * @return {?Array.<!ops.Operation.Event>}
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            member = odtDocument.getMember(memberid);
        if (!member) {
            return null;
        }

        if (removedProperties) {
            member.removeProperties(removedProperties);
        }
        if (setProperties) {
            member.setProperties(setProperties);
            if (setProperties.fullName) {
                updateCreators(odtDocument);
            }
        }

        return [{eventid: ops.Document.signalMemberUpdated, args: member}];
    };

    /**
     * @return {!ops.OpUpdateMember.Spec}
     */
    this.spec = function () {
        return {
            optype: "UpdateMember",
            memberid: memberid,
            timestamp: timestamp,
            setProperties: setProperties,
            removedProperties: removedProperties
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    setProperties:?ops.MemberProperties,
    removedProperties:Object
 }}*/
ops.OpUpdateMember.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    setProperties:?ops.MemberProperties,
    removedProperties:Object
 }}*/
ops.OpUpdateMember.InitSpec;
