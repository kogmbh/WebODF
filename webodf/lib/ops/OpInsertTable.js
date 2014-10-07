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

/*global ops, odf, runtime*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpInsertTable = function OpInsertTable() {
    "use strict";

    var memberid, timestamp, initialRows, initialColumns, position, tableName, tableStyleName,
        tableColumnStyleName,
        /**@type{!Array.<!Array.<string>>}*/
        tableCellStyleMatrix,
        /**@const*/
        tablens = "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        /**@const*/
        textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
        odfUtils = odf.OdfUtils;

    /**
     * @param {!ops.OpInsertTable.InitSpec} data
     */
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

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            domPosition = odtDocument.getTextNodeAtStep(position),
            rootNode = odtDocument.getRootNode(),
            previousSibling,
            tableNode;

        if (domPosition) {
            tableNode = createTableNode(odtDocument.getDOMDocument());
            // For now assume the table should be inserted after the current paragraph
            // or failing that, as the first element in the root node
            previousSibling = odfUtils.getParagraphElement(domPosition.textNode);
            rootNode.insertBefore(tableNode, previousSibling.nextSibling);
            // The parent table counts for 1 position, and 1 paragraph is added per cell
            odtDocument.handleStepsInserted({position: position});

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

    /**
     * @return {!ops.OpInsertTable.Spec}
     */
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
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    initialRows:number,
    initialColumns:number,
    tableName:string,
    tableStyleName:string,
    tableColumnStyleName:string,
    tableCellStyleMatrix:!Array.<!Array.<string>>
}}*/
ops.OpInsertTable.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    initialRows:number,
    initialColumns:number,
    tableName:string,
    tableStyleName:string,
    tableColumnStyleName:string,
    tableCellStyleMatrix:!Array.<!Array.<string>>
}}*/
ops.OpInsertTable.InitSpec;
