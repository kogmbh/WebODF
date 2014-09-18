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

/*global ops, core, odf, runtime*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpAddAnnotation = function OpAddAnnotation() {
    "use strict";

    var memberid, timestamp,
        /**@type{number}*/
        position,
        /**@type{number}*/
        length,
        /**@type{string}*/
        name,
        /**@type{!Document}*/
        doc;

    /**
     * @param {!ops.OpAddAnnotation.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = parseInt(data.timestamp, 10);
        position = parseInt(data.position, 10);
        length = parseInt(data.length, 10) || 0;
        name = data.name;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * Creates an office:annotation node with a dc:creator, dc:date, and a paragraph wrapped within
     * a list, inside it; and with the given annotation name
     * @param {!ops.OdtDocument} odtDocument
     * @param {!Date} date
     * @return {!odf.AnnotationElement}
     */
    function createAnnotationNode(odtDocument, date) {
        var annotationNode, creatorNode, dateNode,
            listNode, listItemNode, paragraphNode;

        // Create an office:annotation node with the calculated name, and an attribute with the memberid
        // for SessionView styling
        annotationNode = /**@type{!odf.AnnotationElement}*/(doc.createElementNS(odf.Namespaces.officens, 'office:annotation'));
        annotationNode.setAttributeNS(odf.Namespaces.officens, 'office:name', name);

        creatorNode = doc.createElementNS(odf.Namespaces.dcns, 'dc:creator');
        creatorNode.setAttributeNS('urn:webodf:names:editinfo', 'editinfo:memberid', memberid);
        creatorNode.textContent = odtDocument.getMember(memberid).getProperties().fullName;

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
     * @return {!Element}
     */
    function createAnnotationEnd() {
        var annotationEnd;

        // Create an office:annotation-end node with the calculated name
        annotationEnd = doc.createElementNS(odf.Namespaces.officens, 'office:annotation-end');
        annotationEnd.setAttributeNS(odf.Namespaces.officens, 'office:name', name);

        return annotationEnd;
    }

    /**
     * Inserts the element at a given position
     * @param {!ops.OdtDocument} odtDocument
     * @param {!Element} node
     * @param {!number} insertPosition
     * @return {undefined}
     */
    function insertNodeAtPosition(odtDocument, node, insertPosition) {
        var previousNode,
            parentNode,
            domPosition = odtDocument.getTextNodeAtStep(insertPosition, memberid);

        if (domPosition) {
            previousNode = domPosition.textNode;
            parentNode = previousNode.parentNode;

            if (domPosition.offset !== previousNode.length) {
                previousNode.splitText(domPosition.offset);
            }

            parentNode.insertBefore(node, previousNode.nextSibling);
            // clean up any empty text node which was created by odtDocument.getTextNodeAtStep or previousNode.splitText
            if (previousNode.length === 0) {
                parentNode.removeChild(previousNode);
            }
        }
    }

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            annotation, annotationEnd,
            cursor = odtDocument.getCursor(memberid),
            selectedRange,
            paragraphElement;

        doc = odtDocument.getDOMDocument();

        annotation = createAnnotationNode(odtDocument, new Date(timestamp));

        if (length) {
            annotationEnd = createAnnotationEnd();
            // link annotation end to start
            annotation.annotationEndElement = annotationEnd;
            // Insert the end node before inserting the annotation node, so we don't
            // affect the addressing, and length is always positive
            insertNodeAtPosition(odtDocument, annotationEnd, position + length);
        }
        insertNodeAtPosition(odtDocument, annotation, position);
        odtDocument.handleStepsInserted({position: position});

        // Move the cursor inside the new annotation,
        // by selecting the paragraph's range.
        if (cursor) {
            selectedRange = doc.createRange();
            paragraphElement = /**@type{!Element}*/(annotation.getElementsByTagNameNS(odf.Namespaces.textns, "p")[0]);
            selectedRange.selectNodeContents(paragraphElement);
            cursor.setSelectedRange(selectedRange, false);
            cursor.setSelectionType(ops.OdtCursor.RangeSelection);
            odtDocument.emit(ops.Document.signalCursorMoved, cursor);
        }
        // Track this annotation
        odtDocument.getOdfCanvas().addAnnotation(annotation);
        odtDocument.fixCursorPositions();
        odtDocument.emit(ops.OdtDocument.signalAnnotationAdded, { memberId: memberid, annotation: annotation });

        return true;
    };

    /**
     * @return {!ops.OpAddAnnotation.Spec}
     */
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
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    length:number,
    name:string
}}*/
ops.OpAddAnnotation.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    length:number,
    name:string
}}*/
ops.OpAddAnnotation.InitSpec;
