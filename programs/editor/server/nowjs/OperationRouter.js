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

/*global runtime, ops, now */

/*
 * route operations in a networked collaborative manner.
 *
 * incoming operations (from controller) are sent to a server,
 * who will distribute them.
 *
 * incoming operations (from the server are played on the DOM.
 */

define("webodf/editor/server/nowjs/OperationRouter", [], function () {
    "use strict";

    /**
     * @constructor
     * @implements ops.OperationRouter
     */
    return function NowjsOperationRouter(sessionId, memberid, server) {

        var operationFactory,
            playbackFunction,
            nowObject = server.getNowObject(),
            last_server_seq = -1, // first seq will be 0
            reorder_queue = {},
            sends_since_server_op = 0,
            router_sequence = 1000;

        function nextNonce() {
            runtime.assert(memberid !== null, "Router sequence N/A without memberid");
            router_sequence += 1;
            return "C:"+memberid+":"+router_sequence;
        }

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
         * @param {{server_seq: number}} opspec
         */
        function receiveOpFromNetwork(opspec) {
            // use factory to create an instance, and playback!
            var idx, seq, op = operationFactory.create(opspec);
            runtime.log(" op in: "+runtime.toJson(opspec));
            if (op !== null) {
                seq = Number(opspec.server_seq);
                runtime.assert(!isNaN(seq), "server seq is not a number");
                if (seq === (last_server_seq + 1)) {
                    playbackFunction(op);
                    last_server_seq = seq;
                    sends_since_server_op = 0;
                    for (idx = (last_server_seq + 1);
                            reorder_queue.hasOwnProperty(idx);
                            idx += 1) {
                        playbackFunction(reorder_queue[idx]);
                        delete reorder_queue[idx];
                        runtime.log("op with server seq "+seq+" taken from hold (reordered)");
                    }
                } else {
                    // i'm not sure if now.js actually prevents receiving incorrectly ordered ops
                    runtime.assert(seq !== (last_server_seq + 1), "received incorrect order from server");
                    // but if now.js does not prevent it, we have code to re-order

                    // re-order incoming ops from server (hold and un-hold)
                    runtime.assert(!reorder_queue.hasOwnProperty(seq), "reorder_queue has incoming op");
                    runtime.log("op with server seq "+seq+" put on hold");
                    reorder_queue[seq] = op;
                }
            } else {
                runtime.log("ignoring invalid incoming opspec: " + opspec);
            }
        }
        nowObject.ping = function (pong) {
            if (memberid !== null) {
                pong(memberid);
            }
        };
        nowObject.receiveOp = function(op_session_id, opspec) {
            if (op_session_id === sessionId) {
                receiveOpFromNetwork(opspec);
            }
        };

        /**
         * Brings the locally created operations into the game.
         *
         * @param {!Array.<!ops.Operation>} operations
         * @return {undefined}
         */
        this.push = function (operations) {
            operations.forEach(function(op) {
                // add client nonce and reference to server-side-op-sequence
                var opspec = op.spec();
                opspec.client_nonce = nextNonce();
                opspec.parent_op = last_server_seq+"+"+sends_since_server_op;
                sends_since_server_op += 1;

                runtime.log("op out: "+runtime.toJson(opspec));
                nowObject.deliverOp(sessionId, opspec);
            });
        };

        this.requestReplay = function (done_cb) {
            nowObject.requestReplay(
                sessionId,
                function (opspec) {
                    runtime.log("replaying: " + runtime.toJson(opspec));
                    receiveOpFromNetwork(opspec);
                },
                function (count) {
                    runtime.log("replay done (" + count + " ops).");
                    if (done_cb) {
                        done_cb();
                    }
                }
            );
        };

        /*jslint emptyblock: true, unparam: true*/
        this.close = function (cb) {
            // TODO: implement this.
            cb();
        };
        /*jslint emptyblock: false, unparam: false*/
    };
});
