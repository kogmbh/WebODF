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

    var operationFactory,
        playbackFunction;

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
     * @param {!function(!ops.Operation)} playback_func
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
        operations.forEach(function(op) {
            var timedOp,
                opspec = op.spec();

            opspec.timestamp = (new Date()).getTime();
            timedOp = operationFactory.create(opspec);

            playbackFunction(timedOp);
        });
    };

    this.close = function (cb) {
        cb();
    };
};
