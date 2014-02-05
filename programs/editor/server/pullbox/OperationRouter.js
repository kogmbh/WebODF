/**
 * @license
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, ops*/

define("webodf/editor/server/pullbox/OperationRouter", [], function () {
    "use strict";

    // TODO: these eventid strings should be defined at OperationRouter interface
    var /**@const @type {!string}*/
        EVENT_BEFORESAVETOFILE =                  "beforeSaveToFile",
        /**@const @type {!string}*/
        EVENT_SAVEDTOFILE =                       "savedToFile",
        /**@const @type {!string}*/
        EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED = "hasLocalUnsyncedOperationsChanged",
        /**@const @type {!string}*/
        EVENT_HASSESSIONHOSTCONNECTIONCHANGED =   "hasSessionHostConnectionChanged";

    runtime.loadClass("ops.OperationTransformer");
    runtime.loadClass("core.EventNotifier");

    /**
     * route operations in a networked collaborative manner.
     *
     * incoming operations (from controller) are sent to a server,
     * who will distribute them.
     *
     * incoming operations (from the server are played on the DOM.
     */

    /**
     * @constructor
     * @implements ops.OperationRouter
     */
    return function PullBoxOperationRouter(sessionId, memberId, server, odfContainer, errorCallback) {
        "use strict";

        var operationFactory,
            /**@type{function(!ops.Operation):boolean}*/
            playbackFunction,
            idleTimeout = null,
            syncOpsTimeout = null,
            /**@type{!boolean}*/
            isInstantSyncRequested = false,
            /**@type{!boolean}*/
            isPlayingUnplayedServerOpSpecs = false,
            /**@type{!boolean}*/
            isSyncCallRunning = false,
            /**@type{!boolean}*/
            hasError = false,
            /**@type{!boolean}*/
            syncingBlocked = false,
            /** @type {!string} id of latest op stack state known on the server */
            lastServerSeq = "",
            /** @type {!Array.<!Function>} sync request callbacks created since the last sync call to the server */
            syncRequestCallbacksQueue = [],
            /** @type {!Array.<!Object>} ops created since the last sync call to the server */
            unsyncedClientOpspecQueue = [],
            /** @type {!Array.<!Object>} ops already received from the server but not yet applied */
            unplayedServerOpspecQueue = [],
            /** @type {!Array.<!Function>} sync request callbacks which should be called after the received ops have been applied server */
            uncalledSyncRequestCallbacksQueue = [],
            /** @type {!Array.<!function(!boolean):undefined>} ops created since the last sync call to the server */
            hasLocalUnsyncedOpsStateSubscribers = [],
            /**@type{!boolean}*/
            hasLocalUnsyncedOps = false,
            /** @type {!Array.<!function(!boolean):undefined>} */
            hasSessionHostConnectionStateSubscribers = [],
            /**@type{!boolean}*/
            hasSessionHostConnection = true,
            eventNotifier = new core.EventNotifier([
                EVENT_BEFORESAVETOFILE,
                EVENT_SAVEDTOFILE,
                EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED,
                EVENT_HASSESSIONHOSTCONNECTIONCHANGED,
                ops.OperationRouter.signalProcessingBatchStart,
                ops.OperationRouter.signalProcessingBatchEnd
            ]),
            /**@type{!boolean} tells if any local ops have been modifying ops */
            hasPushedModificationOps = false,
            operationTransformer = new ops.OperationTransformer(),
            /**@const*/replayTime = 500,
            /**@const*/syncOpsDelay = 3000,
            /**@const*/idleDelay = 5000;

        /**
         * @return {undefined}
         */
        function updateHasLocalUnsyncedOpsState() {
            var i,
                hasLocalUnsyncedOpsNow = (unsyncedClientOpspecQueue.length > 0);

            // no change?
            if (hasLocalUnsyncedOps === hasLocalUnsyncedOpsNow) {
                return;
            }

            hasLocalUnsyncedOps = hasLocalUnsyncedOpsNow;
            eventNotifier.emit(EVENT_HASLOCALUNSYNCEDOPERATIONSCHANGED, hasLocalUnsyncedOps);
        }

        /**
         * @param {!boolean} hasConnection
         * @return {undefined}
         */
        function updateHasSessionHostConnectionState(hasConnection) {
            var i;

            // no change?
            if (hasSessionHostConnection === hasConnection) {
                return;
            }

            hasSessionHostConnection = hasConnection;
            eventNotifier.emit(EVENT_HASSESSIONHOSTCONNECTIONCHANGED, hasSessionHostConnection);
        }

        /**
         * @return {undefined}
         */
        function playUnplayedServerOpSpecs() {
            /**
             * @return {undefined}
             */
            function doPlayUnplayedServerOpSpecs() {
                var opspec, op, startTime, i;

                isPlayingUnplayedServerOpSpecs = false;

                // take start time
                startTime = (new Date()).getTime();

                eventNotifier.emit(ops.OperationRouter.signalProcessingBatchStart, {});

                // apply as much as possible in the given time
                while (unplayedServerOpspecQueue.length > 0) {
                    // time over?
                    if ((new Date().getTime()) - startTime > replayTime) {
                        break;
                    }

                    opspec = unplayedServerOpspecQueue.shift();

                    // use factory to create an instance, and playback!
                    op = operationFactory.create(opspec);
                    runtime.log(" op in: "+runtime.toJson(opspec));
                    if (op !== null) {
                        if (!playbackFunction(op)) {
                            eventNotifier.emit(ops.OperationRouter.signalProcessingBatchEnd, {});
                            hasError = true;
                            errorCallback("opExecutionFailure");
                            return;
                        }
                    } else {
                        eventNotifier.emit(ops.OperationRouter.signalProcessingBatchEnd, {});
                        hasError = true;
                        runtime.log("ignoring invalid incoming opspec: " + opspec);
                        errorCallback("unknownOpReceived");
                        return;
                    }
                }

                eventNotifier.emit(ops.OperationRouter.signalProcessingBatchEnd, {});

                // still unplayed opspecs?
                if (unplayedServerOpspecQueue.length > 0) {
                    // let other events be handled. then continue
                    isPlayingUnplayedServerOpSpecs = true;
                    runtime.getWindow().setTimeout(doPlayUnplayedServerOpSpecs, 1);
                } else {
                    // finally call all the callbacks waiting for that sync!
                    for (i = 0; i < uncalledSyncRequestCallbacksQueue.length; i += 1) {
                        uncalledSyncRequestCallbacksQueue[i]();
                    }

                    uncalledSyncRequestCallbacksQueue = [];
                }
            }

            if (isPlayingUnplayedServerOpSpecs) {
                return;
            }
            doPlayUnplayedServerOpSpecs();
        }

        /**
         * @param {Array.<!Object>} opspecs
         * @param {Array.<!Function>} callbacks
         * @return {undefined}
         */
        function receiveOpSpecsFromNetwork(opspecs, callbacks) {
            // append to existing unplayed
            unplayedServerOpspecQueue = unplayedServerOpspecQueue.concat(opspecs);
            uncalledSyncRequestCallbacksQueue = uncalledSyncRequestCallbacksQueue.concat(callbacks);
        }

        /**
         * Transforms the unsynced client ops and the server ops,
         * applies the server ops after transformation
         * @param {Array.<!Object>} serverOpspecs
         * @return {!boolean}
         */
        function handleOpsSyncConflict(serverOpspecs) {
            var i,
                transformResult;

            if (! serverOpspecs) {
                // TODO: proper error message, stop working
                runtime.assert(false, "no opspecs received!");
                return false;
            } // TODO: more checking of proper content in serverOpspecs

            transformResult = operationTransformer.transform(unsyncedClientOpspecQueue, /**@type{!Array.<!Object>}*/(serverOpspecs));

            if (!transformResult) {
                return false;
            }

            // store transformed server ops
            for (i = 0; i < transformResult.opsB.length; i += 1) {
                unplayedServerOpspecQueue.push(transformResult.opsB[i].spec());
            }

            // store opspecs of all transformed client opspecs
            unsyncedClientOpspecQueue = [];
            for (i = 0; i < transformResult.opsA.length; i += 1) {
                unsyncedClientOpspecQueue.push(transformResult.opsA[i].spec());
            }

            return true;
        }

        /**
         * @return {undefined}
         */
        function syncOps() {
            var syncedClientOpspecs,
                syncRequestCallbacksArray;

            /**
             * @return {undefined}
             */
            function startSyncOpsTimeout() {
                idleTimeout = null;
                syncOpsTimeout = runtime.getWindow().setTimeout(function() {
                    syncOpsTimeout = null;
                    syncOps();
                }, syncOpsDelay);
            }

            if (isSyncCallRunning || hasError) {
                return;
            }
            // TODO: hack, remove
            if (syncingBlocked) {
                return;
            }

runtime.log("OperationRouter: sending sync_ops call");
            // no more instant pull request in any case
            isInstantSyncRequested = false;
            // set lock
            isSyncCallRunning = true;

            // take specs from queue, if any
            syncedClientOpspecs = unsyncedClientOpspecQueue;
            unsyncedClientOpspecQueue = [];
            syncRequestCallbacksArray = syncRequestCallbacksQueue;
            syncRequestCallbacksQueue = [];

            server.call({
                command: 'sync_ops',
                args: {
                    es_id: sessionId,
                    member_id: memberId,
                    seq_head: String(lastServerSeq),
                    client_ops: syncedClientOpspecs
                }
            }, function(responseData) {
                var response,
                    /**@type{!boolean}*/
                    hasUnresolvableConflict = false;

                updateHasSessionHostConnectionState(true);

                if (syncingBlocked) {
                    return;
                }

                try {
                    response = /** @type{{result:string, head_seq:string, ops:Array.<!Object>}} */(runtime.fromJson(responseData));
                } catch (e) {
                    hasError = true;
                    runtime.log("Could not parse reply: "+responseData);
                    errorCallback("unknownServerReply");
                    return;
                }
                // TODO: hack, remove
                runtime.log("sync_ops reply: " + responseData);

                // just new ops?
                if (response.result === "new_ops") {
                    if (response.ops.length > 0) {
                        // no new locally in the meantime?
                        if (unsyncedClientOpspecQueue.length === 0) {
                            receiveOpSpecsFromNetwork(response.ops, syncRequestCallbacksArray);
                        } else {
                            // transform server ops against new local ones and apply,
                            // transform and send new local ops to server
                            runtime.log("meh, have new ops locally meanwhile, have to do transformations.");
                            hasUnresolvableConflict = !handleOpsSyncConflict(response.ops);
                            syncRequestCallbacksQueue = syncRequestCallbacksArray.concat(syncRequestCallbacksQueue);
                       }
                        // and note server state
                        lastServerSeq = response.head_seq;
                    } else {
                        receiveOpSpecsFromNetwork([], syncRequestCallbacksArray);
                    }
                } else if (response.result === "added") {
                    runtime.log("All added to server");
                    receiveOpSpecsFromNetwork([], syncRequestCallbacksArray);
                    // note server state
                    lastServerSeq = response.head_seq;
                    updateHasLocalUnsyncedOpsState();
                } else if (response.result === "conflict") {
                    // put the send ops back into the outgoing queue
                    unsyncedClientOpspecQueue = syncedClientOpspecs.concat(unsyncedClientOpspecQueue);
                    syncRequestCallbacksQueue = syncRequestCallbacksArray.concat(syncRequestCallbacksQueue);
                    // transform server ops against new local ones and apply,
                    // transform and request new send new local ops to server
                    runtime.log("meh, server has new ops meanwhile, have to do transformations.");
                    hasUnresolvableConflict = !handleOpsSyncConflict(response.ops);
                    // and note server state
                    lastServerSeq = response.head_seq;
                    // try again instantly
                    if (!hasUnresolvableConflict) {
                        isInstantSyncRequested = true;
                    }
                } else if (response.result === "error") {
                    runtime.log("server reports an error: "+response.error);
                    hasError = true;
                    errorCallback(
                        response.error === "ENOSESSION" ? "sessionDoesNotExist":
                        response.error === "ENOMEMBER" ?  "notMemberOfSession":
                                                          "unknownServerReply"
                    );
                    return;
                } else {
                    hasError = true;
                    runtime.log("Unexpected result on sync-ops call: "+response.result);
                    errorCallback("unknownServerReply");
                    return;
                }

                // unlock
                isSyncCallRunning = false;

                if (hasUnresolvableConflict) {
                    hasError = true;
                    errorCallback("unresolvableConflictingOps");
                } else {
                    // prepare next sync
                    if (isInstantSyncRequested) {
                        syncOps();
                    } else {
                        // nothing on client to sync?
                        if (unsyncedClientOpspecQueue.length === 0) {
                            idleTimeout = runtime.getWindow().setTimeout(startSyncOpsTimeout, idleDelay);
                        } else {
                            startSyncOpsTimeout();
                        }
                    }
                    playUnplayedServerOpSpecs();
                }
            }, function() {
                runtime.log("meh, server cannot be reached ATM.");
                // signal connection problem, but do not give up for now
                updateHasSessionHostConnectionState(false);
                // put the (not) send ops back into the outgoing queue
                unsyncedClientOpspecQueue = syncedClientOpspecs.concat(unsyncedClientOpspecQueue);
                syncRequestCallbacksQueue = syncRequestCallbacksArray.concat(syncRequestCallbacksQueue);
                // unlock
                isSyncCallRunning = false;
                // nothing on client to sync?
                if (unsyncedClientOpspecQueue.length === 0) {
                    idleTimeout = runtime.getWindow().setTimeout(startSyncOpsTimeout, idleDelay);
                } else {
                    startSyncOpsTimeout();
                }
                playUnplayedServerOpSpecs();
            });
        }

        function triggerPushingOps() {
            // disable any idle timeout
            if (idleTimeout) {
                runtime.clearTimeout(idleTimeout);
                idleTimeout = null;
            }

            // enable syncOps timeout, if needed
            if (!syncOpsTimeout && !isSyncCallRunning) {
runtime.log("OperationRouter: opsSync requested for pushing");
                syncOpsTimeout = runtime.getWindow().setTimeout(function() {
                    syncOpsTimeout = null;
                    syncOps();
                }, syncOpsDelay);
            }
        }

        /**
         * @param {!Funtion} cb
         * @return {undefined}
         */
        function requestInstantOpsSync(cb) {
            // register callback
            syncRequestCallbacksQueue.push(cb);

            // disable any idle timeout
            if (idleTimeout) {
                runtime.clearTimeout(idleTimeout);
                idleTimeout = null;
            }

            // disable any syncOps timeout
            if (syncOpsTimeout) {
                runtime.clearTimeout(syncOpsTimeout);
                syncOpsTimeout = null;
            }

runtime.log("OperationRouter: instant opsSync requested");
            isInstantSyncRequested = true;
            syncOps();
        };

        this.requestReplay = function (done_cb) {
            requestInstantOpsSync(done_cb);
        };

        /**
         * Sets the factory to use to create operation instances from operation specs.
         *
         * @param {!ops.OperationFactory} f
         * @return {undefined}
         */
        this.setOperationFactory = function (f) {
            operationFactory = f;
            operationTransformer.setOperationFactory(f);
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
            var i, op, opspec,
                timestamp = (new Date()).getTime();

            if (hasError) {
                return;
            }
            // TODO: should be an assert in the future
            // there needs to be a flag telling that processing is happening,
            // and thus any input should be dropped in the sessioncontroller
            // ideally also have some UI element showing the processing state
            if (unplayedServerOpspecQueue.length > 0) {
                return;
            }

            eventNotifier.emit(ops.OperationRouter.signalProcessingBatchStart, {});

            for (i = 0; i < operations.length; i += 1) {
                op = operations[i];
                opspec = op.spec();

                // note if any local ops modified 
                hasPushedModificationOps = hasPushedModificationOps || op.isEdit;

                // add timestamp TODO: improve the useless recreation of the op
                opspec.timestamp = timestamp;
                op = operationFactory.create(opspec);

                // apply locally
                if (!playbackFunction(op)) {
                    hasError = true;
                    errorCallback("opExecutionFailure");
                    return;
                }

                // send to server
                unsyncedClientOpspecQueue.push(opspec);
            }

            triggerPushingOps();

            updateHasLocalUnsyncedOpsState();

            eventNotifier.emit(ops.OperationRouter.signalProcessingBatchEnd, {});
        };

        /**
         * Requests a gracefull shutdown of the Operation Router.
         * Buffered operations shall be sent to the server.
         * A callback is called on success.
         */
        this.close = function (cb) {
            function cbDoneSaving(err) {
                eventNotifier.emit(EVENT_SAVEDTOFILE, null);
                cb(err);
            }

            function cbSuccess(fileData) {
                server.writeSessionStateToFile(sessionId, memberId, lastServerSeq, fileData, cbDoneSaving);
            }

            function doClose() {
                syncingBlocked = true;
                if (hasPushedModificationOps) {
                    eventNotifier.emit(EVENT_BEFORESAVETOFILE, null);

                    odfContainer.createByteArray(cbSuccess, cbDoneSaving);
                } else {
                    cb();
                }
            }

            if (hasError) {
                cb();
            } else if (hasLocalUnsyncedOps) {
                requestInstantOpsSync(doClose);
            } else {
                doClose();
            }
        };

        /**
         * @param {!string} eventId
         * @param {!Function} cb
         * @return {undefined}
         */
        this.subscribe = function (eventId, cb) {
            eventNotifier.subscribe(eventId, cb);
        };

        /**
         * @param {!string} eventId
         * @param {!Function} cb
         * @return {undefined}
         */
        this.unsubscribe = function (eventId, cb) {
            eventNotifier.unsubscribe(eventId, cb);
        };

        /**
         * @return {!boolean}
         */
        this.hasLocalUnsyncedOps = function () {
            return hasLocalUnsyncedOps;
        };

        /**
         * @return {!boolean}
         */
        this.hasSessionHostConnection = function () {
            return hasSessionHostConnection;
        };
    };
});
