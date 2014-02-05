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

/*global ops */
/*jslint emptyblock: true, unparam: true */

/**
 * A document that keeps all data related to the mapped document.
 * @interface
 */
ops.Document = function Document() { "use strict"; };
/**
 * @return {!Array.<string>}
 */
ops.Document.prototype.getMemberIds = function () { "use strict"; };
/**
 * @param {!string} memberid
 * @return {!boolean}
 */
ops.Document.prototype.removeCursor = function (memberid) { "use strict"; };
/**
 * @return {!Element}
 */
ops.Document.prototype.getDocumentElement = function () { "use strict"; };
/**
 * Return the element where the document content begins.
 * Document content means the body of the document. In the case of ODF this is
 * office:text, office:spreadsheet, office:presentation. For most XML documents
 * getRootNode() will return the same node as getDocumentElement().
 * @return {!Element}
 */
ops.Document.prototype.getRootNode = function () { "use strict"; };
/**
 * @return {!Document}
 */
ops.Document.prototype.getDOMDocument = function () { "use strict"; };
/**
 * @return {!Element}
 */
ops.Document.prototype.cloneDocumentElement = function () { "use strict"; };
/**
 * @param {!Element} element
 * @return {undefined}
 */
ops.Document.prototype.setDocumentElement = function (element) { "use strict"; };
/**
 * @param {!string} eventid
 * @param {!Function} cb
 * @return {undefined}
 */
ops.Document.prototype.subscribe = function (eventid, cb) { "use strict"; };
/**
 * @param {!string} eventid
 * @param {!Function} cb
 * @return {undefined}
 */
ops.Document.prototype.unsubscribe = function (eventid, cb) { "use strict"; };
// vim:expandtab
/**
 * @return {!ops.Canvas}
 */
ops.Document.prototype.getCanvas = function () { "use strict"; };
