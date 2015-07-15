/**
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, core, DOMParser, externs*/
/*jslint bitwise: true*/

/**
 * @constructor
 * @param {!string} url path to zip file, should be readable by the runtime
 * @param {?function(?string, !core.Zip):undefined} entriesReadCallback callback
 *        indicating the zip
 *        has loaded this list of entries, the arguments are a string that
 *        indicates error if present and the created object
 */
core.Zip = function Zip(url, entriesReadCallback) {
    "use strict";
    var /**@type{!core.Zip}*/
        self = this,
        /**@type{!JSZip}*/
        zip,
        base64 = new core.Base64();

    /**
     * @param {!string} filename
     * @param {!function(?string, ?Uint8Array)} callback receiving err and data
     * @return {undefined}
     */
    function load(filename, callback) {
        var entry = zip.file(filename);
        if (entry) {
            callback(null, entry.asUint8Array());
        } else {
            callback(filename + " not found.", null);
        }
    }
    /**
     * @param {!string} filename
     * @param {!function(?string, ?string):undefined} callback receiving err and data
     * @return {undefined}
     */
    function loadAsString(filename, callback) {
        // the javascript implementation simply reads the file and converts to
        // string
        load(filename, function (err, data) {
            if (err || data === null) {
                return callback(err, null);
            }
            var d = runtime.byteArrayToString(data, "utf8");
            callback(null, d);
        });
    }
    /**
     * @param {!string} filename
     * @param {!{rootElementReady: function(?string, ?string=, boolean=):undefined}} handler
     * @return {undefined}
     */
    function loadContentXmlAsFragments(filename, handler) {
        // the javascript implementation simply reads the file
        loadAsString(filename, function (err, data) {
            if (err) {
                return handler.rootElementReady(err);
            }
            handler.rootElementReady(null, data, true);
        });
    }
    /**
     * @param {!string} filename
     * @param {!string} mimetype
     * @param {!function(?string,?string):undefined} callback
     */
    function loadAsDataURL(filename, mimetype, callback) {
        load(filename, function (err, data) {
            if (err || !data) {
                return callback(err, null);
            }
            var /**@const@type{!Uint8Array}*/p = data,
                chunksize = 45000, // must be multiple of 3 and less than 50000
                i = 0,
                dataurl;
            if (!mimetype) {
                if (p[1] === 0x50 && p[2] === 0x4E && p[3] === 0x47) {
                    mimetype = "image/png";
                } else if (p[0] === 0xFF && p[1] === 0xD8 && p[2] === 0xFF) {
                    mimetype = "image/jpeg";
                } else if (p[0] === 0x47 && p[1] === 0x49 && p[2] === 0x46) {
                    mimetype = "image/gif";
                } else {
                    mimetype = "";
                }
            }
            dataurl = 'data:' + mimetype + ';base64,';
            // to avoid exceptions, base64 encoding is done in chunks
            // it would make sense to move this to base64.toBase64
            while (i < data.length) {
                dataurl += base64.convertUTF8ArrayToBase64(
                    p.subarray(i, Math.min(i + chunksize, p.length))
                );
                i += chunksize;
            }
            callback(null, dataurl);
        });
    }
    /**
     * @param {!string} filename
     * @param {function(?string,?Document):undefined} callback
     * @return {undefined}
     */
    function loadAsDOM(filename, callback) {
        loadAsString(filename, function (err, xmldata) {
            if (err || xmldata === null) {
                callback(err, null);
                return;
            }
            var parser = new DOMParser(),
                dom = parser.parseFromString(xmldata, "text/xml");
            callback(null, dom);
        });
    }
    /**
     * Add or replace an entry to the zip file.
     * This data is not stored to disk yet, and therefore, no callback is
     * necessary.
     * @param {!string} filename
     * @param {!Uint8Array} data
     * @param {!boolean} compressed
     * @param {!Date} date
     * @return {undefined}
     */
    function save(filename, data, compressed, date) {
        zip.file(filename, data, {date: date, compression: compressed ? null : "STORE"});
    }
    /**
     * Removes entry from the zip.
     * @param {!string} filename
     * @return {!boolean} return false if entry is not found; otherwise true.
     */
    function remove(filename) {
        var exists = zip.file(filename) !== null;
        zip.remove(filename);
        return exists;
    }
    /**
     * Create a bytearray from the zipfile.
     * @param {!function(!Uint8Array):undefined} successCallback receiving zip as bytearray
     * @param {!function(?string):undefined} errorCallback receiving possible err
     * @return {undefined}
     */
    function createByteArray(successCallback, errorCallback) {
        try {
            successCallback(/**@type{!Uint8Array}*/(zip.generate({type: "uint8array", compression: "DEFLATE"})));
        } catch(/**@type{!Error}*/e) {
            errorCallback(e.message);
        }
    }
    /**
     * Write the zipfile to the given path.
     * @param {!string} newurl
     * @param {!function(?string):undefined} callback receiving possible err
     * @return {undefined}
     */
    function writeAs(newurl, callback) {
        createByteArray(function (data) {
            runtime.writeFile(newurl, data, callback);
        }, callback);
    }
    /**
     * Write the zipfile to the given path.
     * @param {!function(?string):undefined} callback receiving possible err
     * @return {undefined}
     */
    function write(callback) {
        writeAs(url, callback);
    }
    this.load = load;
    this.save = save;
    this.remove = remove;
    this.write = write;
    this.writeAs = writeAs;
    this.createByteArray = createByteArray;
    // a special function that makes faster odf loading possible
    this.loadContentXmlAsFragments = loadContentXmlAsFragments;
    this.loadAsString = loadAsString;
    this.loadAsDOM = loadAsDOM;
    this.loadAsDataURL = loadAsDataURL;

    /**
     * @return {!Array.<!{filename: !string}>}
     */
    this.getEntries = function () {
        return Object.keys(zip.files).map(function(filename) { return { filename: filename }; });
    };

    zip = new externs.JSZip();
    // if no callback is defined, this is a new file
    if (entriesReadCallback === null) {
        return;
    }
    runtime.readFile(url, "binary", function (err, result) {
        if (typeof result === "string") {
            err = "file was read as a string. Should be Uint8Array.";
        }
        if (err || !result || result.length === 0) {
            entriesReadCallback("File '" + url + "' cannot be read. Err: " + (err || "[none]"), self);
        } else {
            try {
                // CRC32 check disabled to improve performance
                zip.load(/**@type{!Uint8Array}*/(result), { checkCRC32: false });
                entriesReadCallback(null, self);
            } catch (/**@type{!Error}*/e) {
                entriesReadCallback(e.message, self);
            }
        }
    });
};
