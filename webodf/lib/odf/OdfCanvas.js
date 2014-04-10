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

/*jslint sub: true*/
/*global runtime, odf, xmldom, webodf_css, core, gui */


(function () {
    "use strict";
    /**
     * A loading queue where various tasks related to loading can be placed
     * and will be run with 10 ms between them. This gives the ui a change to
     * to update.
     * @constructor
     */
    function LoadingQueue() {
        var /**@type{!Array.<!Function>}*/
            queue = [],
            taskRunning = false;
        /**
         * @param {!Function} task
         * @return {undefined}
         */
        function run(task) {
            taskRunning = true;
            runtime.setTimeout(function () {
                try {
                    task();
                } catch (/**@type{*}*/e) {
                    runtime.log(String(e));
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
         * @param {!Function} loadingTask
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
     * @implements {core.Destroyable}
     * @param {!HTMLStyleElement} css
     */
    function PageSwitcher(css) {
        var sheet = /**@type{!CSSStyleSheet}*/(css.sheet),
            /**@type{number}*/
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
        this.destroy = function (callback) {
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
        /**@const@type {!string}*/webodfhelperns = "urn:webodf:names:helper",
        /**@type{?Window}*/window = runtime.getWindow(),
        xpath = xmldom.XPath,
        odfUtils = new odf.OdfUtils(),
        styleInfo = new odf.StyleInfo(),
        domUtils = new core.DomUtils();

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
     * @param {!HTMLStyleElement} style
     * @return {undefined}
     */
    function clearCSSStyleSheet(style) {
        var stylesheet = /**@type{!CSSStyleSheet}*/(style.sheet),
            cssRules = stylesheet.cssRules;

        while (cssRules.length) {
            stylesheet.deleteRule(cssRules.length - 1);
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
        var style2css = new odf.Style2CSS(),
            list2css = new odf.ListStyleToCss(),
            styleSheet = /**@type{!CSSStyleSheet}*/(stylesxmlcss.sheet),
            styleTree = new odf.StyleTree(
                odfcontainer.rootElement.styles,
                odfcontainer.rootElement.automaticStyles).getStyleTree();

        style2css.style2css(
            odfcontainer.getDocumentType(),
            odfcontainer.rootElement,
            styleSheet,
            formatting.getFontMap(),
            styleTree
        );

        list2css.applyListStyles(styleSheet, styleTree);
    }

    /**
     * @param {!odf.OdfContainer} odfContainer
     * @param {!HTMLStyleElement} fontcss
     * @return {undefined}
     **/
    function handleFonts(odfContainer, fontcss) {
        // update the css references to the fonts
        var fontLoader = new odf.FontLoader();
        fontLoader.loadFonts(odfContainer,
            /**@type{!CSSStyleSheet}*/(fontcss.sheet));
    }

    /**
     * @param {!Element} clonedNode <draw:page/>
     * @return {undefined}
     */
    function dropTemplateDrawFrames(clonedNode) {
        // drop all frames which are just template frames
        var i, element, presentationClass,
            clonedDrawFrameElements = clonedNode.getElementsByTagNameNS(drawns, 'frame');
        for (i = 0; i < clonedDrawFrameElements.length; i += 1) {
            element = /**@type{!Element}*/(clonedDrawFrameElements[i]);
            presentationClass = element.getAttributeNS(presentationns, 'class');
            if (presentationClass && ! /^(date-time|footer|header|page-number)$/.test(presentationClass)) {
                element.parentNode.removeChild(element);
            }
        }
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
            headerFooterName = frame.getAttributeNS(presentationns, 'use-'+headerFooterId+'-name'),
            element;

        if (headerFooterName && declElements.length > 0) {
            for (i = 0; i < declElements.length; i += 1) {
                element = /**@type{!Element}*/(declElements[i]);
                if (element.getAttributeNS(presentationns, 'name') === headerFooterName) {
                    headerFooter = element.textContent;
                    break;
                }
            }
        }
        return headerFooter;
    }

    /**
     * @param {!Element} rootElement
     * @param {string} ns
     * @param {string} localName
     * @param {?string} value
     * @return {undefined}
     */
    function setContainerValue(rootElement, ns, localName, value) {
        var i, containerList,
            document = rootElement.ownerDocument,
            e;

        containerList = rootElement.getElementsByTagNameNS(ns, localName);
        for (i = 0; i < containerList.length; i += 1) {
            clear(containerList[i]);
            if (value) {
                e = /**@type{!Element}*/(containerList[i]);
                e.appendChild(document.createTextNode(value));
            }
        }
    }
    /**
     * Calculate the horizontal position on a page at which a frame should
     * be positioned.
     * @param {!string} x svg:x
     * @param {?string} horizontalPos style:horizontal-pos
     * @param {?string} horizontalRel style:horizontal-rel
     * @param {!Element} frame
     * @return {!number}
     */
    function getHorizontalOffset(x, horizontalPos, horizontalRel, frame) {
        var parentRect = frame.parentElement.getBoundingClientRect(),
            pageRect,
            nx = 0;
        if (horizontalPos === null || horizontalPos === "from-left"
                || horizontalPos === "from-inside") {
            nx = odfUtils.convertToPx(x || 0);
        }
        if (horizontalRel === "page") {
            pageRect = odfUtils.getPageRect(frame);
            if (parentRect) {
                nx -= parentRect.left;
            }
            if (pageRect) {
                nx += pageRect.left;
            }
        }
        return nx;
    }
    /**
     * Calculate the vertical position on a page at which a frame should
     * be positioned.
     * @param {!string} y svg:y
     * @param {?string} verticalPos style:vertical-pos
     * @param {?string} verticalRel style:vertical-rel
     * @param {!Element} frame
     * @return {!number}
     */
    function getVerticalOffset(y, verticalPos, verticalRel, frame) {
        var parentRect = frame.parentElement.getBoundingClientRect(),
            pageRect,
            ny = 0;
        if (verticalPos === null || verticalPos === "from-top") {
            ny = odfUtils.convertToPx(y || 0);
        }
        if (verticalRel === "page") {
            pageRect = odfUtils.getPageRect(frame);
            if (parentRect) {
                ny -= parentRect.top;
            }
            if (pageRect) {
                ny += pageRect.top;
            }
        }
        return ny;
    }

    /**
     * @param {!odf.ODFDocumentElement} odfnode
     * @param {string} styleid
     * @param {!Element} frame
     * @param {!CSSStyleSheet} stylesheet
     * @return {undefined}
     **/
    function setDrawElementPosition(odfnode, styleid, frame, stylesheet) {
        frame.setAttributeNS(webodfhelperns, 'styleid', styleid);
        var rule,
            anchor = frame.getAttributeNS(textns, 'anchor-type') || "paragraph",
            styleName = frame.getAttributeNS(drawns, "style-name"),
            x = frame.getAttributeNS(svgns, 'x'),
            y = frame.getAttributeNS(svgns, 'y'),
            width = frame.getAttributeNS(svgns, 'width'),
            height = frame.getAttributeNS(svgns, 'height'),
            minheight = frame.getAttributeNS(fons, 'min-height'),
            minwidth = frame.getAttributeNS(fons, 'min-width'),
            properties;

        if (anchor === "as-char") {
            rule = 'display: inline-block;';
        } else {
            properties = styleInfo.getStyleProperties(odfnode.styles,
                    odfnode.automaticStyles, styleName, "graphic",
                    {
                style: {
                    "vertical-pos": null,
                    "vertical-rel": null,
                    "horizontal-pos": null,
                    "horizontal-rel": null
                }
            })["style"];
            x = getHorizontalOffset(x, properties["horizontal-pos"],
                     properties["horizontal-rel"], frame);
            y = getVerticalOffset(y, properties["vertical-pos"],
                     properties["vertical-rel"], frame);
            rule = 'position: absolute;';
            rule += 'left: ' + x + 'px;';
            rule += 'top: ' + y + 'px;';
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
            rule = 'draw|' + frame.localName + '[webodfhelper|styleid="' + styleid + '"] {' +
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
     * @param {string} id
     * @param {!odf.OdfContainer} container
     * @param {!Element} image
     * @param {!CSSStyleSheet} stylesheet
     * @return {undefined}
     **/
    function setImage(id, container, image, stylesheet) {
        image.setAttributeNS(webodfhelperns, 'styleid', id);
        var url = image.getAttributeNS(xlinkns, 'href'),
            /**@type{!odf.OdfPart}*/
            part;
        /**
         * @param {?string} url
         */
        function callback(url) {
            var rule;
            if (url) { // if part cannot be loaded, url is null
                rule = "background-image: url(" + url + ");";
                rule = 'draw|image[webodfhelper|styleid="' + id + '"] {' + rule + '}';
                stylesheet.insertRule(rule, stylesheet.cssRules.length);
            }
        }
        /**
         * @param {!odf.OdfPart} p
         */
        function onchange(p) {
            callback(p.url);
        }
        // look for a office:binary-data
        if (url) {
            try {
                part = container.getPart(url);
                part.onchange = onchange;
                part.load();
            } catch (/**@type{*}*/e) {
                runtime.log('slight problem: ' + String(e));
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
        var n,
            i,
            nodes = xpath.getODFElementsWithXPath(odfbody,
                ".//*[*[@text:anchor-type='paragraph']]",
                odf.Namespaces.lookupNamespaceURI);
        for (i = 0; i < nodes.length; i += 1) {
            n = nodes[i];
            if (n.setAttributeNS) {
                n.setAttributeNS(webodfhelperns, "containsparagraphanchor", true);
            }
        }
    }
    /**
     * Modify tables to support merged cells (col/row span)
     * @param {!Element} odffragment
     * @param {!string} documentns
     * @return {undefined}
     */
    function modifyTables(odffragment, documentns) {
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
                node.setAttributeNS(documentns, "colspan",
                    node.getAttributeNS(tablens, "number-columns-spanned"));
            }
            if (node.hasAttributeNS(tablens, "number-rows-spanned")) {
                node.setAttributeNS(documentns, "rowspan",
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
     * Make the text:line-break elements behave like html br element.
     * @param {!Element} odffragment
     * @return {undefined}
     */
    function modifyLineBreakElements(odffragment) {
        var document = odffragment.ownerDocument,
            lineBreakElements = domUtils.getElementsByTagNameNS(odffragment, textns, "line-break");
        lineBreakElements.forEach(function (lineBreak) {
            // Make sure we don't add br more than once as this method is executed whenever user undo an operation.
            if (!lineBreak.hasChildNodes()) {
                lineBreak.appendChild(document.createElement("br"));
            }
        });
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
         * @param {!Element} space
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
     * @param {!odf.ODFDocumentElement} odfnode
     * @param {!CSSStyleSheet} stylesheet
     * @return {undefined}
     **/
    function modifyDrawElements(odfnode, stylesheet) {
        var node,
            odfbody = odfnode.body,
            /**@type{!Array.<!Element>}*/
            drawElements = [],
            i;
        // find all the draw:* elements
        node = odfbody.firstElementChild;
        while (node && node !== odfbody) {
            if (node.namespaceURI === drawns) {
                drawElements[drawElements.length] = node;
            }
            if (node.firstElementChild) {
                node = node.firstElementChild;
            } else {
                while (node && node !== odfbody && !node.nextElementSibling) {
                    node = /**@type{!Element}*/(node.parentNode);
                }
                if (node && node.nextElementSibling) {
                    node = node.nextElementSibling;
                }
            }
        }
        // adjust all the frame positions
        for (i = 0; i < drawElements.length; i += 1) {
            node = drawElements[i];
            setDrawElementPosition(odfnode, 'frame' + String(i), node, stylesheet);
        }
        formatParagraphAnchors(odfbody);
    }

    /**
     * @param {!odf.Formatting} formatting
     * @param {!odf.OdfContainer} odfContainer
     * @param {!Element} shadowContent
     * @param {!odf.ODFDocumentElement} odfnode
     * @param {!CSSStyleSheet} stylesheet
     * @return {undefined}
     **/
    function cloneMasterPages(formatting, odfContainer, shadowContent, odfnode, stylesheet) {
        var masterPageName,
            masterPageElement,
            styleId,
            clonedPageElement,
            clonedElement,
            pageNumber = 0,
            i,
            element,
            elementToClone,
            document = odfContainer.rootElement.ownerDocument;

        element = odfnode.body.firstElementChild;
        // no master pages to expect?
        if (!(element && element.namespaceURI === officens &&
              (element.localName === "presentation" || element.localName === "drawing"))) {
            return;
        }

        element = element.firstElementChild;
        while (element) {
            // If there was a master-page-name attribute, then we are dealing with a draw:page.
            // Get the referenced master page element from the master styles
            masterPageName = element.getAttributeNS(drawns, 'master-page-name');
            masterPageElement = formatting.getMasterPageElement(masterPageName);

            // If the referenced master page exists, create a new page and copy over it's contents into the new page,
            // except for the ones that are placeholders. Also, call setDrawElementPosition on each of those child frames.
            if (masterPageElement) {
                styleId = element.getAttributeNS(webodfhelperns, 'styleid');
                clonedPageElement = document.createElementNS(drawns, 'draw:page');

                elementToClone = masterPageElement.firstElementChild;
                i = 0;
                while (elementToClone) {
                    if (elementToClone.getAttributeNS(presentationns, 'placeholder') !== 'true') {
                        clonedElement = /**@type{!Element}*/(elementToClone.cloneNode(true));
                        clonedPageElement.appendChild(clonedElement);
                        setDrawElementPosition(odfnode, styleId + '_' + i, clonedElement, stylesheet);
                    }
                    elementToClone = elementToClone.nextElementSibling;
                    i += 1;
                }
                // TODO: above already do not clone nodes which match the rule for being dropped
                dropTemplateDrawFrames(clonedPageElement);

                // Append the cloned master page to the "Shadow Content" element outside the main ODF dom
                shadowContent.appendChild(clonedPageElement);

                // Get the page number by counting the number of previous master pages in this shadowContent
                pageNumber = String(shadowContent.getElementsByTagNameNS(drawns, 'page').length);
                // Get the page-number tag in the cloned master page and set the text content to the calculated number
                setContainerValue(clonedPageElement, textns, 'page-number', pageNumber);

                // Care for header
                setContainerValue(clonedPageElement, presentationns, 'header', getHeaderFooter(odfContainer, /**@type{!Element}*/(element), 'header'));
                // Care for footer
                setContainerValue(clonedPageElement, presentationns, 'footer', getHeaderFooter(odfContainer, /**@type{!Element}*/(element), 'footer'));

                // Now call setDrawElementPosition on this new page to set the proper dimensions
                setDrawElementPosition(odfnode, styleId, clonedPageElement, stylesheet);
                // And finally, add an attribute referring to the master page, so the CSS targeted for that master page will style this
                clonedPageElement.setAttributeNS(drawns, 'draw:master-page-name', masterPageElement.getAttributeNS(stylens, 'name'));
            }

            element = element.nextElementSibling;
        }
    }

    /**
     * @param {!odf.OdfContainer} container
     * @param {!Element} plugin
     * @return {undefined}
     **/
    function setVideo(container, plugin) {
        var video, source, url, doc = plugin.ownerDocument,
            /**@type{!odf.OdfPart}*/
            part;

        url = plugin.getAttributeNS(xlinkns, 'href');

        /**
         * @param {?string} url
         * @param {string} mimetype
         * @return {undefined}
         */
        function callback(url, mimetype) {
            var ns = doc.documentElement.namespaceURI;
            // test for video mimetypes
            if (mimetype.substr(0, 6) === 'video/') {
                video = doc.createElementNS(ns, "video");
                video.setAttribute('controls', 'controls');

                source = doc.createElementNS(ns, 'source');
                if (url) {
                    source.setAttribute('src', url);
                }
                source.setAttribute('type', mimetype);

                video.appendChild(source);
                plugin.parentNode.appendChild(video);
            } else {
                plugin.innerHtml = 'Unrecognised Plugin';
            }
        }
        /**
         * @param {!odf.OdfPart} p
         */
        function onchange(p) {
            callback(p.url, p.mimetype);
        }
        // look for a office:binary-data
        if (url) {
            try {
                part = container.getPart(url);
                part.onchange = onchange;
                part.load();
            } catch (/**@type{*}*/e) {
                runtime.log('slight problem: ' + String(e));
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
            suffix = node.getAttributeNS(stylens, "num-suffix") || "",
            prefix = node.getAttributeNS(stylens, "num-prefix") || "",
            rule = "",
            /**@type{!Object.<string,string>}*/
            stylemap = {
                '1': 'decimal',
                'a': 'lower-latin',
                'A': 'upper-latin',
                'i': 'lower-roman',
                'I': 'upper-roman'
            },
            content;

        content = prefix;

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
     * @param {!CSSStyleSheet} stylesheet
     * @param {!string} documentns
     * @return {undefined}
     */
    function loadLists(odffragment, stylesheet, documentns) {
        var i,
            lists,
            node,
            id,
            continueList,
            styleName,
            rule,
            /**@type{!Object.<string,string>}*/
            listMap = {},
            parentList,
            listStyles,
            /**@type{!Object.<string,!Element>}*/
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
                node.setAttributeNS(documentns, "id", id);
                rule = 'text|list#' + id + ' > text|list-item > *:first-child:before {';

                styleName = node.getAttributeNS(textns, 'style-name');
                if (styleName) {
                    node = listStyleMap[styleName];
                    // TODO: getFirstNonWhitespaceChild() could also return a comment. Ensure the result is proper!
                    bulletRule = getBulletsRule(/**@type{Element|undefined}*/(odfUtils.getFirstNonWhitespaceChild(node)));
                }

                if (continueList) {
                    parentList = listMap[continueList];
                    while (parentList) {
                        parentList = listMap[parentList];
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
     * @param {!HTMLHeadElement} head
     * @return {?HTMLStyleElement}
     */
    function findWebODFStyleSheet(head) {
        var style = head.firstElementChild;
        while (style && !(style.localName === "style"
                && style.hasAttribute("webodfcss"))) {
            style = style.nextElementSibling;
        }
        return /**@type{?HTMLStyleElement}*/(style);
    }

    /**
     * @param {!Document} document
     * @return {!HTMLStyleElement}
     */
    function addWebODFStyleSheet(document) {
        var head = /**@type{!HTMLHeadElement}*/(document.getElementsByTagName('head')[0]),
            css,
            /**@type{?HTMLStyleElement}*/
            style,
            href,
            count = document.styleSheets.length;
        // make sure this is only added once per HTML document, e.g. in case of
        // multiple odfCanvases
        style = findWebODFStyleSheet(head);
        if (style) {
            count = parseInt(style.getAttribute("webodfcss"), 10);
            style.setAttribute("webodfcss", count + 1);
            return style;
        }
        if (String(typeof webodf_css) === "string") {
            css = /**@type{!string}*/(webodf_css);
        } else {
            href = "webodf.css";
            if (runtime.currentDirectory) {
                href = runtime.currentDirectory();
                if (href.length > 0 && href.substr(-1) !== "/") {
                    href += "/";
                }
                href += "../webodf.css";
            }
            css = /**@type{!string}*/(runtime.readFileSync(href, "utf-8"));
        }
        style = /**@type{!HTMLStyleElement}*/(document.createElementNS(head.namespaceURI, 'style'));
        style.setAttribute('media', 'screen, print, handheld, projection');
        style.setAttribute('type', 'text/css');
        style.setAttribute('webodfcss', '1');
        style.appendChild(document.createTextNode(css));
        head.appendChild(style);
        return style;
    }

    /**
     * @param {!HTMLStyleElement} webodfcss
     * @return {undefined}
     */
    function removeWebODFStyleSheet(webodfcss) {
        var count = parseInt(webodfcss.getAttribute("webodfcss"), 10);
        if (count === 1) {
             webodfcss.parentNode.removeChild(webodfcss);
        } else {
             webodfcss.setAttribute("count", count - 1);
        }
    }

    /**
     * @param {!Document} document Put and ODF Canvas inside this element.
     * @return {!HTMLStyleElement}
     */
    function addStyleSheet(document) {
        var head = /**@type{!HTMLHeadElement}*/(document.getElementsByTagName('head')[0]),
            style = document.createElementNS(head.namespaceURI, 'style'),
            /**@type{string}*/
            text = '';
        style.setAttribute('type', 'text/css');
        style.setAttribute('media', 'screen, print, handheld, projection');
        odf.Namespaces.forEachPrefix(function(prefix, ns) {
            text += "@namespace " + prefix + " url(" + ns + ");\n";
        });
        text += "@namespace webodfhelper url(" + webodfhelperns + ");\n";
        style.appendChild(document.createTextNode(text));
        head.appendChild(style);
        return /**@type {!HTMLStyleElement}*/(style);
    }
    /**
     * This class manages a loaded ODF document that is shown in an element.
     * It takes care of giving visual feedback on loading, ensures that the
     * stylesheets are loaded.
     * @constructor
     * @implements {gui.AnnotatableCanvas}
     * @implements {ops.Canvas}
     * @implements {core.Destroyable}
     * @param {!HTMLElement} element Put and ODF Canvas inside this element.
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
            /**@type{!PageSwitcher}*/
            pageSwitcher,
            /**@type{HTMLDivElement}*/
            sizer = null,
            /**@type{HTMLDivElement}*/
            annotationsPane = null,
            allowAnnotations = false,
            showAnnotationRemoveButton = false,
            /**@type{gui.AnnotationViewManager}*/
            annotationViewManager = null,
            /**@type{!HTMLStyleElement}*/
            webodfcss,
            /**@type{!HTMLStyleElement}*/
            fontcss,
            /**@type{!HTMLStyleElement}*/
            stylesxmlcss,
            /**@type{!HTMLStyleElement}*/
            positioncss,
            shadowContent,
            /**@type{!Object.<string,!Array.<!Function>>}*/
            eventHandlers = {},
            waitingForDoneTimeoutId,
            /**@type{!core.ScheduledTask}*/redrawContainerTask,
            shouldRefreshCss = false,
            shouldRerenderAnnotations = false,
            loadingQueue = new LoadingQueue(),
            /**@type{!gui.ZoomHelper}*/
            zoomHelper = new gui.ZoomHelper();

        /**
         * Load all the images that are inside an odf element.
         * @param {!odf.OdfContainer} container
         * @param {!Element} odffragment
         * @param {!CSSStyleSheet} stylesheet
         * @return {undefined}
         */
        function loadImages(container, odffragment, stylesheet) {
            var i,
                images,
                node;
            /**
             * Do delayed loading for all the images
             * @param {string} name
             * @param {!odf.OdfContainer} container
             * @param {!Element} node
             * @param {!CSSStyleSheet} stylesheet
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
            var handlers;
            if (eventHandlers.hasOwnProperty(eventType)) {
                handlers = eventHandlers[eventType];
            } else {
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
            var minHeight,
                odfdoc = sizer.firstChild,
                zoomLevel = zoomHelper.getZoomLevel();

            if (!odfdoc) {
                return;
            }

            // All zooming of the sizer within the canvas
            // is done relative to the top-left corner.
            sizer.style.WebkitTransformOrigin = "0% 0%";
            sizer.style.MozTransformOrigin = "0% 0%";
            sizer.style.msTransformOrigin = "0% 0%";
            sizer.style.OTransformOrigin = "0% 0%";
            sizer.style.transformOrigin = "0% 0%";

            if (annotationViewManager) {
                minHeight = annotationViewManager.getMinimumHeightForAnnotationPane();
                if (minHeight) {
                    sizer.style.minHeight = minHeight;
                } else {
                    sizer.style.removeProperty('min-height');
                }
            }

            element.style.width = Math.round(zoomLevel * sizer.offsetWidth) + "px";
            element.style.height = Math.round(zoomLevel * sizer.offsetHeight) + "px";
        }

        /**
         * @return {undefined}
         */
        function redrawContainer() {
            if (shouldRefreshCss) {
                handleStyles(odfcontainer, formatting, stylesxmlcss);
                shouldRefreshCss = false;
                // different styles means different layout, thus different sizes
            }
            if (shouldRerenderAnnotations) {
                if (annotationViewManager) {
                    annotationViewManager.rerenderAnnotations();
                }
                shouldRerenderAnnotations = false;
            }
            fixContainerSize();
        }

        /**
         * A new content.xml has been loaded. Update the live document with it.
         * @param {!odf.OdfContainer} container
         * @param {!odf.ODFDocumentElement} odfnode
         * @return {undefined}
         **/
        function handleContent(container, odfnode) {
            var css = /**@type{!CSSStyleSheet}*/(positioncss.sheet);
            // only append the content at the end
            clear(element);

            sizer = /**@type{!HTMLDivElement}*/(doc.createElementNS(element.namespaceURI, 'div'));
            sizer.style.display = "inline-block";
            sizer.style.background = "white";
            // When the window is shrunk such that the
            // canvas container has a horizontal scrollbar,
            // zooming out seems to not make the scrollable
            // width disappear. This extra scrollable
            // width seems to be proportional to the
            // annotation pane's width. Setting the 'float'
            // of the sizer to 'left' fixes this in webkit.
            sizer.style.setProperty("float", "left", "important");
            sizer.appendChild(odfnode);
            element.appendChild(sizer);

            // An annotations pane div. Will only be shown when annotations are enabled
            annotationsPane = /**@type{!HTMLDivElement}*/(doc.createElementNS(element.namespaceURI, 'div'));
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

            modifyDrawElements(odfnode, css);
            cloneMasterPages(formatting, container, shadowContent, odfnode, css);
            modifyTables(odfnode.body, element.namespaceURI);
            modifyLineBreakElements(odfnode.body);
            expandSpaceElements(odfnode.body);
            expandTabElements(odfnode.body);
            loadImages(container, odfnode.body, css);
            loadVideos(container, odfnode.body);
            loadLists(odfnode.body, css, element.namespaceURI);

            sizer.insertBefore(shadowContent, sizer.firstChild);

            zoomHelper.setZoomableElement(sizer);
        }

        /**
        * Wraps all annotations and renders them using the Annotation View Manager.
        * @param {!Element} odffragment
        * @return {undefined}
        */
        function modifyAnnotations(odffragment) {
            var annotationNodes = /**@type{!Array.<!odf.AnnotationElement>}*/(domUtils.getElementsByTagNameNS(odffragment, officens, 'annotation'));

            annotationNodes.forEach(annotationViewManager.addAnnotation);
            annotationViewManager.rerenderAnnotations();
        }

        /**
         * This should create an annotations pane if non existent, and then populate it with annotations
         * If annotations are disallowed, it should remove the pane and all annotations
         * @param {!odf.ODFDocumentElement} odfnode
         */
        function handleAnnotations(odfnode) {
            if (allowAnnotations) {
                if (!annotationsPane.parentNode) {
                    sizer.appendChild(annotationsPane);
                }
                if (annotationViewManager) {
                    annotationViewManager.forgetAnnotations();
                }
                annotationViewManager = new gui.AnnotationViewManager(self, odfnode.body, annotationsPane, showAnnotationRemoveButton);
                modifyAnnotations(odfnode.body);
                fixContainerSize();
            } else {
                if (annotationsPane.parentNode) {
                    sizer.removeChild(annotationsPane);
                    annotationViewManager.forgetAnnotations();
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
                // clean up
                clearCSSStyleSheet(fontcss);
                clearCSSStyleSheet(stylesxmlcss);
                clearCSSStyleSheet(positioncss);

                clear(element);

                // setup
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

                waitingForDoneTimeoutId = runtime.setTimeout(function later_cb() {
                    if (odfcontainer.state === odf.OdfContainer.DONE) {
                        callback();
                    } else {
                        runtime.log("will be back later...");
                        waitingForDoneTimeoutId = runtime.setTimeout(later_cb, 500);
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
            shouldRefreshCss = true;
            redrawContainerTask.trigger();
        };

        /**
         * Updates the size of the canvas to the size of the content.
         * Needs to be called after changes to the content of the ODF document.
         * @return {undefined}
         */
        this.refreshSize = function () {
            redrawContainerTask.trigger();
        };
        /**
         * @return {!odf.OdfContainer}
         */
        this.odfContainer = function () {
            return odfcontainer;
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
         * @param {string} url
         * @return {undefined}
         */
        function load(url) {
            // clean up
            loadingQueue.clearQueue();

            // FIXME: We need to support parametrized strings, because
            // drop-in word replacements are inadequate for translations;
            // see http://techbase.kde.org/Development/Tutorials/Localization/i18n_Mistakes#Pitfall_.232:_Word_Puzzles
            element.innerHTML = runtime.tr('Loading') + ' ' + url + '...';
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
         * @return {gui.AnnotationViewManager}
         */
        this.getAnnotationViewManager = function () {
            return annotationViewManager;
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
            if (annotationViewManager) {
                shouldRerenderAnnotations = true;
                redrawContainerTask.trigger();
            }
        };

        /**
         * This returns the element inside the canvas which can be zoomed with
         * CSS and which contains the ODF document and the annotation sidebar.
         * @return {!HTMLElement}
         */
        this.getSizer = function () {
            return /**@type{!HTMLElement}*/(sizer);
        };

        /** Allows / disallows annotations
         * @param {!boolean} allow
         * @param {!boolean} showRemoveButton
         * @return {undefined}
         */
        this.enableAnnotations = function (allow, showRemoveButton) {
            if (allow !== allowAnnotations) {
                allowAnnotations = allow;
                showAnnotationRemoveButton = showRemoveButton;
                if (odfcontainer) {
                    handleAnnotations(odfcontainer.rootElement);
                }
            }
        };

        /**
         * Adds an annotation for the annotaiton manager to track
         * and wraps and highlights it
         * @param {!odf.AnnotationElement} annotation
         * @return {undefined}
         */
        this.addAnnotation = function (annotation) {
            if (annotationViewManager) {
                annotationViewManager.addAnnotation(annotation);
                fixContainerSize();
            }
        };

        /**
         * Stops annotations and unwraps it
         * @return {undefined}
         */
        this.forgetAnnotations = function () {
            if (annotationViewManager) {
                annotationViewManager.forgetAnnotations();
                fixContainerSize();
            }
        };

        /**
         * @return {!gui.ZoomHelper}
         */
        this.getZoomHelper = function () {
            return zoomHelper;
        };

        /**
         * @param {!number} zoom
         * @return {undefined}
         */
        this.setZoomLevel = function (zoom) {
            zoomHelper.setZoomLevel(zoom);
        };
        /**
         * @return {!number}
         */
        this.getZoomLevel = function () {
            return zoomHelper.getZoomLevel();
        };
        /**
         * @param {!number} width
         * @param {!number} height
         * @return {undefined}
         */
        this.fitToContainingElement = function (width, height) {
            var zoomLevel = zoomHelper.getZoomLevel(),
                realWidth = element.offsetWidth / zoomLevel,
                realHeight = element.offsetHeight / zoomLevel,
                zoom;

            zoom = width / realWidth;
            if (height / realHeight < zoom) {
                zoom = height / realHeight;
            }
            zoomHelper.setZoomLevel(zoom);
        };
        /**
         * @param {!number} width
         * @return {undefined}
         */
        this.fitToWidth = function (width) {
            var realWidth = element.offsetWidth / zoomHelper.getZoomLevel();
            zoomHelper.setZoomLevel(width / realWidth);
        };
        /**
         * @param {!number} width
         * @param {!number} height
         * @return {undefined}
         */
        this.fitSmart = function (width, height) {
            var realWidth, realHeight, newScale,
                zoomLevel = zoomHelper.getZoomLevel();

            realWidth = element.offsetWidth / zoomLevel;
            realHeight = element.offsetHeight / zoomLevel;

            newScale = width / realWidth;
            if (height !== undefined) {
                if (height / realHeight < newScale) {
                    newScale = height / realHeight;
                }
            }

            zoomHelper.setZoomLevel(Math.min(1.0, newScale));
        };
        /**
         * @param {!number} height
         * @return {undefined}
         */
        this.fitToHeight = function (height) {
            var realHeight = element.offsetHeight / zoomHelper.getZoomLevel();
            zoomHelper.setZoomLevel(height / realHeight);
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
         * @return {!HTMLElement}
         */
        this.getElement = function () {
            return element;
        };

        /**
         * Add additional css rules for newly inserted draw:frame and draw:image. eg. position, dimensions and background image
         * @param {!Element} frame
         */
        this.addCssForFrameWithImage = function (frame) {
            // TODO: frameid and imageid generation here is better brought in sync with that for the images on loading of a odf file.
            var frameName = frame.getAttributeNS(drawns, 'name'),
                fc = frame.firstElementChild;
            setDrawElementPosition(odfcontainer.rootElement, frameName, frame,
                    /**@type{!CSSStyleSheet}*/(positioncss.sheet));
            if (fc) {
                setImage(frameName + 'img', odfcontainer, fc,
                   /**@type{!CSSStyleSheet}*/( positioncss.sheet));
            }
        };
        /**
         * @param {!function(!Object=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function(callback) {
            var head = /**@type{!HTMLHeadElement}*/(doc.getElementsByTagName('head')[0]),
                cleanup = [pageSwitcher.destroy, redrawContainerTask.destroy];

            runtime.clearTimeout(waitingForDoneTimeoutId);
            // TODO: anything to clean with annotationViewManager?
            if (annotationsPane && annotationsPane.parentNode) {
                annotationsPane.parentNode.removeChild(annotationsPane);
            }

            zoomHelper.destroy(function () {
                if (sizer) {
                    element.removeChild(sizer);
                    sizer = null;
                }
            });

            // remove all styles
            removeWebODFStyleSheet(webodfcss);
            head.removeChild(fontcss);
            head.removeChild(stylesxmlcss);
            head.removeChild(positioncss);

            // TODO: loadingQueue, make sure it is empty
            core.Async.destroyAll(cleanup, callback);
        };

        function init() {
            webodfcss = addWebODFStyleSheet(doc);
            pageSwitcher = new PageSwitcher(addStyleSheet(doc));
            fontcss = addStyleSheet(doc);
            stylesxmlcss = addStyleSheet(doc);
            positioncss = addStyleSheet(doc);
            redrawContainerTask = core.Task.createRedrawTask(redrawContainer);
            zoomHelper.subscribe(gui.ZoomHelper.signalZoomChanged, fixContainerSize);
        }

        init();
    };
}());
