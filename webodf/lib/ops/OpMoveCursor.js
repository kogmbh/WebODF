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

/*global runtime, ops*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpMoveCursor = function OpMoveCursor() {
    "use strict";

    var memberid, timestamp, position, length, /**@type {!string}*/selectionType;

    /**
     * @param {!ops.OpMoveCursor.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        length = data.length || 0;
        selectionType = data.selectionType || ops.OdtCursor.RangeSelection;
    };

    this.isEdit = false;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     * @return {?Array.<!ops.Operation.Event>}
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            cursor = odtDocument.getCursor(memberid),
            selectedRange;

        if (!cursor) {
            return null;
        }

        selectedRange = odtDocument.convertCursorToDomRange(position, length);
        cursor.setSelectedRange(selectedRange, length >= 0);
        cursor.setSelectionType(selectionType);

        return [{eventid: ops.Document.signalCursorMoved, args: cursor}];
    };

    /**
     * @return {!ops.OpMoveCursor.Spec}
     */
    this.spec = function () {
        return {
            optype: "MoveCursor",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            selectionType: selectionType
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    length:number,
    selectionType:string
}}*/
ops.OpMoveCursor.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    length:number,
    selectionType:(string|undefined)
}}*/
ops.OpMoveCursor.InitSpec;
