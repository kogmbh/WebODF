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

/*global odf, runtime, ops*/

/**
 * This allows you to update metadata.
 * setProperties is a flat string -> string mapping Object
 * that maps a metadata field name (including namespace prefix)
 * to it's value.
 * removedProperties is a comma-separated (no spaces)
 * string of such field names to be removed.
 * @constructor
 * @implements ops.Operation
 */
ops.OpUpdateMetadata = function OpUpdateMetadata() {
    "use strict";

    var memberid, timestamp,
        /**@type{Object}*/setProperties,
        /**@type{Object}*/removedProperties;

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = parseInt(data.timestamp, 10);
        setProperties = data.setProperties;
        removedProperties = data.removedProperties;
    };

    this.isEdit = true;
    this.group = undefined;

    this.execute = function (odtDocument) {
        var odfContainer = odtDocument.getOdfCanvas().odfContainer(),
            removedPropertiesArray = [],
            blockedProperties = ["dc:date", "dc:creator", "meta:editing-cycles"];

        if (setProperties) {
            blockedProperties.forEach(function (el) {
                if (setProperties[el]) {
                    return false;
                }
            });
        }
        if (removedProperties) {
            blockedProperties.forEach(function (el) {
                if (removedPropertiesArray.indexOf(el) !== -1) {
                    return false;
                }
            });
            removedPropertiesArray = removedProperties.attributes.split(',');
        }

        odfContainer.setMetadata(setProperties, removedPropertiesArray);

        return true;
    };

    this.spec = function () {
        return {
            optype: "UpdateMetadata",
            memberid: memberid,
            timestamp: timestamp,
            setProperties: setProperties,
            removedProperties: removedProperties
        };
    };
};
