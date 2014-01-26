/**
 * Copyright (C) 2012 KO GmbH <jos.van.den.oever@kogmbh.com>
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
/*global Packages, HTMLStyleElement, window, XMLHttpRequest, HTMLStyleElement, Document, Range*/
/*jslint nomen: false, emptyblock: true, unparam: true */
/**
 * @constructor
 */
function NodeStats() {"use strict"; }
/**
 * @return {!boolean}
 */
NodeStats.prototype.isFile = function () {"use strict"; };
/**
 * @type {!number}
 */
NodeStats.prototype.size = 0;
/**
 * @constructor
 */
function NodeStream() {"use strict"; }
/**
 * @param {!string} str
 */
NodeStream.prototype.write = function (str) {"use strict"; };
/**
 * @constructor
 */
function NodeJSObject() {"use strict"; }
/**
 * @param {...} items
 * @return {string}
 */
NodeJSObject.prototype.resolve = function (items) {"use strict"; };
/**
 * @param {!string} path
 * @param {function(?string,?NodeStats)} callback
 * @return {undefined}
 */
NodeJSObject.prototype.stat = function (path, callback) {"use strict"; };
/**
 * @param {!string} path
 * @param {?string} encoding
 * @param {function(?string,(?string|?Buffer))} callback
 * @return {?string}
 */
NodeJSObject.prototype.readFile = function (path, encoding, callback) {"use strict"; };
/**
 * @param {!string} path
 * @param {?string} encoding
 * @return {!string|!Buffer}
 */
NodeJSObject.prototype.readFileSync = function (path, encoding) {"use strict"; };
/**
 * @param {!string} path
 * @param {!string} flags
 * @param {!number} mode
 * @param {!function(string, !number):undefined} callback
 * @return {undefined}
 */
NodeJSObject.prototype.open = function (path, flags, mode, callback) {"use strict"; };
/**
 * @param {!number} fd
 * @param {!Buffer} buffer
 * @param {!number} offset
 * @param {!number} length
 * @param {!number} position
 * @param {function(string, !number)} callback
 * @return {undefined}
 */
NodeJSObject.prototype.read = function (fd, buffer, offset, length, position,
        callback) {"use strict"; };
/**
 * @param {!string} path
 * @param {!string|!Buffer} data
 * @param {!string} encoding
 * @param {!function(?string):undefined} callback
 * @return {undefined}
 */
NodeJSObject.prototype.writeFile = function (path, data, encoding, callback) {"use strict"; };
/**
 * @param {!string} path
 * @param {!function(?string):undefined} callback
 * @return {undefined}
 */
NodeJSObject.prototype.unlink = function (path, callback) {"use strict"; };
/**
 * @param {!number} fd
 * @param {function(!string)=} callback
 * @return {undefined}
 */
NodeJSObject.prototype.close = function (fd, callback) {"use strict"; };
/**
 * @constructor
 */
function XmlDom() {"use strict"; }
/**
 * @constructor
 * @extends DOMParser
 */
XmlDom.prototype.DOMParser = function () {"use strict"; };
/**
 * @constructor
 * @extends DOMImplementation
 */
XmlDom.prototype.DOMImplementation = function () {"use strict"; };
/**
 * @param {!string} className
 * @return {!NodeJSObject|!XmlDom}
 */
function require(className) {"use strict"; }
/**
 * @constructor
 */
function NodeJSConsole() {"use strict"; }
/**
 * @param {*} msg
 * @return {undefined}
 */
NodeJSConsole.prototype.log = function (msg) {"use strict"; };
/**
 * @constructor
 */
function NodeJSProcess() {"use strict"; }
/**
 * @param {!number} exitCode
 * @return {undefined}
 */
NodeJSProcess.prototype.exit = function (exitCode) {"use strict"; };
/**
 * @type {!Array}
 */
NodeJSProcess.prototype.argv = [];
/**
 * @type {!NodeStream}
 */
NodeJSProcess.prototype.stderr;

/**
 * @namespace
 */
var JSON;
/**
 * @namespace
 */
var now;
/**
 * @type {function(!Array):Object}
 */
now.deliverOp = function (spec) { "use strict"; };

/**
 * @type {function(!string):Object}
 */
now.subscribeUserDetailsUpdates = function (memberId) { "use strict"; };
/**
 * @type {function(!string):Object}
 */
now.unsubscribeUserDetailsUpdates = function (memberId) { "use strict"; };
/**
 * @type {function(!string, !function(!boolean)):Object}
 */
now.joinSession = function (sessionId, done_cb) { "use strict"; };


/**
 * @type {!NodeJSProcess}
 */
var process;
/**
 * @type {!string}
 */
var __dirname;
/**
 * @constructor
 * @param {!number|!Array.<!number>|!string|!Uint8Array} arg1
 * @param {!string=} encoding
 */
function Buffer(arg1, encoding) {"use strict"; }
/**
 * @type{!number}
 */
Buffer.prototype.length = 0;
/**
 * @param {!string} msg
 * @return {undefined}
 */
function print(msg) {"use strict"; }
/**
 * @param {!string} path
 * @param {!string=} encoding
 * @return {?string}
 */
function readFile(path, encoding) {"use strict"; }
/**
 * @param {!number} exitCode
 * @return {undefined}
 */
function quit(exitCode) {"use strict"; }
/**
 * @typedef {!Object}
 */
Packages.javax;
/**
 * @namespace
 */
Packages.javax.xml = {};
/**
 * @namespace
 */
Packages.javax.xml.validation = {};
/**
 * @constructor
 */
Packages.javax.xml.validation.Schema = function () {"use strict"; };
/**
 * @namespace
 */
Packages.javax.xml.parsers = {};
/**
 * @constructor
 */
Packages.javax.xml.parsers.DocumentBuilder = function () {"use strict"; };
/**
 * @param {!Object} entityresolver
 * @return {undefined}
 */
Packages.javax.xml.parsers.DocumentBuilder.prototype.setEntityResolver =
    function (entityresolver) {"use strict"; };
/**
 * @param {!Packages.org.xml.sax.InputSource|!Packages.java.io.File} source
 * @return {?Document}
 */
Packages.javax.xml.parsers.DocumentBuilder.prototype.parse =
    function (source) {"use strict"; };
/**
 * @return {DOMImplementation}
 */
Packages.javax.xml.parsers.DocumentBuilder.prototype.getDOMImplementation =
    function () {"use strict"; };
/**
 * @constructor
 */
Packages.javax.xml.parsers.DocumentBuilderFactory = function () {"use strict"; };
/**
 * @constructor
 */
Packages.DocumentBuilderFactory = function () {"use strict"; };
/**
 * @return {!Packages.javax.xml.parsers.DocumentBuilderFactory}
 */
Packages.newInstance = function () {"use strict"; };
/**
 * @return {!Packages.javax.xml.parsers.DocumentBuilderFactory}
 */
Packages.javax.xml.parsers.DocumentBuilderFactory.newInstance = function () {"use strict"; };
/**
 * @param {!boolean} value
 */
Packages.javax.xml.parsers.DocumentBuilderFactory.prototype.setValidating =
    function (value) {"use strict"; };
/**
 * @param {!boolean} value
 */
Packages.javax.xml.parsers.DocumentBuilderFactory.prototype.setNamespaceAware =
    function (value) {"use strict"; };
/**
 * @param {!boolean} value
 */
Packages.javax.xml.parsers.DocumentBuilderFactory.prototype
    .setExpandEntityReferences = function (value) {"use strict"; };
/**
 * @param {?Packages.javax.xml.validation.Schema} schema
 */
Packages.javax.xml.parsers.DocumentBuilderFactory.prototype.setSchema =
    function (schema) {"use strict"; };
/**
 * @return {!Packages.javax.xml.parsers.DocumentBuilder}
 */
Packages.javax.xml.parsers.DocumentBuilderFactory.prototype.newDocumentBuilder =
    function () {"use strict"; };
/**
 * @typedef {!Object}
 */
Packages.org;
/**
 * @namespace
 */
Packages.org.xml.sax = {};
/**
 * @param {!Object} definition
 * @return {!Object}
 */
Packages.org.xml.sax.EntityResolver = function (definition) {"use strict"; };
/**
 * @typedef {!Object}
 */
Packages.java;
/**
 * @namespace
 */
Packages.java.io = {};
/**
 * @constructor
 * @param {!string} path
 */
Packages.java.io.File = function (path) {"use strict"; };
/**
 * @return {!boolean}
 */
Packages.java.io.File.prototype.isFile = function () {"use strict"; };
/**
 * @return {!boolean}
 */
Packages.java.io.File.prototype['delete'] = function () {"use strict"; };
/**
 * @param {!Packages.java.io.File} other
 * @return {!boolean}
 */
Packages.java.io.File.prototype.rename = function (other) {"use strict"; };
/**
 * @return {undefined}
 */
Packages.java.io.File.prototype.deleteOnExit = function () {"use strict"; };
/**
 * @return {!number}
 */
Packages.java.io.File.prototype.length = function () {"use strict"; };
/**
 * @constructor
 */
Packages.java.io.Reader = function () {"use strict"; };
/**
 * @constructor
 * @extends Packages.java.io.Reader
 * @param {!string} string
 */
Packages.java.io.StringReader = function (string) {"use strict"; };
/**
 * @constructor
 * @param {!string} path
 */
Packages.java.io.FileOutputStream = function (path) {"use strict"; };
/**
 * @param {!number} b
 * @return {undefined}
 */
Packages.java.io.FileOutputStream.prototype.write = function (b) {"use strict"; };
/**
 * @return {undefined}
 */
Packages.java.io.FileOutputStream.prototype.close = function () {"use strict"; };
/**
 * @constructor
 * @param {!Packages.java.io.Reader|!string} reader
 */
Packages.org.xml.sax.InputSource = function (reader) {"use strict"; };
/**
 * @type {!StyleSheet}
 */
HTMLStyleElement.prototype.sheet;
XMLHttpRequest.prototype.sendAsBinary = function (data) {"use strict"; };
/**
 * @const
 * @type{!string}
 */
XMLHttpRequest.prototype.responseBody;
/**
 * @constructor
 * @param {!string} s
 */
function VBArray(s) {"use strict"; }
/**
 * @return {!Array.<number>}
 */
VBArray.prototype.toArray = function () {"use strict"; };
/**
 * @constructor
 * @extends HTMLElement
 */
function IEElement() {"use strict"; };
IEElement.prototype.setActive = function () {"use strict"; };
/**
 * @param {string} xpathExpression
 * @param {!Node} contextNode
 * @param {!function(string):?string} namespaceResolver
 * @param {?number=} resultType
 * @param {*=} result
 * @return {XPathResult}
 */
Document.prototype.evaluate = function (xpathExpression, contextNode, namespaceResolver, resultType, result) {"use strict"; };

/**
 * http://dom.spec.whatwg.org/#interface-range
 * @type {!number}
 */
Range.START_TO_START = 0;

/**
 * http://dom.spec.whatwg.org/#interface-range
 * @type {!number}
 */
Range.START_TO_END = 1;

/**
 * http://dom.spec.whatwg.org/#interface-range
 * @type {!number}
 */
Range.END_TO_END = 2;

/**
 * http://dom.spec.whatwg.org/#interface-range
 * @type {!number}
 */
Range.END_TO_START = 3;

/**
 * https://dvcs.w3.org/hg/dom3events/raw-file/tip/html/DOM3-Events.html#interface-CompositionEvent
 * @constructor
 * @extends Event
 */
function CompositionEvent() { "use strict"; }

/**
 * @type {!string}
 */
CompositionEvent.prototype.data;

/**
 * http://www.whatwg.org/specs/web-apps/current-work/multipage/common-input-element-attributes.html#event-input-input
 * @constructor
 * @extends Event
 */
function TextEvent() { "use strict"; }

/**
 * @type {!string}
 */
TextEvent.prototype.data;
