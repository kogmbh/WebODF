/**
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
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
 * Abstracts any backend that provides a session.
 * @interface
 */
function SessionBackend() {"use strict"; }

/**
 * Get the memberId (a unique identifier for this client) for the current session.
 * @return {!string}
 */
SessionBackend.prototype.getMemberId = function () {"use strict"; };

/**
 * @param {!odf.OdfContainer} odfContainer TODO: needed for pullbox writing to server at end, find better solution
 * @param {!function(!Object)} errorCallback
 * @return {!ops.OperationRouter}
 */
SessionBackend.prototype.createOperationRouter = function (odfContainer, errorCallback) {"use strict"; };

/**
 * A URL to the document in it's initial state, before the playback of any operations.
 * @return {!string}
 */
SessionBackend.prototype.getGenesisUrl = function () {"use strict"; };
