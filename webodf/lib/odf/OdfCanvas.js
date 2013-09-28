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

/*jslint sub: true*/
/*global runtime, odf, xmldom, webodf_css, core, gui */

runtime.loadClass("core.DomUtils");
runtime.loadClass("odf.OdfContainer");
runtime.loadClass("odf.Formatting");
runtime.loadClass("xmldom.XPath");
runtime.loadClass("odf.FontLoader");
runtime.loadClass("odf.Style2CSS");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("gui.AnnotationViewManager");

/**
 * This class manages a loaded ODF document that is shown in an element.
 * It takes care of giving visual feedback on loading, ensures that the
 * stylesheets are loaded.
 * @constructor
 * @param {!Element} element Put and ODF Canvas inside this element.
 * @return {?}
 **/
odf.OdfCanvas = (function () {
    "use strict";
    /**
     * A loading queue where various tasks related to loading can be placed
     * and will be run with 10 ms between them. This gives the ui a change to
     * to update.
     * @constructor
     */
    function LoadingQueue() {
        var queue = [],
            taskRunning = false;
        /**
         * @param {Function} task
         * @return {undefined}
         */
        function run(task) {
            taskRunning = true;
            runtime.setTimeout(function () {
                try {
                    task();
                } catch (e) {
                    runtime.log(e);
                }
                taskRunning = false;
                if (queue.length > 0) {
                    run(queue.pop());
                }
            }, 10);
        }
        /**
         * @return {undefined}
         */
        this.clearQueue = function () {
            queue.length = 0;
        };
        /**
         * @param {Function} loadingTask
         * @return {undefined}
         */
        this.addToQueue = function (loadingTask) {
            if (queue.length === 0 && !taskRunning) {
                return run(loadingTask);
            }
            queue.push(loadingTask);
        };
    }
    /**
     * @constructor
     * @param {!HTMLStyleElement} css
     */
    function PageSwitcher(css) {
        var sheet = css.sheet,
            position = 1;
        /**
         * @return {undefined}
         */
        function updateCSS() {
            while (sheet.cssRules.length > 0) {
                sheet.deleteRule(0);
            }
            // The #shadowContent contains the master pages, with each page in the slideshow
            // corresponding to a master page in #shadowContent, and in the same order.
            // So, when showing a page, also make it's master page (behind it) visible.
            sheet.insertRule('#shadowContent draw|page {display:none;}', 0);
            sheet.insertRule('office|presentation draw|page {display:none;}', 1);
            sheet.insertRule("#shadowContent draw|page:nth-of-type(" +
                position + ") {display:block;}", 2);
            sheet.insertRule("office|presentation draw|page:nth-of-type(" +
                position + ") {display:block;}", 3);
        }
        /**
         * @return {undefined}
         */
        this.showFirstPage = function () {
            position = 1;
            updateCSS();
        };
        /**
         * @return {undefined}
         */
        this.showNextPage = function () {
            position += 1;
            updateCSS();
        };
        /**
         * @return {undefined}
         */
        this.showPreviousPage = function () {
            if (position > 1) {
                position -= 1;
                updateCSS();
            }
        };

        /**
         * @param {!number} n  number of the page
         * @return {undefined}
         */
        this.showPage = function (n) {
            if (n > 0) {
                position = n;
                updateCSS();
            }
        };

        this.css = css;

        /**
         * @param {!function(!Object=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function(callback) {
            css.parentNode.removeChild(css);
            callback();
        };
    }
    /**
     * Register event listener on DOM element.
     * @param {!Element} eventTarget
     * @param {!string} eventType
     * @param {!Function} eventHandler
     * @return {undefined}
     */
    function listenEvent(eventTarget, eventType, eventHandler) {
        if (eventTarget.addEventListener) {
            eventTarget.addEventListener(eventType, eventHandler, false);
        } else if (eventTarget.attachEvent) {
            eventType = "on" + eventType;
            eventTarget.attachEvent(eventType, eventHandler);
        } else {
            eventTarget["on" + eventType] = eventHandler;
        }
    }
    /**
     * @param {!Element} eventTarget
     * @param {!string} eventType
     * @param {!Function} eventHandler
     * @return {undefined}
     */
    function removeEvent(eventTarget, eventType, eventHandler) {
        var onVariant = "on" + eventType;
        if (eventTarget.removeEventListener) {
            eventTarget.removeEventListener(eventType, eventHandler, false);
        } else if (eventTarget.detachEvent) {
            eventTarget.detachEvent(onVariant, eventHandler);
        } else if (eventTarget[onVariant] === eventHandler) {
            eventTarget[onVariant] = null;
        }
    }

    /**
     * Class that listens to events and sends a signal if the selection changes.
     * @constructor
     * @param {!Element} element
     */
    function SelectionWatcher(element) {
        var selection = [], listeners = [];
        /**
         * @param {!Element} ancestor
         * @param {Node} descendant
         * @return {!boolean}
         */
        function isAncestorOf(ancestor, descendant) {
            while (descendant) {
                if (descendant === ancestor) {
                    return true;
                }
                descendant = descendant.parentNode;
            }
            return false;
        }
        /**
         * @param {!Element} element
         * @param {!Range} range
         * @return {!boolean}
         */
        function fallsWithin(element, range) {
            return isAncestorOf(element, range.startContainer) &&
                isAncestorOf(element, range.endContainer);
        }
        /**
         * @return {!Array.<!Range>}
         */
        function getCurrentSelection() {
            var s = [], current = runtime.getWindow().getSelection(), i, r;
            for (i = 0; i < current.rangeCount; i += 1) {
                r = current.getRangeAt(i);
                // check if the nodes in the range fall completely within the
                // element
                if (r !== null && fallsWithin(element, r)) {
                    s.push(r);
                }
            }
            return s;
        }
        /**
         * @param {Range} rangeA
         * @param {Range} rangeB
         * @return {!boolean}
         */
        function rangesNotEqual(rangeA, rangeB) {
            if (rangeA === rangeB) {
                return false;
            }
            if (rangeA === null || rangeB === null) {
                return true;
            }
            return rangeA.startContainer !== rangeB.startContainer ||
                rangeA.startOffset !== rangeB.startOffset ||
                rangeA.endContainer !== rangeB.endContainer ||
                rangeA.endOffset !== rangeB.endOffset;
        }
        /**
         * @return {undefined}
         */
        function emitNewSelection() {
            var i, l = listeners.length;
            for (i = 0; i < l; i += 1) {
                listeners[i](element, selection);
            }
        }
        /**
         * @param {!Array.<!Range>} selection
         * @return {!Array.<!Range>}
         */
        function copySelection(selection) {
            var s = [selection.length], i, oldr, r,
                doc = element.ownerDocument;
            for (i = 0; i < selection.length; i += 1) {
                oldr = selection[i];
                r = doc.createRange();
                r.setStart(oldr.startContainer, oldr.startOffset);
                r.setEnd(oldr.endContainer, oldr.endOffset);
                s[i] = r;
            }
            return s;
        }
        /**
         * @return {undefined}
         */
        function checkSelection() {
            var s = getCurrentSelection(), i;
            if (s.length === selection.length) {
                for (i = 0; i < s.length; i += 1) {
                    if (rangesNotEqual(s[i], selection[i])) {
                        break;
                    }
                }
                if (i === s.length) {
                    return; // no change
                }
            }
            selection = s;
            selection = copySelection(s);
            emitNewSelection();
        }
/*jslint unparam: true*/
        /**
         * @param {!string} eventName
         * @param {!function(!Element, !Array.<!Range>)} handler
         * @return {undefined}
         */
        this.addListener = function (eventName, handler) {
            var i, l = listeners.length;
            for (i = 0; i < l; i += 1) {
                if (listeners[i] === handler) {
                    return;
                }
            }
            listeners.push(handler);
        };
/*jslint unparam: false*/
        /**
         * @param {!function(!Object=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function(callback) {
            removeEvent(element, "mouseup", checkSelection);
            removeEvent(element, "keyup", checkSelection);
            removeEvent(element, "keydown", checkSelection);
            callback();
        };

        // init
        listenEvent(element, "mouseup", checkSelection);
        listenEvent(element, "keyup", checkSelection);
        listenEvent(element, "keydown", checkSelection);
    }

    // variables per class (so not per instance!)
    var /**@const@type {!string}*/drawns  = odf.Namespaces.drawns,
        /**@const@type {!string}*/fons    = odf.Namespaces.fons,
        /**@const@type {!string}*/officens = odf.Namespaces.officens,
        /**@const@type {!string}*/stylens = odf.Namespaces.stylens,
        /**@const@type {!string}*/svgns   = odf.Namespaces.svgns,
        /**@const@type {!string}*/tablens = odf.Namespaces.tablens,
        /**@const@type {!string}*/textns  = odf.Namespaces.textns,
        /**@const@type {!string}*/xlinkns = odf.Namespaces.xlinkns,
        /**@const@type {!string}*/xmlns = odf.Namespaces.xmlns,
        /**@const@type {!string}*/presentationns = odf.Namespaces.presentationns,
        /**@type{?Window}*/window = runtime.getWindow(),
        xpath = new xmldom.XPath(),
        utils = new odf.OdfUtils(),
        domUtils = new core.DomUtils(),
        /** FIXME: shadowContent needs to be part of OdfCanvas instance, not class */
        shadowContent;
    /**
     * @param {!Element} element
     * @return {undefined}
     */
    function clear(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
    /**
     * A new styles.xml has been loaded. Update the live document with it.
     * @param {!odf.OdfContainer} odfcontainer
     * @param {!odf.Formatting} formatting
     * @param {!HTMLStyleElement} stylesxmlcss
     * @return {undefined}
     **/
    function handleStyles(odfcontainer, formatting, stylesxmlcss) {
        // update the css translation of the styles
        var style2css = new odf.Style2CSS();
        style2css.style2css(
            odfcontainer.getDocumentType(),
            stylesxmlcss.sheet,
            formatting.getFontMap(),
            odfcontainer.rootElement.styles,
            odfcontainer.rootElement.automaticStyles
        );
    }

    /**
     * @param {!odf.OdfContainer} odfContainer
     * @param {!HTMLStyleElement} fontcss
     * @return {undefined}
     **/
    function handleFonts(odfContainer, fontcss) {
        // update the css references to the fonts
        var fontLoader = new odf.FontLoader();
        fontLoader.loadFonts(odfContainer, fontcss.sheet);
    }

    /**
     * @param {!odf.OdfContainer} odfContainer
     * @param {!string} masterPageName
     * @return {Node}
     */
    function getMasterPage(odfContainer, masterPageName) {
        if (!masterPageName) {
            return null;
        }

        var masterStyles = odfContainer.rootElement.masterStyles,
            masterPages = masterStyles.getElementsByTagNameNS(stylens, 'master-page'),
            masterPage = null,
            i;

        for (i = 0; i < masterPages.length; i += 1) {
            if (masterPages[i].getAttributeNS(stylens, 'name') === masterPageName) {
                masterPage = masterPages[i];
                break;
            }
        }
        return masterPage;
    }

    /**
     * @param {!odf.OdfContainer} odfContainer
     * @param {!Element} frame
     * @param {!string} headerFooterId
     * @return {?string}
     */
    function getHeaderFooter(odfContainer, frame, headerFooterId) {
        var headerFooter = null,
            i,
            declElements = odfContainer.rootElement.body.getElementsByTagNameNS(presentationns, headerFooterId+'-decl'),
            headerFooterName = frame.getAttributeNS(presentationns, 'use-'+headerFooterId+'-name');

        if (headerFooterName && declElements.length > 0) {
            for (i = 0; i < declElements.length; i += 1) {
                if (declElements[i].getAttributeNS(presentationns, 'name') === headerFooterName) {
                    headerFooter = declElements[i].textContent;
                    break;
                }
            }
        }
        return headerFooter;
    }

    /**
     * @param {!Node} rootElement
     * @param {!string} ns
     * @param {!string} localName
     * @param {?string} value
     * @return {undefined}
     */
    function setContainerValue(rootElement, ns, localName, value) {
        var i, containerList,
            document = rootElement.ownerDocument;

        containerList = rootElement.getElementsByTagNameNS(ns, localName);
        for (i = 0; i < containerList.length; i += 1) {
            clear(containerList[i]);
            if (value) {
                containerList[i].appendChild(document.createTextNode(value));
            }
        }
    }

    /**
     * @param {!odf.OdfContainer} odfContainer
     * @param {!string} id
     * @param {!Node} frame
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     **/
    function setFramePosition(odfContainer, id, frame, stylesheet) {
        frame.setAttribute('styleid', id);
        var rule,
            anchor = frame.getAttributeNS(textns, 'anchor-type'),
            x = frame.getAttributeNS(svgns, 'x'),
            y = frame.getAttributeNS(svgns, 'y'),
            width = frame.getAttributeNS(svgns, 'width'),
            height = frame.getAttributeNS(svgns, 'height'),
            minheight = frame.getAttributeNS(fons, 'min-height'),
            minwidth = frame.getAttributeNS(fons, 'min-width'),
            masterPageName = frame.getAttributeNS(drawns, 'master-page-name'),
            masterPage = null,
            j,
            clonedPage,
            clonedNode,
            pageNumber = 0,
            node,
            document = odfContainer.rootElement.ownerDocument;

        // If there was a master-page-name attribute, then we are dealing with a page.
        // Get the referenced master page element from the master styles
        masterPage = getMasterPage(odfContainer, masterPageName);

        // If the referenced master page exists, create a new page and copy over it's contents into the new page,
        // except for the ones that are placeholders. Also, call setFramePosition on each of those child frames.
        if (masterPage) {
            clonedPage = document.createElementNS(drawns, 'draw:page');
            node = masterPage.firstElementChild;
            j = 0;
            while (node) {
                if (node.getAttributeNS(presentationns, 'placeholder') !== 'true') {
                    clonedNode = node.cloneNode(true);
                    clonedPage.appendChild(clonedNode);
                    setFramePosition(odfContainer, id + '_' + j, /**@type{!Node}*/(clonedNode), stylesheet);
                }
                node = node.nextElementSibling;
                j += 1;
            }

            // Append the cloned master page to the "Shadow Content" element outside the main ODF dom
            shadowContent.appendChild(clonedPage);

            // Get the page number by counting the number of previous master pages in this shadowContent
            pageNumber = shadowContent.getElementsByTagNameNS(drawns, 'page').length;
            // Get the page-number tag in the cloned master page and set the text content to the calculated number
            setContainerValue(clonedPage, textns, 'page-number', pageNumber);

            // Care for header
            setContainerValue(clonedPage, presentationns, 'header', getHeaderFooter(odfContainer, /**@type{!Element}*/(frame), 'header'));
            // Care for footer
            setContainerValue(clonedPage, presentationns, 'footer', getHeaderFooter(odfContainer, /**@type{!Element}*/(frame), 'footer'));

            // Now call setFramePosition on this new page to set the proper dimensions
            setFramePosition(odfContainer, id, clonedPage, stylesheet);
            // And finally, add an attribute referring to the master page, so the CSS targeted for that master page will style this
            clonedPage.setAttributeNS(drawns, 'draw:master-page-name', masterPage.getAttributeNS(stylens, 'name'));
        }

        if (anchor === "as-char") {
            rule = 'display: inline-block;';
        } else if (anchor || x || y) {
            rule = 'position: absolute;';
        } else if (width || height || minheight || minwidth) {
            rule = 'display: block;';
        }
        if (x) {
            rule += 'left: ' + x + ';';
        }
        if (y) {
            rule += 'top: ' + y + ';';
        }
        if (width) {
            rule += 'width: ' + width + ';';
        }
        if (height) {
            rule += 'height: ' + height + ';';
        }
        if (minheight) {
            rule += 'min-height: ' + minheight + ';';
        }
        if (minwidth) {
            rule += 'min-width: ' + minwidth + ';';
        }
        if (rule) {
            rule = 'draw|' + frame.localName + '[styleid="' + id + '"] {' +
                rule + '}';
            stylesheet.insertRule(rule, stylesheet.cssRules.length);
        }
    }
    /**
     * @param {!Element} image
     * @return {string}
     **/
    function getUrlFromBinaryDataElement(image) {
        var node = image.firstChild;
        while (node) {
            if (node.namespaceURI === officens &&
                    node.localName === "binary-data") {
                // TODO: detect mime-type, assuming png for now
                // the base64 data can be  pretty printed, hence we need remove all the line breaks and whitespaces
                return "data:image/png;base64," + node.textContent.replace(/[\r\n\s]/g, '');
            }
            node = node.nextSibling;
        }
        return "";
    }
    /**
     * @param {!string} id
     * @param {!odf.OdfContainer} container
     * @param {!Element} image
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     **/
    function setImage(id, container, image, stylesheet) {
        image.setAttribute('styleid', id);
        var url = image.getAttributeNS(xlinkns, 'href'),
            part;
        function callback(url) {
            var rule;
            if (url) { // if part cannot be loaded, url is null
                rule = "background-image: url(" + url + ");";
                rule = 'draw|image[styleid="' + id + '"] {' + rule + '}';
                stylesheet.insertRule(rule, stylesheet.cssRules.length);
            }
        }
        // look for a office:binary-data
        if (url) {
            try {
                part = container.getPart(url);
                part.onchange = function (part) {
                    callback(part.url);
                };
                part.load();
            } catch (e) {
                runtime.log('slight problem: ' + e);
            }
        } else {
            url = getUrlFromBinaryDataElement(image);
            callback(url);
        }
    }
    /**
     * @param {!Element} odfbody
     * @return {undefined}
     */
    function formatParagraphAnchors(odfbody) {
        var runtimens = "urn:webodf",
            n,
            i,
            nodes = xpath.getODFElementsWithXPath(odfbody,
                ".//*[*[@text:anchor-type='paragraph']]",
                odf.Namespaces.resolvePrefix);
        for (i = 0; i < nodes.length; i += 1) {
            n = nodes[i];
            if (n.setAttributeNS) {
                n.setAttributeNS(runtimens, "containsparagraphanchor", true);
            }
        }
    }
    /**
     * Modify tables to support merged cells (col/row span)
     * @param {!Element} odffragment
     * @return {undefined}
     */
    function modifyTables(odffragment) {
        var i,
            tableCells,
            node;

        /**
         * @param {!Element} node
         * @return {undefined}
         */
        function modifyTableCell(node) {
            // If we have a cell which spans columns or rows,
            // then add col-span or row-span attributes.
            if (node.hasAttributeNS(tablens, "number-columns-spanned")) {
                node.setAttribute("colspan",
                    node.getAttributeNS(tablens, "number-columns-spanned"));
            }
            if (node.hasAttributeNS(tablens, "number-rows-spanned")) {
                node.setAttribute("rowspan",
                    node.getAttributeNS(tablens, "number-rows-spanned"));
            }
        }
        tableCells = odffragment.getElementsByTagNameNS(tablens, 'table-cell');
        for (i = 0; i < tableCells.length; i += 1) {
            node = /**@type{!Element}*/(tableCells.item(i));
            modifyTableCell(node);
        }
    }

    /**
     * Modify ODF links to work like HTML links.
     * @param {!Element} odffragment
     * @return {undefined}
     */
    function modifyLinks(odffragment) {
        var i,
            links,
            node;

        /**
         * @param {!Element} node
         * @return {undefined}
         */
        function modifyLink(node) {
            var url, clickHandler;
            if (!node.hasAttributeNS(xlinkns, "href")) {
                return;
            }

            url = node.getAttributeNS(xlinkns, "href");
            if (url[0] === '#') { // bookmark
                url = url.substring(1);
                clickHandler = function () {
                    var bookmarks = xpath.getODFElementsWithXPath(
                        odffragment,
                        "//text:bookmark-start[@text:name='" + url + "']",
                        odf.Namespaces.resolvePrefix);

                    if (bookmarks.length === 0) {
                        bookmarks = xpath.getODFElementsWithXPath(
                            odffragment,
                            "//text:bookmark[@text:name='" + url + "']",
                            odf.Namespaces.resolvePrefix);
                    }

                    if (bookmarks.length > 0) {
                        bookmarks[0].scrollIntoView(true);
                    }

                    return false;
                };
            } else {
                // Ask the browser to open the link in a new window.
                clickHandler = function () {
                    window.open(url);
                };
            }

            node.onclick = clickHandler;
        }

        // All links are of name text:a.
        links = odffragment.getElementsByTagNameNS(textns, 'a');
        for (i = 0; i < links.length; i += 1) {
            node = /**@type{!Element}*/(links.item(i));
            modifyLink(node);
        }
    }

    /**
     * Expand ODF spaces of the form <text:s text:c=N/> to N consecutive
     * <text:s/> elements. This makes things simpler for WebODF during
     * handling of spaces, in particular during editing.
     * @param {!Element} odffragment
     * @return {undefined}
     */
    function expandSpaceElements(odffragment) {
        var spaces,
            doc = odffragment.ownerDocument;

        /**
         * @param {!Node} space
         * @return {undefined}
         */
        function expandSpaceElement(space) {
            var j, count;
            // If the space has any children, remove them and put a " " text
            // node in place.
            while (space.firstChild) {
                space.removeChild(space.firstChild);
            }
            space.appendChild(doc.createTextNode(" "));

            count = parseInt(space.getAttributeNS(textns, "c"), 10);
            if (count > 1) {
                // Make it a 'simple' space node
                space.removeAttributeNS(textns, "c");
                // Prepend count-1 clones of this space node to itself
                for (j = 1; j < count; j += 1) {
                    space.parentNode.insertBefore(space.cloneNode(true), space);
                }
            }
        }

        spaces = domUtils.getElementsByTagNameNS(odffragment, textns, "s");
        spaces.forEach(expandSpaceElement);
    }

    /**
     * Expand tabs to contain tab characters. This eases cursor behaviour
     * during editing
     * @param {!Element} odffragment
     */
    function expandTabElements(odffragment) {
        var tabs;

        tabs = domUtils.getElementsByTagNameNS(odffragment, textns, "tab");
        tabs.forEach(function(tab) {
            tab.textContent = "\t";
        });
    }
    /**
     * @param {!odf.OdfContainer} container
     * @param {!Element} odfbody
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     **/
    function modifyImages(container, odfbody, stylesheet) {
        var node,
            frames,
            i;
        // find all the frame elements
        frames = [];
        node = odfbody.firstChild;
        while (node && node !== odfbody) {
            if (node.namespaceURI === drawns) {
                frames[frames.length] = node;
            }
            if (node.firstChild) {
                node = node.firstChild;
            } else {
                while (node && node !== odfbody && !node.nextSibling) {
                    node = node.parentNode;
                }
                if (node && node.nextSibling) {
                    node = node.nextSibling;
                }
            }
        }
        // adjust all the frame positions
        for (i = 0; i < frames.length; i += 1) {
            node = frames[i];
            setFramePosition(container, 'frame' + String(i), node, stylesheet);
        }
        formatParagraphAnchors(odfbody);
    }
    /**
     * @param {!Object} container
     * @param {!Element} plugin
     * @return {undefined}
     **/
    function setVideo(container, plugin) {
        var video, source, url, doc = plugin.ownerDocument, part;

        url = plugin.getAttributeNS(xlinkns, 'href');

        /**
         * @param {!string} url
         * @param {!string} mimetype
         * @return {undefined}
         */
        function callback(url, mimetype) {
            var ns = doc.documentElement.namespaceURI;
            // test for video mimetypes
            if (mimetype.substr(0, 6) === 'video/') {
                video = doc.createElementNS(ns, "video");
                video.setAttribute('controls', 'controls');

                source = doc.createElementNS(ns, 'source');
                source.setAttribute('src', url);
                source.setAttribute('type', mimetype);

                video.appendChild(source);
                plugin.parentNode.appendChild(video);
            } else {
                plugin.innerHtml = 'Unrecognised Plugin';
            }
        }
        // look for a office:binary-data
        if (url) {
            try {
                part = container.getPart(url);
                part.onchange = function (part) {
                    callback(part.url, part.mimetype);
                };
                part.load();
            } catch (e) {
                runtime.log('slight problem: ' + e);
            }
        } else {
        // this will fail  atm - following function assumes PNG data]
            runtime.log('using MP4 data fallback');
            url = getUrlFromBinaryDataElement(plugin);
            callback(url, 'video/mp4');
        }
    }

    /**
     * @param {!Element} node
     * @return {!string}
     */
    function getNumberRule(node) {
        var style = node.getAttributeNS(stylens, "num-format"),
            suffix = node.getAttributeNS(stylens, "num-suffix"),
            prefix = node.getAttributeNS(stylens, "num-prefix"),
            rule = "",
            stylemap = {'1': 'decimal', 'a': 'lower-latin', 'A': 'upper-latin',
                 'i': 'lower-roman', 'I': 'upper-roman'},
            content;

        content = prefix || "";

        if (stylemap.hasOwnProperty(style)) {
            content += " counter(list, " + stylemap[style] + ")";
        } else if (style) {
            content += "'" + style + "';";
        } else {
            content += " ''";
        }
        if (suffix) {
            content += " '" + suffix + "'";
        }
        rule = "content: " + content + ";";
        return rule;
    }
    /**
     * @return {!string}
     */
    function getImageRule() {
        var rule = "content: none;";
        return rule;
    }
    /**
     * @param {!Element} node
     * @return {!string}
     */
    function getBulletRule(node) {
        var bulletChar = node.getAttributeNS(textns, "bullet-char");
        return "content: '" + bulletChar + "';";
    }

    /**
     * @param {Element|undefined} node
     * @return {string|undefined}
     */
    function getBulletsRule(node) {
        var itemrule;

        if (node) {
            if (node.localName === "list-level-style-number") {
                itemrule = getNumberRule(node);
            } else if (node.localName === "list-level-style-image") {
                itemrule = getImageRule();
            } else if (node.localName === "list-level-style-bullet") {
                itemrule = getBulletRule(node);
            }
        }

        return itemrule;
    }
    /**
     * Load all the lists that are inside an odf element, and correct numbering.
     * @param {!Element} odffragment
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     */
    function loadLists(odffragment, stylesheet) {
        var i,
            lists,
            node,
            id,
            continueList,
            styleName,
            rule,
            listMap = {},
            parentList,
            listStyles,
            listStyleMap = {},
            bulletRule;

        listStyles = window.document.getElementsByTagNameNS(textns, "list-style");
        for (i = 0; i < listStyles.length; i += 1) {
            node = /**@type{!Element}*/(listStyles.item(i));
            styleName = node.getAttributeNS(stylens, "name");

            if (styleName) {
                listStyleMap[styleName] = node;
            }
        }

        lists = odffragment.getElementsByTagNameNS(textns, 'list');

        for (i = 0; i < lists.length; i += 1) {
            node = /**@type{!Element}*/(lists.item(i));

            id = node.getAttributeNS(xmlns, "id");

            if (id) {
                continueList = node.getAttributeNS(textns, "continue-list");
                node.setAttribute("id", id);
                rule = 'text|list#' + id + ' > text|list-item > *:first-child:before {';

                styleName = node.getAttributeNS(textns, 'style-name');
                if (styleName) {
                    node = listStyleMap[styleName];
                    // TODO: getFirstNonWhitespaceChild() could also return a comment. Ensure the result is proper!
                    bulletRule = getBulletsRule(/**@type{Element|undefined}*/(utils.getFirstNonWhitespaceChild(node)));
                }

                if (continueList) {
                    parentList = listMap[continueList];
                    while (parentList) {
                        continueList = parentList;
                        parentList = listMap[continueList];
                    }
                    rule += 'counter-increment:' + continueList + ';';

                    if (bulletRule) {
                        bulletRule = bulletRule.replace('list', continueList);
                        rule += bulletRule;
                    } else {
                        rule += 'content:counter(' + continueList + ');';
                    }
                } else {
                    continueList = "";
                    if (bulletRule) {
                        bulletRule = bulletRule.replace('list', id);
                        rule += bulletRule;
                    } else {
                        rule += 'content: counter(' + id + ');';
                    }
                    rule += 'counter-increment:' + id + ';';
                    stylesheet.insertRule('text|list#' + id + ' {counter-reset:' + id + '}', stylesheet.cssRules.length);
                }
                rule += '}';

                listMap[id] = continueList;

                if (rule) {
                    // Add this stylesheet
                    stylesheet.insertRule(rule, stylesheet.cssRules.length);
                }
            }
        }
    }

    /**
     * @param {!Document} document
     * @return {!HTMLStyleElement}
     */
    function addWebODFStyleSheet(document) {
        var head = document.getElementsByTagName('head')[0],
            style,
            href;
        if (String(typeof webodf_css) !== "undefined") {
            style = document.createElementNS(head.namespaceURI, 'style');
            style.setAttribute('media', 'screen, print, handheld, projection');
            style.appendChild(document.createTextNode(webodf_css));
        } else {
            style = document.createElementNS(head.namespaceURI, 'link');
            href = "webodf.css";
            if (runtime.currentDirectory) {
                href = runtime.currentDirectory() + "/../" + href;
            }
            style.setAttribute('href', href);
            style.setAttribute('rel', 'stylesheet');
        }
        style.setAttribute('type', 'text/css');
        // TODO: make sure this is only added once per HTML document, e.g. in case of multiple odfCanvases
        head.appendChild(style);
        return /**@type {!HTMLStyleElement}*/(style);
    }
    /**
     * @param {!Document} document Put and ODF Canvas inside this element.
     * @return {!HTMLStyleElement}
     */
    function addStyleSheet(document) {
        var head = document.getElementsByTagName('head')[0],
            style = document.createElementNS(head.namespaceURI, 'style'),
            text = '';
        style.setAttribute('type', 'text/css');
        style.setAttribute('media', 'screen, print, handheld, projection');
        odf.Namespaces.forEachPrefix(function(prefix, ns) {
            text += "@namespace " + prefix + " url(" + ns + ");\n";
        });
        style.appendChild(document.createTextNode(text));
        head.appendChild(style);
        return /**@type {!HTMLStyleElement}*/(style);
    }
    /**
     * @constructor
     * @param {!Element} element Put and ODF Canvas inside this element.
     * @return {?}
     */
    odf.OdfCanvas = function OdfCanvas(element) {
        runtime.assert((element !== null) && (element !== undefined),
            "odf.OdfCanvas constructor needs DOM element");
        runtime.assert((element.ownerDocument !== null) && (element.ownerDocument !== undefined),
            "odf.OdfCanvas constructor needs DOM");
        var self = this,
            doc = /**@type{!Document}*/(element.ownerDocument),
            /**@type{!odf.OdfContainer}*/
            odfcontainer,
            /**@type{!odf.Formatting}*/
            formatting = new odf.Formatting(),
            selectionWatcher = new SelectionWatcher(element),
            pageSwitcher,
            sizer,
            annotationsPane,
            allowAnnotations = false,
            annotationManager,
            webodfcss,
            fontcss,
            stylesxmlcss,
            positioncss,
            zoomLevel = 1,
            /**@const@type{!Object.<!string,!Array.<!Function>>}*/
            eventHandlers = {},
            loadingQueue = new LoadingQueue();

        /**
         * Load all the images that are inside an odf element.
         * @param {!odf.OdfContainer} container
         * @param {!Element} odffragment
         * @param {!StyleSheet} stylesheet
         * @return {undefined}
         */
        function loadImages(container, odffragment, stylesheet) {
            var i,
                images,
                node;
            /**
             * Do delayed loading for all the images
             * @param {!string} name
             * @param {!odf.OdfContainer} container
             * @param {!Element} node
             * @param {!StyleSheet} stylesheet
             * @return {undefined}
             */
            function loadImage(name, container, node, stylesheet) {
                // load image with a small delay to give the html ui a chance to
                // update
                loadingQueue.addToQueue(function () {
                    setImage(name, container, node, stylesheet);
                });
            }
            images = odffragment.getElementsByTagNameNS(drawns, 'image');
            for (i = 0; i < images.length; i += 1) {
                node = /**@type{!Element}*/(images.item(i));
                loadImage('image' + String(i), container, node, stylesheet);
            }
        }
        /**
         * Load all the video that are inside an odf element.
         * @param {!odf.OdfContainer} container
         * @param {!Element} odffragment
         * @return {undefined}
         */
        function loadVideos(container, odffragment) {
            var i,
                plugins,
                node;
            /**
             * Do delayed loading for all the videos
             * @param {!odf.OdfContainer} container
             * @param {!Element} node
             * @return {undefined}
             */
            function loadVideo(container, node) {
                // load video with a small delay to give the html ui a chance to
                // update
                loadingQueue.addToQueue(function () {
                    setVideo(container, node);
                });
            }
            // embedded video is stored in a draw:plugin element
            plugins = odffragment.getElementsByTagNameNS(drawns, 'plugin');
            for (i = 0; i < plugins.length; i += 1) {
                node = /**@type{!Element}*/(plugins.item(i));
                loadVideo(container, node);
            }
        }

        /**
         * Register an event handler
         * @param {!string} eventType
         * @param {!Function} eventHandler
         * @return {undefined}
         */
        function addEventListener(eventType, eventHandler) {
            var handlers = eventHandlers[eventType];
            if (handlers === undefined) {
                handlers = eventHandlers[eventType] = [];
            }
            if (eventHandler && handlers.indexOf(eventHandler) === -1) {
                handlers.push(eventHandler);
            }
        }
        /**
         * Fire an event
         * @param {!string} eventType
         * @param {Array.<Object>=} args
         * @return {undefined}
         */
        function fireEvent(eventType, args) {
            if (!eventHandlers.hasOwnProperty(eventType)) {
                return;
            }
            var handlers = eventHandlers[eventType], i;
            for (i = 0; i < handlers.length; i += 1) {
                handlers[i].apply(null, args);
            }
        }

        /**
         * @return {undefined}
         */
        function fixContainerSize() {
            var odfdoc = sizer.firstChild;
            if (!odfdoc) {
                return;
            }

            /*
                When zoom > 1,
                - origin needs to be 'center top'
                When zoom < 1
                - origin needs to be 'left top'
            */
            if (zoomLevel > 1) {
                sizer.style.MozTransformOrigin = 'center top';
                sizer.style.WebkitTransformOrigin = 'center top';
                sizer.style.OTransformOrigin = 'center top';
                sizer.style.msTransformOrigin = 'center top';
            } else {
                sizer.style.MozTransformOrigin = 'left top';
                sizer.style.WebkitTransformOrigin = 'left top';
                sizer.style.OTransformOrigin = 'left top';
                sizer.style.msTransformOrigin = 'left top';
            }

            sizer.style.WebkitTransform = 'scale(' + zoomLevel + ')';
            sizer.style.MozTransform = 'scale(' + zoomLevel + ')';
            sizer.style.OTransform = 'scale(' + zoomLevel + ')';
            sizer.style.msTransform = 'scale(' + zoomLevel + ')';

            element.style.width = Math.round(zoomLevel * sizer.offsetWidth) + "px";
            element.style.height = Math.round(zoomLevel * sizer.offsetHeight) + "px";
        }
        /**
         * A new content.xml has been loaded. Update the live document with it.
         * @param {!odf.OdfContainer} container
         * @param {!Element} odfnode
         * @return {undefined}
         **/
        function handleContent(container, odfnode) {
            var css = positioncss.sheet;
            // only append the content at the end
            clear(element);

            sizer = doc.createElementNS(element.namespaceURI, 'div');
            sizer.style.display = "inline-block";
            sizer.style.background = "white";
            sizer.appendChild(odfnode);
            element.appendChild(sizer);

            // An annotations pane div. Will only be shown when annotations are enabled
            annotationsPane = doc.createElementNS(element.namespaceURI, 'div');
            annotationsPane.id = "annotationsPane";
            // A "Shadow Content" div. This will contain stuff like pages
            // extracted from <style:master-page>. These need to be nicely
            // styled, so we will populate this in the ODF body first. Once the
            // styling is handled, it can then be lifted out of the
            // ODF body and placed beside it, to not pollute the ODF dom.
            shadowContent = doc.createElementNS(element.namespaceURI, 'div');
            shadowContent.id = "shadowContent";
            shadowContent.style.position = 'absolute';
            shadowContent.style.top = 0;
            shadowContent.style.left = 0;
            container.getContentElement().appendChild(shadowContent);

            modifyImages(container, odfnode.body, css);
            modifyTables(odfnode.body);
            modifyLinks(odfnode.body);
            expandSpaceElements(odfnode.body);
            expandTabElements(odfnode.body);
            loadImages(container, odfnode.body, css);
            loadVideos(container, odfnode.body);
            loadLists(odfnode.body, css);

            sizer.insertBefore(shadowContent, sizer.firstChild);
            fixContainerSize();
        }

        /**
        * Wraps all annotations and renders them using the Annotation View Manager.
        * @param {!Element} odffragment
        * @return {undefined}
        */
        function modifyAnnotations(odffragment) {
            var annotationNodes = domUtils.getElementsByTagNameNS(odffragment, officens, 'annotation'),
                annotationEnds = domUtils.getElementsByTagNameNS(odffragment, officens, 'annotation-end'),
                currentAnnotationName,
                i;

            /**
            * @param {!Node} element
            * @return {!boolean}
            */
            function matchAnnotationEnd(element) {
                return currentAnnotationName === element.getAttributeNS(officens, 'name');
            }

            for (i = 0; i < annotationNodes.length; i += 1) {
                currentAnnotationName = annotationNodes[i].getAttributeNS(officens, 'name');
                annotationManager.addAnnotation({
                    node: annotationNodes[i],
                    end: annotationEnds.filter(matchAnnotationEnd)[0] || null
                });
            }

            annotationManager.rerenderAnnotations();
        }

        /**
         * This should create an annotations pane if non existent, and then populate it with annotations
         * If annotations are disallowed, it should remove the pane and all annotations
         * @param {!Element} odfnode
         */
        function handleAnnotations(odfnode) {
            if (allowAnnotations) {
                if (!annotationsPane.parentNode) {
                    sizer.appendChild(annotationsPane);
                    fixContainerSize();
                }
                if (annotationManager) {
                    annotationManager.forgetAnnotations();
                }
                annotationManager = new gui.AnnotationViewManager(self, odfnode.body, annotationsPane);
                modifyAnnotations(odfnode.body);
            } else {
                if (annotationsPane.parentNode) {
                    sizer.removeChild(annotationsPane);
                    annotationManager.forgetAnnotations();
                    fixContainerSize();
                }
            }
        }

        /**
         * @param {boolean} suppressEvent Suppress the statereadychange event from firing. Used for refreshing the OdtContainer
         * @return {undefined}
         **/
        function refreshOdf(suppressEvent) {

            // synchronize the object a window.odfcontainer with the view
            function callback() {
                clear(element);
                element.style.display = "inline-block";
                var odfnode = odfcontainer.rootElement;
                element.ownerDocument.importNode(odfnode, true);

                formatting.setOdfContainer(odfcontainer);
                handleFonts(odfcontainer, fontcss);
                handleStyles(odfcontainer, formatting, stylesxmlcss);
                // do content last, because otherwise the document is constantly
                // updated whenever the css changes
                handleContent(odfcontainer, odfnode);
                handleAnnotations(odfnode);

                if (!suppressEvent) {
                    fireEvent("statereadychange", [odfcontainer]);
                }
            }

            if (odfcontainer.state === odf.OdfContainer.DONE) {
                callback();
            } else {
                // so the ODF is not done yet. take care that we'll
                // do the work once it is done:

                // FIXME: use callback registry instead of replacing the onchange
                runtime.log("WARNING: refreshOdf called but ODF was not DONE.");

                runtime.setTimeout(function later_cb() {
                    if (odfcontainer.state === odf.OdfContainer.DONE) {
                        callback();
                    } else {
                        runtime.log("will be back later...");
                        runtime.setTimeout(later_cb, 500);
                    }
                }, 100);
            }
        }

        /**
         * Updates the CSS rules to match the ODF document styles and also
         * updates the size of the canvas to match the new layout.
         * Needs to be called after changes to the styles of the ODF document.
         * @return {undefined}
         */
        this.refreshCSS = function () {
            handleStyles(odfcontainer, formatting, stylesxmlcss);
            // different styles means different layout, thus different sizes:
            fixContainerSize();
        };

        /**
         * Updates the size of the canvas to the size of the content.
         * Needs to be called after changes to the content of the ODF document.
         * @return {undefined}
         */
        this.refreshSize = function () {
            fixContainerSize();
        };
        /**
         * @return {!odf.OdfContainer}
         */
        this.odfContainer = function () {
            return odfcontainer;
        };
        /**
         * @return {!StyleSheet}
         */
        this.slidevisibilitycss = function () {
            return pageSwitcher.css;
        };
        /**
         * Set a odfcontainer manually.
         * @param {!odf.OdfContainer} container
         * @param {boolean=} suppressEvent Default value is false
         * @return {undefined}
         */
        this.setOdfContainer = function (container, suppressEvent) {
            odfcontainer = container;
            refreshOdf(suppressEvent === true);
        };
        /**
         * @param {!string} url
         * @return {undefined}
         */
        function load(url) {
            loadingQueue.clearQueue();
            element.innerHTML = 'loading ' + url;
            element.removeAttribute('style');
            // open the odf container
            odfcontainer = new odf.OdfContainer(url, function (container) {
                // assignment might be necessary if the callback
                // fires before the assignment above happens.
                odfcontainer = container;
                refreshOdf(false);
            });
        }
        this["load"] = load;
        this.load = load;

        /**
         * @param {function(?string):undefined} callback
         * @return {undefined}
         */
        this.save = function (callback) {
            odfcontainer.save(callback);
        };

        /**
         * @param {!string} eventName
         * @param {!function(*)} handler
         * @return {undefined}
         */
        this.addListener = function (eventName, handler) {
            switch (eventName) {
            case "selectionchange":
                selectionWatcher.addListener(eventName, handler); break;
            case "click":
                listenEvent(element, eventName, handler); break;
            default:
                addEventListener(eventName, handler); break;
            }
        };

        /**
         * @return {!odf.Formatting}
         */
        this.getFormatting = function () {
            return formatting;
        };

        /**
         * @return {!gui.AnnotationViewManager}
         */
        this.getAnnotationManager = function () {
            return annotationManager;
        };

        /**
         * Unstyles and untracks all annotations present in the document,
         * and then tracks them again with fresh rendering
         * @return {undefined}
         */
        this.refreshAnnotations = function () {
            handleAnnotations(odfcontainer.rootElement);
        };

        /**
         * Re-renders all annotations if enabled
         * @return {undefined}
         */
        this.rerenderAnnotations = function () {
            if (annotationManager) {
                annotationManager.rerenderAnnotations();
            }
        };

        /**
         * This returns the element inside the canvas which can be zoomed with CSS
         * and which contains the ODF document and the annotation sidebar
         * @return {!Element}
         */
        this.getSizer = function () {
            return sizer;
        };

        /** Allows / disallows annotations
         * @param {!boolean} allow
         * @return {undefined}
         */
        this.enableAnnotations = function (allow) {
            if (allow !== allowAnnotations) {
                allowAnnotations = allow;
                if (odfcontainer) {
                    handleAnnotations(odfcontainer.rootElement);
                }
            }
        };

        /**
         * Adds an annotation for the annotaiton manager to track
         * and wraps and highlights it
         * @param {!{node: !Node, end: ?Node}} annotation
         * @return {undefined}
         */
        this.addAnnotation = function (annotation) {
            if (annotationManager) {
                annotationManager.addAnnotation(annotation);
            }
        };

        /**
         * Stops annotations and unwraps it
         * @return {undefined}
         */
        this.forgetAnnotations = function () {
            if (annotationManager) {
                annotationManager.forgetAnnotations();
            }
        };

        /**
         * @param {!number} zoom
         * @return {undefined}
         */
        this.setZoomLevel = function (zoom) {
            zoomLevel = zoom;
            fixContainerSize();
        };
        /**
         * @return {!number}
         */
        this.getZoomLevel = function () {
            return zoomLevel;
        };
        /**
         * @param {!number} width
         * @param {!number} height
         * @return {undefined}
         */
        this.fitToContainingElement = function (width, height) {
            var realWidth = element.offsetWidth / zoomLevel,
                realHeight = element.offsetHeight / zoomLevel;
            zoomLevel = width / realWidth;
            if (height / realHeight < zoomLevel) {
                zoomLevel = height / realHeight;
            }
            fixContainerSize();
        };
        /**
         * @param {!number} width
         * @return {undefined}
         */
        this.fitToWidth = function (width) {
            var realWidth = element.offsetWidth / zoomLevel;
            zoomLevel = width / realWidth;
            fixContainerSize();
        };
        /**
         * @param {!number} width
         * @param {!number} height
         * @return {undefined}
         */
        this.fitSmart = function (width, height) {
            var realWidth, realHeight, newScale;

            realWidth = element.offsetWidth / zoomLevel;
            realHeight = element.offsetHeight / zoomLevel;

            newScale = width / realWidth;
            if (height !== undefined) {
                if (height / realHeight < newScale) {
                    newScale = height / realHeight;
                }
            }

            zoomLevel = Math.min(1.0, newScale);

            fixContainerSize();
        };
        /**
         * @param {!number} height
         * @return {undefined}
         */
        this.fitToHeight = function (height) {
            var realHeight = element.offsetHeight / zoomLevel;
            zoomLevel = height / realHeight;
            fixContainerSize();
        };
        /**
         * @return {undefined}
         */
        this.showFirstPage = function () {
            pageSwitcher.showFirstPage();
        };
        /**
         * @return {undefined}
         */
        this.showNextPage = function () {
            pageSwitcher.showNextPage();
        };
        /**
         * @return {undefined}
         */
        this.showPreviousPage = function () {
            pageSwitcher.showPreviousPage();
        };
        /**
         * @param {!number} n  number of the page
         * @return {undefined}
         */
        this.showPage = function (n) {
            pageSwitcher.showPage(n);
            fixContainerSize();
        };

        /**
         * @return {!Element}
         */
        this.getElement = function () {
            return element;
        };

        /**
         * @param {!function(!Object=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function(callback) {
            var head = doc.getElementsByTagName('head')[0];
            // TODO: anything to clean with annotationManager?
            if (annotationsPane && annotationsPane.parentNode) {
                annotationsPane.parentNode.removeChild(annotationsPane);
            }
            if (sizer) {
                element.removeChild(sizer);
            }
            // remove all styles
            head.removeChild(webodfcss);
            head.removeChild(fontcss);
            head.removeChild(stylesxmlcss);
            head.removeChild(positioncss);

            // TODO: loadingQueue, make sure it is empty

            selectionWatcher.destroy(function (err) {
                if (err) {
                    callback(err);
                } else {
                    pageSwitcher.destroy(callback);
                }
            });
        };

        function init() {
            webodfcss = addWebODFStyleSheet(doc);
            pageSwitcher = new PageSwitcher(addStyleSheet(doc));
            fontcss = addStyleSheet(doc);
            stylesxmlcss = addStyleSheet(doc);
            positioncss = addStyleSheet(doc);
        }

        init();
    };
    return odf.OdfCanvas;
}());
