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

/*global ops, odf, runtime*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpAddAnnotation = function OpAddAnnotation() {
    "use strict";

    var memberid, timestamp, position, length, name;

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = parseInt(data.timestamp, 10);
        position = parseInt(data.position, 10);
        length = parseInt(data.length, 10) || 0;
        name = data.name;
    };

    /**
     * Creates an office:annotation node with a dc:creator, dc:date, and a paragraph wrapped within
     * a list, inside it; and with the given annotation name
     * @param {!ops.OdtDocument} odtDocument
     * @param {!Date} date
     * @return {!Node}
     */
    function createAnnotationNode(odtDocument, date) {
        var annotationNode, creatorNode, dateNode,
            listNode, listItemNode, paragraphNode,
            doc = odtDocument.getDOM();

        // Create an office:annotation node with the calculated name, and an attribute with the memberid
        // for SessionView styling
        annotationNode = doc.createElementNS(odf.Namespaces.officens, 'office:annotation');
        annotationNode.setAttributeNS(odf.Namespaces.officens, 'office:name', name);

        // Only set the memberid attribute on dc:creator. Let the annotation manager actually set the name
        // for now
        creatorNode = doc.createElementNS(odf.Namespaces.dcns, 'dc:creator');
        creatorNode.setAttributeNS('urn:webodf:names:editinfo', 'editinfo:memberid', memberid);

        // Date.toISOString return the current Dublin Core representation
        dateNode = doc.createElementNS(odf.Namespaces.dcns, 'dc:date');
        dateNode.appendChild(doc.createTextNode(date.toISOString()));

        // Add a text:list > text:list-item > text:p hierarchy as a child of the annotation node
        listNode = doc.createElementNS(odf.Namespaces.textns, 'text:list');
        listItemNode = doc.createElementNS(odf.Namespaces.textns, 'text:list-item');
        paragraphNode = doc.createElementNS(odf.Namespaces.textns, 'text:p');
        listItemNode.appendChild(paragraphNode);
        listNode.appendChild(listItemNode);

        annotationNode.appendChild(creatorNode);
        annotationNode.appendChild(dateNode);
        annotationNode.appendChild(listNode);

        return annotationNode;
    }

    /**
     * Creates an office:annotation-end node with the given annotation name
     * @param {!ops.OdtDocument} odtDocument
     * @return {!Node}
     */
    function createAnnotationEnd(odtDocument) {
        var annotationEnd,
            doc = odtDocument.getDOM();

        // Create an office:annotation-end node with the calculated name
        annotationEnd = doc.createElementNS(odf.Namespaces.officens, 'office:annotation-end');
        annotationEnd.setAttributeNS(odf.Namespaces.officens, 'office:name', name);

        return annotationEnd;
    }

    /**
     * Inserts the node at a given position
     * @param {!ops.OdtDocument} odtDocument
     * @param {!Node} node
     * @param {!number} insertPosition
     * @return {undefined}
     */
    function insertNodeAtPosition(odtDocument, node, insertPosition) {
        var previousNode,
            parentNode,
            domPosition = odtDocument.getPositionInTextNode(insertPosition, memberid);

        if (domPosition) {
            previousNode = domPosition.textNode;
            parentNode = previousNode.parentNode;

            if (domPosition.offset !== previousNode.length) {
                previousNode.splitText(domPosition.offset);
            }

            parentNode.insertBefore(node, previousNode.nextSibling);
            // clean up any empty text node which was created by odtDocument.getPositionInTextNode or previousNode.splitText
            if (previousNode.length === 0) {
                parentNode.removeChild(previousNode);
            }
        }
    }

    function countSteps(number, stepCounter, positionFilter) {
        if (number > 0) {
            return stepCounter.countForwardSteps(number, positionFilter);
        }
        if (number < 0) {
            return -stepCounter.countBackwardSteps(-number, positionFilter);
        }
        return 0;
    }

    this.execute = function (odtDocument) {
        var annotation = {},
            positionFilter = odtDocument.getPositionFilter(),
            cursor = odtDocument.getCursor(memberid),
            oldCursorPosition = odtDocument.getCursorPosition(memberid),
            // The -1 is added because the cursor is always to the 'right' of the annotation node,
            // and the target position is 1 step to the right of the annotation node
            lengthToMove = position - oldCursorPosition - 1,
            stepsToParagraph;

        annotation.node = createAnnotationNode(odtDocument, new Date(timestamp));
        if (!annotation.node) {
            return false;
        }
        if (length) {
            annotation.end = createAnnotationEnd(odtDocument);
            if (!annotation.end) {
                return false;
            }
            // Insert the end node before inserting the annotation node, so we don't
            // affect the addressing, and length is always positive
            insertNodeAtPosition(odtDocument, annotation.end, position + length);
        }
        insertNodeAtPosition(odtDocument, annotation.node, position);

        // Move the cursor inside the new annotation
        if (cursor) {
            stepsToParagraph = countSteps(lengthToMove, cursor.getStepCounter(), positionFilter);
            cursor.move(stepsToParagraph);
            odtDocument.emit(ops.OdtDocument.signalCursorMoved, cursor);
        }
        // Track this annotation
        odtDocument.getOdfCanvas().addAnnotation(annotation);
        odtDocument.fixCursorPositions();

        return true;
    };

    this.spec = function () {
        return {
            optype: "AddAnnotation",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            name: name
        };
    };
};
