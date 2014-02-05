/**
 * @license
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

runtime.loadClass("ops.Member");

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpRemoveMember = function OpRemoveMember() {
    "use strict";

    var memberid, timestamp;

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = parseInt(data.timestamp, 10);
    };

    this.isEdit = false;
    this.group = undefined;

    this.execute = function (odtDocument) {
        if (!odtDocument.getMember(memberid)) {
            return false;
        }

        odtDocument.removeMember(memberid);
        odtDocument.emit(ops.OdtDocument.signalMemberRemoved, memberid);

        return true;
    };

    this.spec = function () {
        return {
            optype: "RemoveMember",
            memberid: memberid,
            timestamp: timestamp
        };
    };
};
