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

/*global Node, NodeFilter, runtime, core, xmldom, odf, DOMParser, document*/

runtime.loadClass("core.Base64");
runtime.loadClass("core.Zip");
runtime.loadClass("xmldom.LSSerializer");
runtime.loadClass("odf.StyleInfo");
runtime.loadClass("odf.Namespaces");
runtime.loadClass("odf.OdfNodeFilter");

/**
 * The OdfContainer class manages the various parts that constitues an ODF
 * document.
 * @constructor
 * @param {!string} url
 * @param {?Function} onstatereadychange
 * @return {?}
 **/
odf.OdfContainer = (function () {
    "use strict";
    var styleInfo = new odf.StyleInfo(),
        /**@const @type{!string}*/ officens = "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
        /**@const @type{!string}*/ manifestns = "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0",
        /**@const @type{!string}*/ webodfns = "urn:webodf:names:scope",
        /**@const @type{!Array.<!string>}*/ nodeorder = ['meta', 'settings', 'scripts', 'font-face-decls', 'styles',
            'automatic-styles', 'master-styles', 'body'],
        /**@const @type{!string}*/ automaticStylePrefix = (new Date()).getTime() + "_webodf_",
        base64 = new core.Base64(),
        /**@const @type{!string}*/ documentStylesScope = "document-styles",
        /**@const @type{!string}*/ documentContentScope = "document-content";

    /**
     * @param {?Node} node
     * @param {!string} ns
     * @param {!string} name
     */
    function getDirectChild(node, ns, name) {
        node = node ? node.firstChild : null;
        while (node) {
            if (node.localName === name && node.namespaceURI === ns) {
                return /**@type{!Element}*/(node);
            }
            node = node.nextSibling;
        }
        return null;
    }
    /**
     * Return the position the node should get according to the ODF flat format.
     * @param {!Node} child
     * @return {!number}
     */
    function getNodePosition(child) {
        var i, l = nodeorder.length;
        for (i = 0; i < l; i += 1) {
            if (child.namespaceURI === officens &&
                    child.localName === nodeorder[i]) {
                return i;
            }
        }
        return -1;
    }
    /**
     * Class that filters runtime specific nodes from the DOM.
     * Additionally all unused automatic styles are skipped, if a tree
     * of elements was passed to check the style usage in it.
     * @constructor
     * @implements {xmldom.LSSerializerFilter}
     * @param {!Element} styleUsingElementsRoot root element of tree of elements using styles
     * @param {?Element=} automaticStyles root element of the automatic style definition tree
     */
    function OdfStylesFilter(styleUsingElementsRoot, automaticStyles) {
        var usedStyleList = new styleInfo.UsedStyleList(styleUsingElementsRoot, automaticStyles),
            odfNodeFilter = new odf.OdfNodeFilter();

        /**
         * @param {!Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            var result = odfNodeFilter.acceptNode(node);
            if (result === NodeFilter.FILTER_ACCEPT &&
                node.parentNode === automaticStyles && node.nodeType === Node.ELEMENT_NODE) {
                // skip all automatic styles which are not used
                if (usedStyleList.uses(/**@type{!Element}*/(node))) {
                    result = NodeFilter.FILTER_ACCEPT;
                } else {
                    result = NodeFilter.FILTER_REJECT;
                }
            }
            return result;
        };
    }
    /**
     * Class that extends OdfStylesFilter
     * Additionally, filter out ' ' within the <text:s> element and '\t' within the <text:tab> element
     * @constructor
     * @implements {xmldom.LSSerializerFilter}
     * @param {!Element} styleUsingElementsRoot root element of tree of elements using styles
     * @param {?Element=} automaticStyles root element of the automatic style definition tree
     */
    function OdfContentFilter(styleUsingElementsRoot, automaticStyles) {
        var odfStylesFilter = new OdfStylesFilter(styleUsingElementsRoot, automaticStyles);

        /**
         * @param {!Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            var result = odfStylesFilter.acceptNode(node);
            if (result === NodeFilter.FILTER_ACCEPT
                && node.parentNode && node.parentNode.namespaceURI === odf.Namespaces.textns
                && (node.parentNode.localName === 's' || node.parentNode.localName === 'tab')) {
                result = NodeFilter.FILTER_REJECT;
            }
            return result;
        };
    }
    /**
     * Put the element at the right position in the parent.
     * The right order is given by the value returned from getNodePosition.
     * @param {!Node} node
     * @param {?Node} child
     * @return {undefined}
     */
    function setChild(node, child) {
        if (!child) {
            return;
        }
        var childpos = getNodePosition(child),
            pos,
            c = node.firstChild;
        if (childpos === -1) {
            return;
        }
        while (c) {
            pos = getNodePosition(c);
            if (pos !== -1 && pos > childpos) {
                break;
            }
            c = c.nextSibling;
        }
        node.insertBefore(child, c);
    }
/*jslint emptyblock: true*/
    /**
     * A DOM element that is part of and ODF part of a DOM.
     * @constructor
     * @extends {Element}
     */
    function ODFElement() {
    }
/*jslint emptyblock: false*/
    /**
     * The root element of an ODF document.
     * @constructor
     * @extends {ODFElement}
     */
    function ODFDocumentElement(odfcontainer) {
        this.OdfContainer = odfcontainer;
    }
    ODFDocumentElement.prototype = new ODFElement();
    ODFDocumentElement.prototype.constructor = ODFDocumentElement;
    ODFDocumentElement.namespaceURI = officens;
    ODFDocumentElement.localName = 'document';
    // private constructor
    /**
     * @constructor
     * @param {!string} name
     * @param {!string} mimetype
     * @param {!odf.OdfContainer} container
     * @param {core.Zip} zip
     */
    function OdfPart(name, mimetype,  container, zip) {
        var self = this;

        // declare public variables
        this.size = 0;
        this.type = null;
        this.name = name;
        this.container = container;
        this.url = null;
        this.mimetype = null;
        this.document = null;
        this.onreadystatechange = null;
        this.onchange = null;
        this.EMPTY = 0;
        this.LOADING = 1;
        this.DONE = 2;
        this.state = this.EMPTY;

        // private functions
        // public functions
        /**
         * @return {undefined}
         */
        this.load = function () {
            if (zip === null) {
                return;
            }
            this.mimetype = mimetype;
            zip.loadAsDataURL(name, mimetype, function (err, url) {
                if (err) {
                    runtime.log(err);
                }
                self.url = url;
                if (self.onchange) {
                    self.onchange(self);
                }
                if (self.onstatereadychange) {
                    self.onstatereadychange(self);
                }
            });
        };
    }
/*jslint emptyblock: true*/
    OdfPart.prototype.load = function () {
    };
/*jslint emptyblock: false*/
    OdfPart.prototype.getUrl = function () {
        if (this.data) {
            return 'data:;base64,' + base64.toBase64(this.data);
        }
        return null;
    };
    /**
     * @constructor
     * @param {!string} url
     * @param {?Function} onstatereadychange
     * @return {?}
     */
    odf.OdfContainer = function OdfContainer(url, onstatereadychange) {
        var self = this,
            /**@type {!core.Zip}*/
            zip,
            partMimetypes = {},
            /**@type {?Element}*/
            contentElement;

        // NOTE each instance of OdfContainer has a copy of the private functions
        // it would be better to have a class OdfContainerPrivate where the
        // private functions can be defined via OdfContainerPrivate.prototype
        // without exposing them

        // declare public variables
        this.onstatereadychange = onstatereadychange;
        this.onchange = null;
        this.state = null;
        this.rootElement = null;

        /**
         * @param {!Element} element
         * @return {undefined}
         */
        function removeProcessingInstructions(element) {
            var n = element.firstChild, next, e;
            while (n) {
                next = n.nextSibling;
                if (n.nodeType === Node.ELEMENT_NODE) {
                    e = /**@type{!Element}*/(n);
                    removeProcessingInstructions(e);
                } else if (n.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
                    element.removeChild(n);
                }
                n = next;
            }
        }

        // private functions
        /**
         * Tags all styles with an attribute noting their scope.
         * Helper function for the primitive complete backwriting of
         * the automatic styles.
         * @param {?Element} stylesRootElement
         * @param {!string} scope
         * @return {undefined}
         */
        function setAutomaticStylesScope(stylesRootElement, scope) {
            var n = stylesRootElement && stylesRootElement.firstChild;
            while (n) {
                if (n.nodeType === Node.ELEMENT_NODE) {
                    n.setAttributeNS(webodfns, "scope", scope);
                }
                n = n.nextSibling;
            }
        }
        /**
         * Creates a clone of the styles tree containing only styles tagged
         * with the given scope, or with no specified scope.
         * Helper function for the primitive complete backwriting of
         * the automatic styles.
         * @param {?Element} stylesRootElement
         * @param {!string} scope
         * @return {?Element}
         */
        function cloneStylesInScope(stylesRootElement, scope) {
            var copy = null, n, s, scopeAttrValue;
            if (stylesRootElement) {
                copy = stylesRootElement.cloneNode(true);
                n = copy.firstChild;
                while (n) {
                    s = n.nextSibling;
                    if (n.nodeType === Node.ELEMENT_NODE) {
                        scopeAttrValue = n.getAttributeNS(webodfns, "scope");
                        if (scopeAttrValue && scopeAttrValue !== scope) {
                            copy.removeChild(n);
                        }
                    }
                    n = s;
                }
            }
            return copy;
        }
        /**
         * Import the document elementnode into the DOM of OdfContainer.
         * Any processing instructions are removed, since importing them
         * gives an exception.
         * @param {Document|undefined} xmldoc
         * @return {Node|undefined}
         */
        function importRootNode(xmldoc) {
            var doc = self.rootElement.ownerDocument,
                node;
            // remove all processing instructions
            // TODO: replace cursor processing instruction with an element
            if (xmldoc) {
                removeProcessingInstructions(xmldoc.documentElement);
                try {
                    node = doc.importNode(xmldoc.documentElement, true);
                } catch (ignore) {
                }
            }
            return node;
        }
        /**
         * @param {!number} state
         * @return {undefined}
         */
        function setState(state) {
            self.state = state;
            if (self.onchange) {
                self.onchange(self);
            }
            if (self.onstatereadychange) {
                self.onstatereadychange(self);
            }
        }
        /**
         * @param {!Element} root
         * @return {undefined}
         */
        function setRootElement(root) {
            contentElement = null;
            self.rootElement = root;
            root.fontFaceDecls = getDirectChild(root, officens, 'font-face-decls');
            root.styles = getDirectChild(root, officens, 'styles');
            root.automaticStyles = getDirectChild(root, officens, 'automatic-styles');
            root.masterStyles = getDirectChild(root, officens, 'master-styles');
            root.body = getDirectChild(root, officens, 'body');
            root.meta = getDirectChild(root, officens, 'meta');
        }
        /**
         * @param {Document|undefined} xmldoc
         * @return {undefined}
         */
        function handleFlatXml(xmldoc) {
            var root = importRootNode(xmldoc);
            if (!root || root.localName !== 'document' ||
                    root.namespaceURI !== officens) {
                setState(OdfContainer.INVALID);
                return;
            }
            setRootElement(/**@type{!Element}*/(root));
            setState(OdfContainer.DONE);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleStylesXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root = self.rootElement;
            if (!node || node.localName !== 'document-styles' ||
                    node.namespaceURI !== officens) {
                setState(OdfContainer.INVALID);
                return;
            }
            root.fontFaceDecls = getDirectChild(node, officens, 'font-face-decls');
            setChild(root, root.fontFaceDecls);
            root.styles = getDirectChild(node, officens, 'styles');
            setChild(root, root.styles);
            root.automaticStyles = getDirectChild(node, officens,
                    'automatic-styles');
            setAutomaticStylesScope(root.automaticStyles, documentStylesScope);
            setChild(root, root.automaticStyles);
            root.masterStyles = getDirectChild(node, officens, 'master-styles');
            setChild(root, root.masterStyles);
            // automatic styles from styles.xml could shadow automatic styles from content.xml,
            // because they could have the same name
            // so prefix them and their uses with some almost unique string
            styleInfo.prefixStyleNames(root.automaticStyles, automaticStylePrefix, root.masterStyles);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleContentXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root,
                automaticStyles,
                fontFaceDecls,
                c;
            if (!node || node.localName !== 'document-content' ||
                    node.namespaceURI !== officens) {
                setState(OdfContainer.INVALID);
                return;
            }
            root = self.rootElement;
            // TODO: check for duplicated font face declarations
            fontFaceDecls = getDirectChild(node, officens, 'font-face-decls');
            if (root.fontFaceDecls && fontFaceDecls) {
                c = fontFaceDecls.firstChild;
                while (c) {
                    root.fontFaceDecls.appendChild(c);
                    c = fontFaceDecls.firstChild;
                }
            } else if (fontFaceDecls) {
                root.fontFaceDecls = fontFaceDecls;
                setChild(root, fontFaceDecls);
            }
            automaticStyles = getDirectChild(node, officens, 'automatic-styles');
            setAutomaticStylesScope(automaticStyles, documentContentScope);
            if (root.automaticStyles && automaticStyles) {
                c = automaticStyles.firstChild;
                while (c) {
                    root.automaticStyles.appendChild(c);
                    c = automaticStyles.firstChild; // works because node c moved
                }
            } else if (automaticStyles) {
                root.automaticStyles = automaticStyles;
                setChild(root, automaticStyles);
            }
            root.body = getDirectChild(node, officens, 'body');
            setChild(root, root.body);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleMetaXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root;
            if (!node || node.localName !== 'document-meta' ||
                    node.namespaceURI !== officens) {
                return;
            }
            root = self.rootElement;
            root.meta = getDirectChild(node, officens, 'meta');
            setChild(root, root.meta);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleSettingsXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root;
            if (!node || node.localName !== 'document-settings' ||
                    node.namespaceURI !== officens) {
                return;
            }
            root = self.rootElement;
            root.settings = getDirectChild(node, officens, 'settings');
            setChild(root, root.settings);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleManifestXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root,
                n;
            if (!node || node.localName !== 'manifest' ||
                    node.namespaceURI !== manifestns) {
                return;
            }
            root = self.rootElement;
            root.manifest = node;
            n = root.manifest.firstChild;
            while (n) {
                if (n.nodeType === Node.ELEMENT_NODE && n.localName === "file-entry" &&
                        n.namespaceURI === manifestns) {
                    partMimetypes[n.getAttributeNS(manifestns, "full-path")] =
                        n.getAttributeNS(manifestns, "media-type");
                }
                n = n.nextSibling;
            }
        }
        /**
         * @param {!Array} remainingComponents
         * @return {undefined}
         */
        function loadNextComponent(remainingComponents) {
            var component = remainingComponents.shift(),
                filepath,
                callback;

            if (component) {
                filepath = /**@type {!string}*/(component[0]);
                callback = /**@type {!function(?Document)}*/(component[1]);
                zip.loadAsDOM(filepath, function(err, xmldoc) {
                    callback(xmldoc);
                    if (err || self.state === OdfContainer.INVALID) {
                        return;
                    }
                    loadNextComponent(remainingComponents);
                });
            } else {
                setState(OdfContainer.DONE);
            }
        }
        /**
         * @return {undefined}
         */
        function loadComponents() {
            var componentOrder = [
                ['styles.xml', handleStylesXml],
                ['content.xml', handleContentXml],
                ['meta.xml', handleMetaXml],
                ['settings.xml', handleSettingsXml],
                ['META-INF/manifest.xml', handleManifestXml]
            ];
            loadNextComponent(componentOrder);
        }
        /**
         * @param {!string} name
         * @return {!string}
         */
        function createDocumentElement(name) {
            var s = "";

            odf.Namespaces.forEachPrefix(function(prefix, ns) {
                s += " xmlns:" + prefix + "=\"" + ns + "\"";
            });
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><office:" + name +
                    " " + s + " office:version=\"1.2\">";
        }
        /**
         * @return {!string}
         */
        function serializeMetaXml() {
            var serializer = new xmldom.LSSerializer(),
                /**@type{!string}*/ s = createDocumentElement("document-meta");
            serializer.filter = new odf.OdfNodeFilter();
            s += serializer.writeToString(self.rootElement.meta, odf.Namespaces.namespaceMap);
            s += "</office:document-meta>";
            return s;
        }
        /**
         * Creates a manifest:file-entry node
         * @param {!string} fullPath Full-path attribute value for the file-entry
         * @param {!string} mediaType Media-type attribute value for the file-entry
         * @return {!Node}
         */
        function createManifestEntry(fullPath, mediaType) {
            var element = document.createElementNS(manifestns, 'manifest:file-entry');
            element.setAttributeNS(manifestns, 'manifest:full-path', fullPath);
            element.setAttributeNS(manifestns, 'manifest:media-type', mediaType);
            return element;
        }
        /**
         * @return {!string}
         */
        function serializeManifestXml() {
            var header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
                xml = '<manifest:manifest xmlns:manifest="' + manifestns + '"></manifest:manifest>',
                manifest = /**@type{!Document}*/(runtime.parseXML(xml)),
                manifestRoot = getDirectChild(manifest, manifestns, 'manifest'),
                serializer = new xmldom.LSSerializer(),
                fullPath;

            for(fullPath in partMimetypes) {
                if (partMimetypes.hasOwnProperty(fullPath)) {
                    manifestRoot.appendChild(createManifestEntry(fullPath, partMimetypes[fullPath]));
                }
            }
            serializer.filter = new odf.OdfNodeFilter();
            return header + serializer.writeToString(manifest, odf.Namespaces.namespaceMap);
        }
        /**
         * @return {!string}
         */
        function serializeSettingsXml() {
            var serializer = new xmldom.LSSerializer(),
                /**@type{!string}*/ s = createDocumentElement("document-settings");
            serializer.filter = new odf.OdfNodeFilter();
            s += serializer.writeToString(self.rootElement.settings, odf.Namespaces.namespaceMap);
            s += "</office:document-settings>";
            return s;
        }
        /**
         * @return {!string}
         */
        function serializeStylesXml() {
            var nsmap = odf.Namespaces.namespaceMap,
                serializer = new xmldom.LSSerializer(),
                automaticStyles = cloneStylesInScope(self.rootElement.automaticStyles, documentStylesScope),
                masterStyles = self.rootElement.masterStyles && self.rootElement.masterStyles.cloneNode(true),
                /**@type{!string}*/ s = createDocumentElement("document-styles");
            // automatic styles from styles.xml could shadow automatic styles from content.xml,
            // because they could have the same name
            // thus they were prefixed on loading with some almost unique string, which cam be removed
            // again before saving
            styleInfo.removePrefixFromStyleNames(automaticStyles, automaticStylePrefix, masterStyles);
            serializer.filter = new OdfStylesFilter(masterStyles, automaticStyles);

            // TODO: only store font-face declarations which are used from styles.xml,
            // and store others with content.xml
            s += serializer.writeToString(self.rootElement.fontFaceDecls, nsmap);
            s += serializer.writeToString(self.rootElement.styles, nsmap);
            s += serializer.writeToString(automaticStyles, nsmap);
            s += serializer.writeToString(masterStyles, nsmap);
            s += "</office:document-styles>";
            return s;
        }
        /**
         * @return {!string}
         */
        function serializeContentXml() {
            var nsmap = odf.Namespaces.namespaceMap,
                serializer = new xmldom.LSSerializer(),
                automaticStyles = cloneStylesInScope(self.rootElement.automaticStyles, documentContentScope),
                /**@type{!string}*/ s = createDocumentElement("document-content");
            serializer.filter = new OdfContentFilter(self.rootElement.body, automaticStyles);
            // Until there is code to  determine if a font is referenced only
            // from all font declaratios will be stored in styles.xml
            s += serializer.writeToString(automaticStyles, nsmap);
            s += serializer.writeToString(self.rootElement.body, nsmap);
            s += "</office:document-content>";
            return s;
        }
        function createElement(Type) {
            var original = document.createElementNS(
                    Type.namespaceURI,
                    Type.localName
                ),
                method,
                iface = new Type();
            for (method in iface) {
                if (iface.hasOwnProperty(method)) {
                    original[method] = iface[method];
                }
            }
            return original;
        }
        /**
         * @param {!string} url
         * @param {!function((string)):undefined} callback
         * @return {undefined}
         */
        function loadFromXML(url, callback) {
            runtime.loadXML(url, function (err, dom) {
                if (err) {
                    callback(err);
                } else {
                    handleFlatXml(dom);
                }
            });
        }
        // public functions
        this.setRootElement = setRootElement;

        /**
         * @return {!Element}
         */
        this.getContentElement = function () {
            var body;
            if (!contentElement) {
                body = self.rootElement.body;
                contentElement = body.getElementsByTagNameNS(officens, 'text')[0] ||
                    body.getElementsByTagNameNS(officens, 'presentation')[0] ||
                    body.getElementsByTagNameNS(officens, 'spreadsheet')[0];
            }
            return contentElement;
        };

        /**
         * Gets the document type as 'text', 'presentation', or 'spreadsheet'.
         * @return {!string}
         */
        this.getDocumentType = function () {
            var content = self.getContentElement();
            return content && content.localName;
        };
        /**
         * Open file and parse it. Return the XML Node. Return the root node of
         * the file or null if this is not possible.
         * For 'content.xml', 'styles.xml', 'meta.xml', and 'settings.xml', the
         * elements 'document-content', 'document-styles', 'document-meta', or
         * 'document-settings' will be returned respectively.
         * @param {!string} partname
         * @return {!OdfPart}
         **/
        this.getPart = function (partname) {
            return new OdfPart(partname, partMimetypes[partname], self, zip);
        };
        /**
         * @param {!string} url
         * @param {!function(?string, ?Runtime.ByteArray)} callback receiving err and data
         * @return {undefined}
         */
        this.getPartData = function (url, callback) {
            zip.load(url, callback);
        };

        /**
         * @return {!core.Zip}
         */
        function createEmptyTextDocument() {
            var emptyzip = new core.Zip("", null),
                data = runtime.byteArrayFromString(
                    "application/vnd.oasis.opendocument.text",
                    "utf8"
                ),
                root = self.rootElement,
                text = document.createElementNS(officens, 'text');
            emptyzip.save("mimetype", data, false, new Date());
            /**
             * @param {!string} memberName  variant of the real local name which allows dot notation
             * @param {!string=} realLocalName
             * @return {undefined}
             */
            function addToplevelElement(memberName, realLocalName) {
                var element;
                if (!realLocalName) {
                    realLocalName = memberName;
                }
                element = document.createElementNS(officens, realLocalName);
                root[memberName] = element;
                root.appendChild(element);
            }
            // add toplevel elements in correct order to the root node
            addToplevelElement("meta");
            addToplevelElement("settings");
            addToplevelElement("scripts");
            addToplevelElement("fontFaceDecls",   "font-face-decls");
            addToplevelElement("styles");
            addToplevelElement("automaticStyles", "automatic-styles");
            addToplevelElement("masterStyles",    "master-styles");
            addToplevelElement("body");
            root.body.appendChild(text);

            setState(OdfContainer.DONE);
            return emptyzip;
        }
        /**
         * Fill the zip with current data.
         * @return {undefined}
         */
        function fillZip() {
            // the assumption so far is that all ODF parts are serialized
            // already, but meta, settings, styles and content should be
            // refreshed
            // update the zip entries with the data from the live ODF DOM
            var data,
                date = new Date();
            data = runtime.byteArrayFromString(serializeSettingsXml(), "utf8");
            zip.save("settings.xml", data, true, date);
            data = runtime.byteArrayFromString(serializeMetaXml(), "utf8");
            zip.save("meta.xml", data, true, date);
            data = runtime.byteArrayFromString(serializeStylesXml(), "utf8");
            zip.save("styles.xml", data, true, date);
            data = runtime.byteArrayFromString(serializeContentXml(), "utf8");
            zip.save("content.xml", data, true, date);
            data = runtime.byteArrayFromString(serializeManifestXml(), "utf8");
            zip.save("META-INF/manifest.xml", data, true, date);
        }
        /**
         * Create a bytearray from the zipfile.
         * @param {!function(!Runtime.ByteArray):undefined} successCallback receiving zip as bytearray
         * @param {!function(?string):undefined} errorCallback receiving possible err
         * @return {undefined}
         */
        function createByteArray(successCallback, errorCallback) {
            fillZip();
            zip.createByteArray(successCallback, errorCallback);
        }
        this.createByteArray = createByteArray;
        /**
         * @param {!string} newurl
         * @param {function(?string):undefined} callback
         * @return {undefined}
         */
        function saveAs(newurl, callback) {
            fillZip();
            zip.writeAs(newurl, function (err) {
                callback(err);
            });
        }
        this.saveAs = saveAs;
        /**
         * @param {function(?string):undefined} callback
         * @return {undefined}
         */
        this.save = function (callback) {
            saveAs(url, callback);
        };

        /**
         * @return {!string}
         */
        this.getUrl = function () {
            // TODO: saveAs seems to not update the url, is that wanted?
            return url;
        };
        /**
         * Add a new blob or overwrite any existing blob which has the same filename.
         * @param {!string} filename
         * @param {!string} mimetype
         * @param {!string} content base64 encoded string
         */
        this.setBlob = function (filename, mimetype, content) {
            var data = base64.convertBase64ToByteArray(content),
                date = new Date();
            zip.save(filename, data, false, date);
            if (partMimetypes.hasOwnProperty(filename)) {
                runtime.log(filename + " has been overwritten.");
            }
            partMimetypes[filename] = mimetype;
        };
        /**
         * @param {!string} filename
         */
        this.removeBlob = function (filename) {
            var foundAndRemoved = zip.remove(filename);
            runtime.assert(foundAndRemoved, "file is not found: " + filename);
            delete partMimetypes[filename];
        };
        // initialize public variables
        this.state = OdfContainer.LOADING;
        this.rootElement = createElement(ODFDocumentElement);

        // initialize private variables
        if (url) {
            zip = new core.Zip(url, function (err, zipobject) {
                zip = zipobject;
                if (err) {
                    loadFromXML(url, function (xmlerr) {
                        if (err) {
                            zip.error = err + "\n" + xmlerr;
                            setState(OdfContainer.INVALID);
                        }
                    });
                } else {
                    loadComponents();
                }
            });
        } else {
            zip = createEmptyTextDocument();
        }
    };
    odf.OdfContainer.EMPTY = 0;
    odf.OdfContainer.LOADING = 1;
    odf.OdfContainer.DONE = 2;
    odf.OdfContainer.INVALID = 3;
    odf.OdfContainer.SAVING = 4;
    odf.OdfContainer.MODIFIED = 5;
    /**
     * @param {!string} url
     * @return {!odf.OdfContainer}
     */
    odf.OdfContainer.getContainer = function (url) {
        return new odf.OdfContainer(url, null);
    };
    return odf.OdfContainer;
}());
