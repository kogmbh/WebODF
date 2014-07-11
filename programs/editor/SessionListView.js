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

/*global Node, define, runtime */

define("webodf/editor/SessionListView", [], function () {
    "use strict";

    return function SessionListView(sessionList, sessionListDiv, cb) {

        function createSessionDescription(sessionDetails) {
            return " (" + sessionDetails.cursors.length + " members) ";
        }

        /**
         */
        function createSessionViewItem(sessionDetails) {
            runtime.assert(sessionListDiv, "sessionListDiv unavailable");
            var doc = sessionListDiv.ownerDocument,
                htmlns = doc.documentElement.namespaceURI,
                sessionDiv = doc.createElementNS(htmlns, "div"),
                sessionDescriptionDiv = doc.createElementNS(htmlns, "span"),
                sessionDownloadDiv;

            sessionDiv.sessionId = sessionDetails.id; // TODO: namespace?
            sessionDiv.appendChild(sessionDescriptionDiv);
            sessionDiv.appendChild(doc.createTextNode(createSessionDescription(sessionDetails)));

            sessionDescriptionDiv.appendChild(doc.createTextNode(sessionDetails.title));
            sessionDescriptionDiv.style.cursor = "pointer"; // TODO: do not set on each element, use CSS
            sessionDescriptionDiv.style.fontWeight = "bold";
            sessionDescriptionDiv.onclick = function () {
                cb(sessionDetails.id);
            };

            if (sessionDetails.fileUrl) {
                sessionDownloadDiv = doc.createElementNS(htmlns, "a");
                sessionDownloadDiv.appendChild(doc.createTextNode("Download"));
                sessionDownloadDiv.setAttribute("href", sessionDetails.fileUrl);
                sessionDiv.appendChild(sessionDownloadDiv);
            }

            sessionListDiv.appendChild(sessionDiv);
        }

        function updateSessionViewItem(sessionDetails) {
            var node = sessionListDiv.firstChild;
            while (node) {
                if (node.sessionId === sessionDetails.id) {
                    node.firstChild.nextSibling.data = createSessionDescription(sessionDetails);
                    return;
                }
                node = node.nextSibling;
            }
        }

        /**
         * @param {!string} sessionId
         */
        function removeSessionViewItem(sessionId) {
            var node = sessionListDiv.firstChild;
            while (node) {
                if (node.sessionId === sessionId) {
                    sessionListDiv.removeChild(node);
                    return;
                }
                node = node.nextSibling;
            }
        }

        function init() {
            var idx,
                subscriber = {onCreated: createSessionViewItem, onUpdated: updateSessionViewItem, onRemoved: removeSessionViewItem},
                sessions = sessionList.getSessions(subscriber);

            // fill session list
            for (idx = 0; idx < sessions.length; idx += 1) {
                createSessionViewItem(sessions[idx]);
            }
        }

        init();
    };
});
