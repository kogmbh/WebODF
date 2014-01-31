/**
 * @license
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
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
/*global ops, runtime, core*/

runtime.loadClass("core.EventNotifier");

/*
 * route the operations.
 * this implementation immediately passes them to the
 * playback function.
 * other implementations might want to send them to a
 * server and wait for foreign ops.
 */

/**
 * @constructor
 * @implements ops.OperationRouter
 */
ops.TrivialOperationRouter = function TrivialOperationRouter() {
    "use strict";

    var events = new core.EventNotifier([
            ops.OperationRouter.signalProcessingBatchStart,
            ops.OperationRouter.signalProcessingBatchEnd
        ]),
        operationFactory,
        playbackFunction,
        groupIdentifier = 0;

    /**
     * Sets the factory to use to create operation instances from operation specs.
     *
     * @param {!ops.OperationFactory} f
     * @return {undefined}
     */
    this.setOperationFactory = function (f) {
        operationFactory = f;
    };

    /**
     * Sets the method which should be called to apply operations.
     *
     * @param {!function(!ops.Operation):boolean} playback_func
     * @return {undefined}
     */
    this.setPlaybackFunction = function (playback_func) {
        playbackFunction = playback_func;
    };

    /**
     * Brings the locally created operations into the game.
     *
     * @param {!Array.<!ops.Operation>} operations
     * @return {undefined}
     */
    this.push = function (operations) {
        // This is an extremely simplistic and VERY temporary implementation of operation grouping.
        // In order to improve undo behaviour, the undo manager requires knowledge about what groups
        // of operations were queued together, so these can be stored in a single undo state.
        // The current implementation is only designed for a localeditor instance & the TrivialUndoManager.
        // TODO redesign this concept to work with collaborative editing
        groupIdentifier += 1;
        events.emit(ops.OperationRouter.signalProcessingBatchStart, {});
        operations.forEach(function(op) {
            var timedOp,
                opspec = op.spec();

            opspec.timestamp = (new Date()).getTime();
            timedOp = operationFactory.create(opspec);
            timedOp.group = "g" + groupIdentifier;

            // TODO: handle return flag in error case
            playbackFunction(timedOp);
        });
        events.emit(ops.OperationRouter.signalProcessingBatchEnd, {});
    };

    this.close = function (cb) {
        cb();
    };

    /**
     * @param {!string} eventId
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function(eventId, cb) {
        events.subscribe(eventId, cb);
    };

    /**
     * @param {!string} eventId
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function(eventId, cb) {
        events.unsubscribe(eventId, cb);
    };

    /**
     * @return {!boolean}
     */
    this.hasLocalUnsyncedOps = function () {
        return false;
    };

    /**
     * @return {!boolean}
     */
    this.hasSessionHostConnection = function () {
        return true;
    };
};
