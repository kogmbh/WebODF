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

"use strict";

var rngns = "http://relaxng.org/ns/structure/1.0";

/**
 * Check if a node is an element in the rng namespace and the given localName.
 * @param {!string} localName
 * @param {!Node} node
 * @return {!boolean}
 */
function isRng(localName, node) {
    if (node.nodeType !== 1) {
        return false;
    }
    if (node.namespaceURI !== rngns) {
        return false;
    }
    if (node.localName !== localName) {
        return false;
    }
    return true;
}

/**
 * @param {!Node} node
 * @return {?Element}
 */
function getFirstElementNode(node) {
    node = node.firstChild;
    while (node && node.nodeType !== 1) {
        node = node.nextSibling;
    }
    return node;
}

/**
 * Return all explicit names for an <element/> or <attribute/> element.
 * <anyName/> and <nsName/> return nothing.
 *
 * @param {!Node} node
 * @return {!Array.<!string>}
 */
function getNames(node) {
    var names = [];
    if (node.hasAttribute("name")) {
        names.push(node.getAttribute("name"));
    } else {
        node = getFirstElementNode(node);
        if (isRng("choice", node)) {
            node = getFirstElementNode(node);
        }
        while (node) {
            if (isRng("name", node)) {
                names.push(node.textContent);
            }
            node = node.nextSibling;
        }
    }
    return names;
}

/**
 * Increase length of string by adding spaces.
 * @param {!string} str
 * @param {!number} length
 * @return {!string}
 */
function pad(str, length) {
    while (str.length < length) {
        str += " ";
    }
    return str;
}

/**
 * Get all the <define/> elements from an RNG grammar.
 * @param {!Element} grammar
 * @return {!Object.<!string,!Element>}
 */
function getDefines(grammar) {
    var defines = {},
        c = grammar.firstChild;
    while (c) {
        if (c.nodeType === 1 && isRng("define", c)) {
            defines[c.getAttribute("name")] = c;
        }
        c = c.nextSibling;
    }
    return defines;
}

/**
 * Information about an attribute or element.
 * @constructor
 */
function Info() {
    /**@type {!Object.<!string,!string>}*/
    this.refs = {};
    /**@type {!boolean}*/
    this.text = false;
    /**@type {!boolean}*/
    this.data = false;
    /**@type {!boolean}*/
    this.value = false;
    /**@type {!Array.<!Info}*/
    this.childElements = [];
    /**@type {!Array.<!Info}*/
    this.attributes = [];
}

/**
 * Add information from a <define/> to that of <element/> or <attribute/>.
 * @param {!Info} info
 * @param {!string} ref
 * @param {!Object.<!string,!Info>} defines
 * @return {undefined}
 */
function addDefine(info, ref, defines) {
    var define = defines[ref],
        c;
    if (define) {
        info.text = info.text || define.text;
        info.data = info.data || define.data;
        info.value = info.value || define.value;
        define.childElements.forEach(function (ce) {
            if (info.childElements.indexOf(ce) === -1) {
                info.childElements.push(ce);
            }
        });
        define.attributes.forEach(function (a) {
            if (info.attributes.indexOf(a) === -1) {
                info.attributes.push(a);
            }
        });
    }
}

/**
 * Add information from <define/> elements to the set of <element/> or
 * <attribute/> elements.
 * @param {!Object.<!string,!Info>} infos
 * @param {!Object.<!string,!Info>} defines
 * @return {undefined}
 */
function resolveDefines(infos, defines) {
    Object.keys(infos).forEach(function (name) {
        var info = infos[name];
        Object.keys(info.refs).forEach(function (ref) {
            addDefine(info, ref, defines);
        });
    });
}

/**
 * Recursively collect information from all elements in an RNG grammar.
 * If a <ref/> is encountered, the corresponding <define/> is traversed.
 * This is done only once for each <define/>.
 *
 * @param {!Element} e
 * @param {!Object.<!string,!Element} defs
 * @param {?Info} current
 * @param {!Object.<!string,!Info} elements
 * @param {!Object.<!string,!Info} attributes
 * @param {!Object.<!string,!Info} defines
 * @return {undefined}
 */
function handleChildElements(e, defs, current, elements, attributes, defines) {
    var c = e.firstChild,
        def,
        info,
        name;
    while (c) {
        if (isRng("ref", c)) {
            name = c.getAttribute("name");
            if (current) {
                current.refs[name] = name;
            }
            def = defs[name];
            if (def) {
                delete defs[name];
                info = new Info();
                defines[name] = info;
                handleChildElements(def, defs, info, elements, attributes, defines);
            }
        } else if (isRng("element", c)) {
            info = new Info();
            getNames(c).forEach(function (name) {
                elements[name] = info;
            });
            if (current) {
                current.childElements.push(info);
            }
            handleChildElements(c, defs, info, elements, attributes, defines);
        } else if (isRng("attribute", c)) {
            info = new Info();
            getNames(c).forEach(function (name) {
                attributes[name] = info;
            });
            if (current) {
                current.attributes.push(info);
            }
            handleChildElements(c, defs, info, elements, attributes, defines);
        } else if (isRng("text", c)) {
            current.text = true;
        } else if (isRng("mixed", c)) {
            current.text = true;
            handleChildElements(c, defs, current, elements, attributes, defines);
        } else if (isRng("data", c)) {
            current.data = true;
        } else if (isRng("value", c)) {
            current.value = true;
        } else {
            handleChildElements(c, defs, current, elements, attributes, defines);
        }
        c = c.nextSibling;
    }
}

function onLoadRng(err, document) {
    if (err) {
        console.log("\nError: " + err + "\n");
        return runtime.exit(1);
    }
    var grammar = document.documentElement,
        start = document.getElementsByTagNameNS(rngns, "start").item(0),
        defs = getDefines(grammar),
        elements = {},
        attributes = {},
        defines = {},
        elementNames,
        doc;

    handleChildElements(start, defs, null, elements, attributes, defines);
    resolveDefines(elements, defines);
    resolveDefines(attributes, defines);

    elementNames = Object.keys(elements).sort();
    doc = elementNames.map(function (elementName) {
        return "[" + pad('"' + elementName + '"', 40) + ", TODO]";
    }).join(",\n");

    console.log(doc + "\n");
    runtime.exit(0);
}

function main(args) {
    "use strict";
    var rngPath = args && args.pop();
    if (!/\.rng$/.test(rngPath)) {
        console.log("\nUsage:");
        console.log("   odfRng2Config.js <OpenDocument-vXX-os-schema>.rng\n");
        runtime.exit(1);
    } else {
        runtime.loadXML(rngPath, onLoadRng);
    }
}
main(String(typeof arguments) !== "undefined" && Array.prototype.slice.call(arguments));
