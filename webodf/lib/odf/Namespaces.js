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

/*global odf*/

/**
 * Singleton object which provides namespace ids and
 * some utility methods related to prefixes and namespaces
 * @const
 */
odf.Namespaces = (function () {
    "use strict";

    var /**@const@type {!string}*/ dbns = "urn:oasis:names:tc:opendocument:xmlns:database:1.0",
        /**@const@type {!string}*/ dcns = "http://purl.org/dc/elements/1.1/",
        /**@const@type {!string}*/ dr3dns = "urn:oasis:names:tc:opendocument:xmlns:dr3d:1.0",
        /**@const@type {!string}*/ drawns = "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
        /**@const@type {!string}*/ chartns = "urn:oasis:names:tc:opendocument:xmlns:chart:1.0",
        /**@const@type {!string}*/ fons = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
        /**@const@type {!string}*/ formns = "urn:oasis:names:tc:opendocument:xmlns:form:1.0",
        /**@const@type {!string}*/ numberns = "urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0",
        /**@const@type {!string}*/ officens = "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
        /**@const@type {!string}*/ presentationns = "urn:oasis:names:tc:opendocument:xmlns:presentation:1.0",
        /**@const@type {!string}*/ stylens = "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
        /**@const@type {!string}*/ svgns = "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0",
        /**@const@type {!string}*/ tablens = "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        /**@const@type {!string}*/ textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
        /**@const@type {!string}*/ xlinkns = 'http://www.w3.org/1999/xlink',
        /**@const@type {!string}*/ xmlns = "http://www.w3.org/XML/1998/namespace",

        /** @const@type {!Object.<string,!string>} */
        namespaceMap = {
            "db": dbns,
            "dc": dcns,
            "dr3d": dr3dns,
            "draw": drawns,
            "chart": chartns,
            "fo": fons,
            "form": formns,
            "numberns": numberns,
            "office": officens,
            "presentation": presentationns,
            "style": stylens,
            "svg": svgns,
            "table": tablens,
            "text": textns,
            "xlink": xlinkns,
            "xml": xmlns
        },
        namespaces;

    /**
     * Calls the passed callback for all pairs of prefix and namespace
     * which are in the namespaceMap property
     * @param {function(string,string)} cb
     * @return {undefined}
     */
    function forEachPrefix(cb) {
        var prefix;

        for (prefix in namespaceMap) {
            if (namespaceMap.hasOwnProperty(prefix)) {
                cb(prefix, namespaceMap[prefix]);
            }
        }
    }

    /**
     * Returns the namespace belonging to the prefix or null.
     * @param {!string} prefix
     * @return {?string}
     */
    function resolvePrefix(prefix) {
        return namespaceMap[prefix] || null;
    }

    // TODO: document where and why this is needed
    resolvePrefix.lookupNamespaceURI = resolvePrefix;

/*jslint emptyblock: true*/
    // create the actual odf.Namespaces object as a function, because the
    // class loader of runtime expects a function
    namespaces = function Namespaces() {};
/*jslint emptyblock: false*/

    namespaces.forEachPrefix = forEachPrefix;
    namespaces.resolvePrefix = resolvePrefix;
    namespaces.namespaceMap = namespaceMap;

    // add all namespaces
    /**@const@type {!string}*/ namespaces.dbns = dbns;
    /**@const@type {!string}*/ namespaces.dcns = dcns;
    /**@const@type {!string}*/ namespaces.dr3dns = dr3dns;
    /**@const@type {!string}*/ namespaces.drawns = drawns;
    /**@const@type {!string}*/ namespaces.chartns = chartns;
    /**@const@type {!string}*/ namespaces.fons = fons;
    /**@const@type {!string}*/ namespaces.formns = formns;
    /**@const@type {!string}*/ namespaces.numberns = numberns;
    /**@const@type {!string}*/ namespaces.officens = officens;
    /**@const@type {!string}*/ namespaces.presentationns = presentationns;
    /**@const@type {!string}*/ namespaces.stylens = stylens;
    /**@const@type {!string}*/ namespaces.svgns = svgns;
    /**@const@type {!string}*/ namespaces.tablens = tablens;
    /**@const@type {!string}*/ namespaces.textns = textns;
    /**@const@type {!string}*/ namespaces.xlinkns = xlinkns;
    /**@const@type {!string}*/ namespaces.xmlns = xmlns;

    return namespaces;
}());
