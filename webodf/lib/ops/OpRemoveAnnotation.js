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

/*global ops, runtime, odf, core*/

runtime.loadClass("odf.Namespaces");
runtime.loadClass("core.DomUtils");

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpRemoveAnnotation = function OpRemoveAnnotation() {
    "use strict";
    var memberid, timestamp, position, length, domUtils;

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = parseInt(data.position, 10);
        length = parseInt(data.length, 10);
        domUtils = new core.DomUtils();
    };

    this.isEdit = true;
    this.group = undefined;

    this.execute = function (odtDocument) {
        var iterator = odtDocument.getIteratorAtPosition(position),
            container = iterator.container(),
            annotationName,
            annotationNode,
            annotationEnd;

        while (!(container.namespaceURI === odf.Namespaces.officens
            && container.localName === 'annotation')) {
            container = container.parentNode;
        }
        if (container === null) {
            return false;
        }

        annotationNode = container;
        annotationName = annotationNode.getAttributeNS(odf.Namespaces.officens, 'name');
        if (annotationName) {
            annotationEnd = domUtils.getElementsByTagNameNS(odtDocument.getRootNode(), odf.Namespaces.officens, 'annotation-end').filter(function (element) {
                return annotationName === element.getAttributeNS(odf.Namespaces.officens, 'name');
            })[0] || null;
        }

        // Untrack and unwrap annotation
        odtDocument.getOdfCanvas().forgetAnnotations();

        // Move all cursors - outside and before the annotation node
        domUtils.getElementsByTagNameNS(annotationNode, 'urn:webodf:names:cursor', 'cursor').forEach(function(cursor) {
            annotationNode.parentNode.insertBefore(cursor, annotationNode);
        });
        domUtils.getElementsByTagNameNS(annotationNode, 'urn:webodf:names:cursor', 'anchor').forEach(function(anchor) {
            annotationNode.parentNode.insertBefore(anchor, annotationNode);
        });

        // Delete start and end
        annotationNode.parentNode.removeChild(annotationNode);
        if (annotationEnd) {
            annotationEnd.parentNode.removeChild(annotationEnd);
        }
        // The specified position is the first walkable step in the annotation. The position is always just before the first point of change
        odtDocument.emit(ops.OdtDocument.signalStepsRemoved, {position: position > 0 ? position - 1 : position, length: length});

        odtDocument.fixCursorPositions();
        odtDocument.getOdfCanvas().refreshAnnotations();
        return true;
    };

    this.spec = function () {
        return {
            optype: "RemoveAnnotation",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length
        };
    };
};
