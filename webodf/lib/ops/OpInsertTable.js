/**
 * @license
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global ops, runtime*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpInsertTable = function OpInsertTable() {
    "use strict";

    var memberid, timestamp, initialRows, initialColumns, position, tableName, tableStyleName,
        tableColumnStyleName, tableCellStyleMatrix,
        /** @const */ tablens = "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        /** @const */ textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        initialRows = data.initialRows;
        initialColumns = data.initialColumns;
        tableName = data.tableName;
        tableStyleName = data.tableStyleName;
        tableColumnStyleName = data.tableColumnStyleName;
        tableCellStyleMatrix = data.tableCellStyleMatrix;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!number} row
     * @param {!number} column
     * @return {!string|undefined}
     */
    function getCellStyleName(row, column) {
        var rowStyles;
        if (tableCellStyleMatrix.length === 1) {
            rowStyles = tableCellStyleMatrix[0];
        } else if (tableCellStyleMatrix.length === 3) {
            switch (row) {
                case 0:
                    rowStyles = tableCellStyleMatrix[0];
                    break;
                case initialRows - 1:
                    rowStyles = tableCellStyleMatrix[2];
                    break;
                default:
                    rowStyles = tableCellStyleMatrix[1];
                    break;
            }
        } else {
            rowStyles = tableCellStyleMatrix[row];
        }

        if (rowStyles.length === 1) {
            return rowStyles[0];
        }
        if (rowStyles.length === 3) {
            switch (column) {
                case 0:
                    return rowStyles[0];
                case initialColumns - 1:
                    return rowStyles[2];
                default:
                    return rowStyles[1];
            }
        }
        return rowStyles[column];
    }

    /**
     * @param {!Document} document
     * @return {!Element}
     */
    function createTableNode(document) {
        var tableNode = document.createElementNS(tablens, "table:table"),
            columns = document.createElementNS(tablens, "table:table-column"),
            row, cell, paragraph,
            rowCounter, columnCounter, cellStyleName;

        if (tableStyleName) {
            tableNode.setAttributeNS(tablens, "table:style-name", tableStyleName);
        }
        if (tableName) {
            tableNode.setAttributeNS(tablens, "table:name", tableName);
        }

        columns.setAttributeNS(tablens, "table:number-columns-repeated", initialColumns);
        if (tableColumnStyleName) {
            columns.setAttributeNS(tablens, "table:style-name", tableColumnStyleName);
        }

        tableNode.appendChild(columns);
        for (rowCounter = 0; rowCounter < initialRows; rowCounter += 1) {
            row = document.createElementNS(tablens, "table:table-row");
            for (columnCounter = 0; columnCounter < initialColumns; columnCounter += 1) {
                cell = document.createElementNS(tablens, "table:table-cell");
                cellStyleName = getCellStyleName(rowCounter, columnCounter);
                if (cellStyleName) {
                    cell.setAttributeNS(tablens, "table:style-name", cellStyleName);
                }
                paragraph = document.createElementNS(textns, "text:p");
                cell.appendChild(paragraph);
                row.appendChild(cell);
            }
            tableNode.appendChild(row);
        }
        return tableNode;
    }

    this.execute = function (odtDocument) {
        var domPosition = odtDocument.getTextNodeAtStep(position),
            rootNode = odtDocument.getRootNode(),
            previousSibling,
            tableNode;

        if (domPosition) {
            tableNode = createTableNode(odtDocument.getDOMDocument());
            // For now assume the table should be inserted after the current paragraph
            // or failing that, as the first element in the root node
            previousSibling = odtDocument.getParagraphElement(domPosition.textNode);
            rootNode.insertBefore(tableNode, previousSibling.nextSibling);
            // The parent table counts for 1 position, and 1 paragraph is added per cell
            odtDocument.emit(ops.OdtDocument.signalStepsInserted, {position: position, length: (initialColumns * initialRows) + 1});

            odtDocument.getOdfCanvas().refreshSize();
            odtDocument.emit(ops.OdtDocument.signalTableAdded, {
                tableElement: tableNode,
                memberId: memberid,
                timeStamp: timestamp
            });

            odtDocument.getOdfCanvas().rerenderAnnotations();
            return true;
        }
        return false;
    };

    this.spec = function () {
        return {
            optype: "InsertTable",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            initialRows: initialRows,
            initialColumns: initialColumns,
            tableName: tableName,
            tableStyleName: tableStyleName,
            tableColumnStyleName: tableColumnStyleName,
            tableCellStyleMatrix: tableCellStyleMatrix
        };
    };

};
