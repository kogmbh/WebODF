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

/*global externs*/

/*jslint nomen: false, emptyblock: true, unparam: true */

/**
 * @constructor
 */
function ZipObject() { "use strict"; }

/**
 * @return {!Uint8Array}
 */
ZipObject.prototype.asUint8Array = function() { "use strict"; };

/**
 * @constructor
 */
function JSZip() { "use strict"; }

/**
 * @param {!string} filename
 * @param {!Uint8Array=} data
 * @param {*=} options
 * @return {?ZipObject}
 */
JSZip.prototype.file = function(filename, data, options) { "use strict"; };

/**
 * @type {!Array.<!ZipObject>}
 */
JSZip.prototype.files;

/**
 * @param {*} options
 * @return {*}
 */
JSZip.prototype.generate = function(options) { "use strict"; };

/**
 * @param {!Uint8Array} data
 * @param {*=} options
 * @return {undefined}
 */
JSZip.prototype.load = function(data, options) { "use strict"; };

/**
 * @param {!string} filename
 * @return {undefined}
 */
JSZip.prototype.remove = function(filename) { "use strict"; };

/**
 * @type {!function(new:JSZip)}
 */
externs.JSZip;
