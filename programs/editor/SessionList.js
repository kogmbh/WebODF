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

/*global ops, runtime */
/*jslint emptyblock: true, unparam: true*/

/**
 * A model which provides information about sessions.
 * @interface
 */
function SessionList() {"use strict"; }

/**
 * @param {{onCreated:function(!Object),
 *          onUpdated:function(!Object),
 *          onRemoved:function(!string) }} subscriber
 * @return {undefined}
 */
SessionList.prototype.getSessions = function (subscriber) {"use strict"; };

/**
 * @param {{onCreated:function(!Object),
 *          onUpdated:function(!Object),
 *          onRemoved:function(!string) }} subscriber
 * @return {undefined}
 */
SessionList.prototype.unsubscribe = function (subscriber) {"use strict"; };

/**
 * Per default updates are enabled.
 * @param {!boolean} enabled
 * @return {undefined}
 */
SessionList.prototype.setUpdatesEnabled = function (enabled) {"use strict"; };
