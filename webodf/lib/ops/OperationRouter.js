/**
 * @license
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
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
 * @source: http://gitorious.org/webodf/webodf/
 */

/*global ops*/
/*jslint emptyblock: true, unparam: true*/

/**
 * @interface
 */
ops.OperationRouter = function OperationRouter() {"use strict"; };

/**
 * Sets the factory to use to create operation instances from operation specs.
 *
 * @param {!ops.OperationFactory} f
 * @return {undefined}
 */
ops.OperationRouter.prototype.setOperationFactory = function (f) {"use strict"; };

/**
 * Sets the method which should be called to apply operations.
 *
 * @param {!function(!ops.Operation)} playback_func
 * @return {undefined}
 */
ops.OperationRouter.prototype.setPlaybackFunction = function (playback_func) {"use strict"; };

/**
 * Brings the locally created operations into the game.
 * The ops are guaranteed to be executed directly after each other, in the given order
 * (first will be executed first).
 * TODO: currently all known implementations only use the specs of the operations,
 * so it might make sense to not create any operations outside of the operation router at all
 * and instead just create specs and pass them to this push method?
 *
 * @param {!Array.<!ops.Operation>} operations
 * @return {undefined}
 */
ops.OperationRouter.prototype.push = function (operations) {"use strict"; };

/**
 * Requests a gracefull shutdown of the Operation Router.
 * Buffered operations shall be sent to the server.
 * A callback is called, getting passed an error object in case of error.
 *
 * @param {!function(!Object=)} callback
 * @return {undefined}
 */
ops.OperationRouter.prototype.close = function (callback) {"use strict"; };
