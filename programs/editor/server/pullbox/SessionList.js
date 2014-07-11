/**
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

/*global define, ops, runtime */

define("webodf/editor/server/pullbox/SessionList", [], function () {
    "use strict";

    return function PullBoxSessionList(server) {
        var cachedSessionData = {},
            subscribers = [],
            serverPullingTimeoutId = null,
            pullingActive = true;

        function onSessionData(sessionData) {
            var i,
                isNew = !cachedSessionData.hasOwnProperty(sessionData.id);

            // extend data with download url
            sessionData.fileUrl = "/session/" + sessionData.id + "/last/" + sessionData.filename;
            // cache
            cachedSessionData[sessionData.id] = sessionData;
            runtime.log("get session data for:" + sessionData.title + ", is new:" + isNew);

            for (i = 0; i < subscribers.length; i += 1) {
                if (isNew) {
                    subscribers[i].onCreated(sessionData);
                } else {
                    subscribers[i].onUpdated(sessionData);
                }
            }
        }

        function onSessionRemoved(sessionId) {
            var i;

            if (cachedSessionData.hasOwnProperty(sessionId)) {
                delete cachedSessionData[sessionId];

                for (i = 0; i < subscribers.length; i += 1) {
                    subscribers[i].onRemoved(sessionId);
                }
            }
        }

        function pullSessionList() {
            serverPullingTimeoutId = null;

            server.call({
                command: "query_sessiondata_list"
            }, function (responseData) {
                var response = runtime.fromJson(responseData),
                    sessionList, i,
                    unupdatedSessions = {};

                // stopped meanwhile? TODO: support for cancelling calls
                if (!pullingActive) {
                    return;
                }

                runtime.log("query_sessiondata_list reply: " + responseData);

                if (response.hasOwnProperty("sessiondata_list")) {
                    // collect known sessions
                    for (i in cachedSessionData) {
                        if (cachedSessionData.hasOwnProperty(i)) {
                            unupdatedSessions[i] = ""; // some dummy value, unused
                        }
                    }

                    // add/update with all delivered sessions
                    sessionList = response.sessiondata_list;
                    for (i = 0; i < sessionList.length; i += 1) {
                        if (unupdatedSessions.hasOwnProperty(sessionList[i].id)) {
                            delete unupdatedSessions[sessionList[i].id];
                        }
                        onSessionData(sessionList[i]);
                    }

                    // remove unupdated sessions
                    for (i in unupdatedSessions) {
                        if (unupdatedSessions.hasOwnProperty(i)) {
                            onSessionRemoved(i);
                        }
                    }

                    // next update in 5 secs
                    serverPullingTimeoutId = runtime.getWindow().setTimeout(pullSessionList, 5000);
                } else {
                    runtime.log("Meh, sessionlist data broken: " + responseData);
                }
            }, function (e) {
                runtime.log(e);
            });
        }

        this.getSessions = function (subscriber) {
            var i,
                sessionList = [];

            if (subscriber) {
                subscribers.push(subscriber);
            }

            for (i in cachedSessionData) {
                if (cachedSessionData.hasOwnProperty(i)) {
                    sessionList.push(cachedSessionData[i]);
                }
            }

            return sessionList;
        };

        this.unsubscribe = function (subscriber) {
            var i;

            for (i = 0; i < subscribers.length; i += 1) {
                if (subscribers[i] === subscriber) {
                    break;
                }
            }

            runtime.assert((i < subscribers.length),
                            "tried to unsubscribe when not subscribed.");

            subscribers.splice(i, 1);
        };

        this.setUpdatesEnabled = function (enabled) {
            if (pullingActive === enabled) {
                return;
            }

            pullingActive = enabled;
            if (pullingActive) {
                pullSessionList();
            } else {
                // cancel any running pulling timeout
                if (serverPullingTimeoutId !== null) {
                    runtime.clearTimeout(serverPullingTimeoutId);
                    serverPullingTimeoutId = null;
                }
            }
        };

        function init() {
            pullSessionList();
        }

        init();
    };
});
