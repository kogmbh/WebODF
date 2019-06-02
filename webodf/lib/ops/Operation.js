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
/*jslint emptyblock: true, unparam: true*/

/**
 * An operation that can be performed on a document.
 * @interface
 */
ops.Operation = function Operation() {
    "use strict";
};

/**@typedef{{
    eventid:!string,
    args:*
}}*/
ops.Operation.Event;

/**
 * @param {?} data
 * @return {undefined}
 */
ops.Operation.prototype.init = function (data) {"use strict"; };

/**
 * This is meant to indicate whether
 * the operation is an 'edit', i.e.
 * causes any changes that would make
 * it into the saved ODF.
 * @type {!boolean}
 */
ops.Operation.prototype.isEdit;

/**
 * @type {string}
 */
ops.Operation.prototype.group;

/**
 * @param {!ops.Document} document
 * @return {?Array.<!ops.Operation.Event>} a list of events if the operation was executed, otherwise null
 */
ops.Operation.prototype.execute = function (document) {"use strict"; };

/**
 * @return {!{optype:string,memberid:string,timestamp:number}}
 */
ops.Operation.prototype.spec = function () {"use strict"; };
