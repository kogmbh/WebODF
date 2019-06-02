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
        setProperties,
        removedProperties;

    /**
     * @param {!ops.OpUpdateMetadata.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = parseInt(data.timestamp, 10);
        setProperties = data.setProperties;
        removedProperties = data.removedProperties;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     * @return {?Array.<!ops.Operation.Event>}
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            odfContainer = odtDocument.getOdfCanvas().odfContainer(),
            removedPropertiesArray = null;

        if (removedProperties) {
            removedPropertiesArray = removedProperties.attributes.split(',');
        }

        odfContainer.setMetadata(setProperties, removedPropertiesArray);

        return [{
            eventid: ops.OdtDocument.signalMetadataUpdated,
            args: {
                setProperties: setProperties !== null ? setProperties : {},
                removedProperties: removedPropertiesArray !== null ? removedPropertiesArray : []
            }
        }];
    };

    /**
     * @return {!ops.OpUpdateMetadata.Spec}
     */
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
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    setProperties:Object,
    removedProperties:?{attributes:string}
 }}*/
ops.OpUpdateMetadata.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    setProperties:Object,
    removedProperties:?{attributes:string}
 }}*/
ops.OpUpdateMetadata.InitSpec;
