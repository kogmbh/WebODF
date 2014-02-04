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

/*global ops, gui*/
/*jslint emptyblock: true, unparam: true*/

/**
 * @interface
 */
gui.UndoManager = function UndoManager() {"use strict"; };

/**
 * Subscribe to events related to the undo manager
 * @param {!string} signal
 * @param {!Function} callback
 */
gui.UndoManager.prototype.subscribe = function(signal, callback) {"use strict"; };

/**
 * Unsubscribe to events related to the undo manager
 * @param {!string} signal
 * @param {!Function} callback
 */
gui.UndoManager.prototype.unsubscribe = function(signal, callback) {"use strict"; };

/**
 * Set the Document to operate on
 * @param {!ops.Document} newDocument
 */
gui.UndoManager.prototype.setDocument = function (newDocument) {"use strict"; };

/**
 * Sets the initial document state and operation state. This is the earliest point
 * the document can be undone to.
 */
gui.UndoManager.prototype.setInitialState = function () {"use strict"; };

/**
 * Initializes the undo manager and creates the initial document
 * snapshot. If the undo manager has already been previously initialized,
 * this call will do nothing.
 */
gui.UndoManager.prototype.initialize = function () {"use strict"; };

/**
 * Purges entire undo stack including the initial state. This is primarily intended
 * to free up memory and resources when the undo state is no longer required.
 */
gui.UndoManager.prototype.purgeInitialState = function () {"use strict"; };

/**
 * Sets the playback function to use to re-execute operations from the undo stack.
 * @param {!function(!Array.<!ops.Operation>)} playback_func
 */
gui.UndoManager.prototype.setPlaybackFunction = function (playback_func) {"use strict"; };

/**
 * Returns true if there are one or more undo states available
 * @return {boolean}
 */
gui.UndoManager.prototype.hasUndoStates = function () {"use strict"; };

/**
 * Returns true if there are one or more redo states available
 * @return {boolean}
 */
gui.UndoManager.prototype.hasRedoStates = function () {"use strict"; };

/**
 * Move forward the desired number of states. Will stop when the number of
 * states is reached, or no more redo states are available.
 * @param {!number} states
 * @return {!number} Returns the number of states actually moved
 */
gui.UndoManager.prototype.moveForward = function (states) {"use strict"; };

/**
 * Move backward the desired number of states. Will stop when the number of
 * states is reached, or no more undo states are available.
 * @param {!number} states
 * @return {!number} Returns the number of states actually moved
 */
gui.UndoManager.prototype.moveBackward = function (states) {"use strict"; };

/**
 * Track the execution of an operation, and add it to the available undo states
 * @param {!ops.Operation} op
 * @return {undefined}
 */
gui.UndoManager.prototype.onOperationExecuted = function (op) {"use strict"; };

/**@const*/gui.UndoManager.signalUndoStackChanged = "undoStackChanged";
/**@const*/gui.UndoManager.signalUndoStateCreated = "undoStateCreated";
/**@const*/gui.UndoManager.signalUndoStateModified = "undoStateModified";

(function () {
    "use strict";
    return gui.UndoManager;
}());
