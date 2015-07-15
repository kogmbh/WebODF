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

/*global Packages, HTMLStyleElement, window, XMLHttpRequest, HTMLStyleElement, Document, HTMLDocument, NodeFilter, Range*/

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
 * @type {!NodeJSConsole}
 */
var console;
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
 * @interface
 */
function TreeWalker() {"use strict"; }
/**
 * @const@type{!Node}
 */
TreeWalker.prototype.root;
/**
 * @const@type{number}
 */
TreeWalker.prototype.whatToShow;
/**
 * @const@type{NodeFilter}
 */
TreeWalker.prototype.filter;
/**
 * @const@type{boolean}
 */
TreeWalker.prototype.expandEntityReferences;
/**
 * @type{!Node}
 */
TreeWalker.prototype.currentNode;
/**
 * @return {Node}
 */
TreeWalker.prototype.parentNode = function () {"use strict"; };
/**
 * @return {Node}
 */
TreeWalker.prototype.firstChild = function () {"use strict"; };
/**
 * @return {Node}
 */
TreeWalker.prototype.lastChild = function () {"use strict"; };
/**
 * @return {Node}
 */
TreeWalker.prototype.previousSibling = function () {"use strict"; };
/**
 * @return {Node}
 */
TreeWalker.prototype.nextSibling = function () {"use strict"; };
/**
 * @return {Node}
 */
TreeWalker.prototype.previousNode = function () {"use strict"; };
/**
 * @return {Node}
 */
TreeWalker.prototype.nextNode = function () {"use strict"; };
/**
 * @interface
 */
function NodeIterator() {"use strict"; }
/**
 * @return {Node}
 */
NodeIterator.prototype.previousNode = function () {"use strict"; };
/**
 * @return {Node}
 */
NodeIterator.prototype.nextNode = function () {"use strict"; };
/**
 * @return {undefined}
 */
NodeIterator.prototype.detach = function () {"use strict"; };
/**
 * @param {!Node} root
 * @param {!number} whatToShow
 * @param {function(!Node):number=} filter
 * @param {boolean=} entityReferenceExpansion
 * @return {!TreeWalker}
 */
Document.prototype.createTreeWalker = function (root, whatToShow, filter, entityReferenceExpansion) {"use strict"; };
/**
 * @param {!Node} root
 * @param {!number} whatToShow
 * @param {?function(!Node):number} filter
 * @param {boolean} entityReferenceExpansion
 * @return {!NodeIterator}
 */
Document.prototype.createNodeIterator = function (root, whatToShow, filter, entityReferenceExpansion) {"use strict"; };
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
 * http://www.w3.org/TR/DOM-Level-2-Traversal-Range/traversal.html#Traversal-NodeFilter
 * @interface
 */
// Already defined as a deprecated class...
//function NodeFilter() {"use strict"; }

// Constants returned by acceptNode
/**
 * @type {!number}
 */
NodeFilter.FILTER_ACCEPT                  = 1;
/**
 * @type {!number}
 */
NodeFilter.FILTER_REJECT                  = 2;
/**
 * @type {!number}
 */
NodeFilter.FILTER_SKIP                    = 3;


// Constants for whatToShow
/**
 * @type {!number}
 */
NodeFilter.SHOW_ALL                       = 0xFFFFFFFF;
/**
 * @type {!number}
 */
NodeFilter.SHOW_ELEMENT                   = 0x00000001;
/**
 * @type {!number}
 */
NodeFilter.SHOW_ATTRIBUTE                 = 0x00000002;
/**
 * @const @type {!number}
 */
NodeFilter.SHOW_TEXT                      = 0x00000004;
/**
 * @type {!number}
 */
NodeFilter.SHOW_CDATA_SECTION             = 0x00000008;
/**
 * @type {!number}
 */
NodeFilter.SHOW_ENTITY_REFERENCE          = 0x00000010;
/**
 * @type {!number}
 */
NodeFilter.SHOW_ENTITY                    = 0x00000020;
/**
 * @type {!number}
 */
NodeFilter.SHOW_PROCESSING_INSTRUCTION    = 0x00000040;
/**
 * @type {!number}
 */
NodeFilter.SHOW_COMMENT                   = 0x00000080;
/**
 * @type {!number}
 */
NodeFilter.SHOW_DOCUMENT                  = 0x00000100;
/**
 * @type {!number}
 */
NodeFilter.SHOW_DOCUMENT_TYPE             = 0x00000200;
/**
 * @type {!number}
 */
NodeFilter.SHOW_DOCUMENT_FRAGMENT         = 0x00000400;
/**
 * @type {!number}
 */
NodeFilter.SHOW_NOTATION                  = 0x00000800;

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
/**
 * @type {?HTMLScriptElement}
 */
HTMLDocument.prototype.currentScript;
/**
 * @type {?Element}
 */
Document.prototype.activeElement;
/**
 * @param {number} x
 * @param {number} y
 * @return {Range}
 */
Document.prototype.caretRangeFromPoint = function (x, y) {"use strict"; };

/**
 * namespace
 * @const
 */
var externs = {};

/**
 * Make externs a globally accessible package in a browser
 * @const
 */
window.externs;

/**
 * NodeJS global object
 * @const
 */
var global = {};

/**
 * Make externs a globally accessible package in NodeJS
 * @const
 */
global.externs;
