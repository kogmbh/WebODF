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

/*global ops, runtime*/

/**
 * OpAddMember has 3 required properties:
 * fullName, color, and imageUrl. Because the
 * spec does not expose those explicitly right now,
 * internally these properties are set as
 * runtime.tr("Unknown Author"), 'black', and "avatar-joe.png"
 * respectively, if unspecified.
 * @constructor
 * @implements ops.Operation
 */
ops.OpAddMember = function OpAddMember() {
    "use strict";

    var memberid, timestamp, setProperties;
    /**
     * @param {!ops.OpAddMember.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = parseInt(data.timestamp, 10);
        setProperties = data.setProperties;
    };

    this.isEdit = false;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     * @return {?Array.<!ops.Operation.Event>}
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            member;
        if (odtDocument.getMember(memberid)) {
            return null;
        }

        member = new ops.Member(memberid, setProperties);
        odtDocument.addMember(member);

        return [{eventid: ops.Document.signalMemberAdded, args: member}];
    };

    /**
     * @return {!ops.OpAddMember.Spec}
     */
    this.spec = function () {
        return {
            optype: "AddMember",
            memberid: memberid,
            timestamp: timestamp,
            setProperties: setProperties
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    setProperties:!ops.MemberProperties
}}*/
ops.OpAddMember.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    setProperties:!ops.MemberProperties
}}*/
ops.OpAddMember.InitSpec;
