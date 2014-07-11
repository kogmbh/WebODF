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

/*global define,runtime */

define("webodf/editor/MemberListView",
       ["webodf/editor/EditorSession"],

    function (EditorSession) {
        "use strict";

        /**
         * @param {!Element} memberListDiv
         * @constructor
         */
        return function MemberListView(memberListDiv) {
            var editorSession = null;

            runtime.assert(memberListDiv, "memberListDiv unavailable");

            /**
             * @param {!string} memberId
             * @return {undefined}
             */
            function updateAvatarButton(memberId, memberDetails) {
                var node = memberListDiv.firstChild;

                // this takes care of incorrectly implemented MemberModels,
                // which might end up returning undefined member data
                if (!memberDetails) {
                    runtime.log("MemberModel sent undefined data for member \"" + memberId + "\".");
                    return;
                }

                while (node) {
                    if (node.memberId === memberId) {
                        node = node.firstChild;
                        while (node) {
                            if (node.localName === "img") {
                                // update avatar image
                                node.src = memberDetails.imageUrl;
                                // update border color
                                node.style.borderColor = memberDetails.color;
                            } else if (node.localName === "div") {
                                node.setAttribute('fullname', memberDetails.fullName);
                            }
                            node = node.nextSibling;
                        }
                        return;
                    }
                    node = node.nextSibling;
                }
            }

            /**
             * @param {!string} memberId
             * @return {undefined}
             */
            function createAvatarButton(memberId) {
                var doc = memberListDiv.ownerDocument,
                    htmlns = doc.documentElement.namespaceURI,
                    avatarDiv = doc.createElementNS(htmlns, "div"),
                    imageElement = doc.createElement("img"),
                    fullnameNode = doc.createElement("div");

                avatarDiv.className = "webodfeditor-memberListButton";
                fullnameNode.className = "webodfeditor-memberListLabel";
                avatarDiv.appendChild(imageElement);
                avatarDiv.appendChild(fullnameNode);
                avatarDiv.memberId = memberId; // TODO: namespace?

                avatarDiv.onclick = function () {
                    var caret = editorSession.sessionView.getCaret(memberId);
                    if (caret) {
                        caret.toggleHandleVisibility();
                    }
                };
                memberListDiv.appendChild(avatarDiv);
            }

            /**
             * @param {!string} memberId
             * @return {undefined}
             */
            function removeAvatarButton(memberId) {
                var node = memberListDiv.firstChild;
                while (node) {
                    if (node.memberId === memberId) {
                        memberListDiv.removeChild(node);
                        return;
                    }
                    node = node.nextSibling;
                }
            }

            /**
             * @param {!string} memberId
             * @return {undefined}
             */
            function addMember(memberId) {
                var member = editorSession.getMember(memberId),
                    properties = member.getProperties();
                createAvatarButton(memberId);
                updateAvatarButton(memberId, properties);
            }

            /**
             * @param {!string} memberId
             * @return {undefined}
             */
            function updateMember(memberId) {
                var member = editorSession.getMember(memberId),
                    properties = member.getProperties();

                updateAvatarButton(memberId, properties);
            }

            /**
             * @param {!string} memberId
             * @return {undefined}
             */
            function removeMember(memberId) {
                removeAvatarButton(memberId);
            }

            function disconnectFromEditorSession() {
                var node, nextNode;

                if (editorSession) {
                    // unsubscribe from editorSession
                    editorSession.unsubscribe(EditorSession.signalMemberAdded, addMember);
                    editorSession.unsubscribe(EditorSession.signalMemberUpdated, updateMember);
                    editorSession.unsubscribe(EditorSession.signalMemberRemoved, removeMember);
                    // remove all current avatars
                    node = memberListDiv.firstChild;
                    while (node) {
                        nextNode = node.nextSibling;
                        memberListDiv.removeChild(node);
                        node = nextNode;
                    }
                }
            }

            /**
             * @param {!EditorSession} session
             * @return {undefined}
             */
            this.setEditorSession = function(session) {
                disconnectFromEditorSession();

                editorSession = session;
                if (editorSession) {
                    editorSession.subscribe(EditorSession.signalMemberAdded, addMember);
                    editorSession.subscribe(EditorSession.signalMemberUpdated, updateMember);
                    editorSession.subscribe(EditorSession.signalMemberRemoved, removeMember);
                }
            };

            /**
             * @param {!function(!Error=)} callback, passing an error object in case of error
             * @return {undefined}
             */
            this.destroy = function (callback) {
                disconnectFromEditorSession();
                callback();
            };
        };
});
