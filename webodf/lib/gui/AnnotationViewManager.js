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
/*global runtime, gui, core, odf, Node*/

/**
 * TODO: There is currently brokenness in how annotations which overlap are handled.
 * This needs to be fixed soon.
 */

/*jslint emptyblock:true*/
/**
 * Abstraction of document canvas that can have annotations.
 * @class
 * @interface
 */
gui.AnnotatableCanvas = function AnnotatableCanvas() {"use strict"; };
gui.AnnotatableCanvas.prototype.refreshSize = function () {"use strict"; };
/**
 * @return {!number}
 */
gui.AnnotatableCanvas.prototype.getZoomLevel = function () {"use strict"; };
/**
 * @return {Element}
 */
gui.AnnotatableCanvas.prototype.getSizer = function () {"use strict"; };
/*jslint emptyblock:false*/

/**
 * A GUI class for wrapping Annotation nodes inside html wrappers, positioning
 * them on the sidebar, drawing connectors, and highlighting comments.
 * @constructor
 * @param {!gui.AnnotatableCanvas} canvas
 * @param {!Element} odfFragment
 * @param {!Element} annotationsPane
 * @param {!boolean} showAnnotationRemoveButton
 */
gui.AnnotationViewManager = function AnnotationViewManager(canvas, odfFragment, annotationsPane, showAnnotationRemoveButton) {
    "use strict";
    var /**@type{!Array.<!odf.AnnotationElement>}*/
        annotations = [],
        doc = odfFragment.ownerDocument,
        odfUtils = new odf.OdfUtils(),
        /**@const*/
        CONNECTOR_MARGIN = 30,
        /**@const*/
        NOTE_MARGIN = 20,
        window = runtime.getWindow();

    runtime.assert(Boolean(window),
                   "Expected to be run in an environment which has a global window, like a browser.");
    /**
     * Wraps an annotation with various HTML elements for styling, including connectors
     * @param {!odf.AnnotationElement} annotation
     * @return {undefined}
     */
    function wrapAnnotation(annotation) {
        var annotationWrapper = doc.createElement('div'),
            annotationNote = doc.createElement('div'),
            connectorHorizontal = doc.createElement('div'),
            connectorAngular = doc.createElement('div'),
            removeButton;

        annotationWrapper.className = 'annotationWrapper';
        annotation.parentNode.insertBefore(annotationWrapper, annotation);

        annotationNote.className = 'annotationNote';
        annotationNote.appendChild(annotation);
        if (showAnnotationRemoveButton) {
            removeButton = doc.createElement('div');
            removeButton.className = 'annotationRemoveButton';
            annotationNote.appendChild(removeButton);
        }

        connectorHorizontal.className = 'annotationConnector horizontal';
        connectorAngular.className = 'annotationConnector angular';

        annotationWrapper.appendChild(annotationNote);
        annotationWrapper.appendChild(connectorHorizontal);
        annotationWrapper.appendChild(connectorAngular);
    }

    /**
     * Unwraps an annotation
     * @param {!odf.AnnotationElement} annotation
     * @return {undefined}
     */
    function unwrapAnnotation(annotation) {
        var annotationWrapper = annotation.parentNode.parentNode;

        if (annotationWrapper.localName === 'div') {
            annotationWrapper.parentNode.insertBefore(annotation, annotationWrapper);
            annotationWrapper.parentNode.removeChild(annotationWrapper);
        }
    }

    /**
     * Highlights the text between the annotation node and it's end
     * @param {!odf.AnnotationElement} annotation
     * @return {undefined}
     */
    function highlightAnnotation(annotation) {
        var annotationEnd = annotation.annotationEndElement,
            range = doc.createRange(),
            annotationName = annotation.getAttributeNS(odf.Namespaces.officens, 'name'),
            textNodes;

        if (annotationEnd) {
            range.setStart(annotation, annotation.childNodes.length);
            range.setEnd(annotationEnd, 0);

            textNodes = odfUtils.getTextNodes(range, false);

            textNodes.forEach(function (n) {
                var container = doc.createElement('span');
                container.className = 'annotationHighlight';
                container.setAttribute('annotation', annotationName);

                n.parentNode.insertBefore(container, n);
                container.appendChild(n);
            });
        }

        range.detach();
    }

    /**
     * Unhighlights the text between the annotation node and it's end
     * @param {!odf.AnnotationElement} annotation
     * @return {undefined}
     */
    function unhighlightAnnotation(annotation) {
        var annotationName = annotation.getAttributeNS(odf.Namespaces.officens, 'name'),
            highlightSpans = doc.querySelectorAll('span.annotationHighlight[annotation="' + annotationName + '"]'),
            i,
            container;

        for (i = 0; i < highlightSpans.length; i += 1) {
            container = highlightSpans.item(i);
            while (container.firstChild) {
                container.parentNode.insertBefore(container.firstChild, container);
            }
            container.parentNode.removeChild(container);
        }
    }

    /**
     * @param {!{x:number,y:number}} point1
     * @param {!{x:number,y:number}} point2
     * @return {number}
     */
    function lineDistance(point1, point2) {
        var xs = 0,
            ys = 0;
     
        xs = point2.x - point1.x;
        xs = xs * xs;
     
        ys = point2.y - point1.y;
        ys = ys * ys;
     
        return Math.sqrt(xs + ys);
    }

    /**
     * Recalculates the positions, widths, and rotation angles of things like the annotation note and it's
     * connectors. Can and should be called frequently to update the UI
     * @param {!odf.AnnotationElement} annotation
     * @return {undefined}
     */
    function renderAnnotation(annotation) {
        var annotationNote = /**@type{!Element}*/(annotation.parentNode),
            connectorHorizontal = annotationNote.nextElementSibling,
            connectorAngular = connectorHorizontal.nextElementSibling,
            annotationWrapper = /**@type{!Element}*/(annotationNote.parentNode),
            connectorAngle = 0,
            previousAnnotation = annotations[annotations.indexOf(annotation) - 1],
            previousRect,
            zoomLevel = canvas.getZoomLevel();

        annotationNote.style.left =
            (annotationsPane.getBoundingClientRect().left
            - annotationWrapper.getBoundingClientRect().left) / zoomLevel + 'px';
        annotationNote.style.width = annotationsPane.getBoundingClientRect().width / zoomLevel + 'px';


        connectorHorizontal.style.width = parseFloat(annotationNote.style.left)
                                          - CONNECTOR_MARGIN + 'px';

        if (previousAnnotation) {
            previousRect = /**@type{!Element}*/(previousAnnotation.parentNode).getBoundingClientRect();
            if ((annotationWrapper.getBoundingClientRect().top - previousRect.bottom) / zoomLevel <= NOTE_MARGIN) {
                annotationNote.style.top = Math.abs(annotationWrapper.getBoundingClientRect().top - previousRect.bottom) / zoomLevel + NOTE_MARGIN + 'px';
            } else {
                annotationNote.style.top = '0px';
            }
        }

        connectorAngular.style.left = connectorHorizontal.getBoundingClientRect().width / zoomLevel + 'px';
        connectorAngular.style.width =
            lineDistance({
                x: connectorAngular.getBoundingClientRect().left / zoomLevel,
                y: connectorAngular.getBoundingClientRect().top / zoomLevel
            }, {
                x: annotationNote.getBoundingClientRect().left / zoomLevel,
                y: annotationNote.getBoundingClientRect().top / zoomLevel
            }) + 'px';

        connectorAngle = Math.asin(
            (annotationNote.getBoundingClientRect().top - connectorAngular.getBoundingClientRect().top)
                / (zoomLevel * parseFloat(connectorAngular.style.width))
        );
        connectorAngular.style.transform = 'rotate(' + connectorAngle + 'rad)';
        connectorAngular.style.MozTransform = 'rotate(' + connectorAngle + 'rad)';
        connectorAngular.style.WebkitTransform = 'rotate(' + connectorAngle + 'rad)';
        connectorAngular.style.msTransform = 'rotate(' + connectorAngle + 'rad)';
    }

    /**
     * Show or hide annotations pane
     * @param {!boolean} show
     * @return {undefined}
     */
    function showAnnotationsPane(show) {
        var sizer = canvas.getSizer();

        if (show) {
            annotationsPane.style.display = 'inline-block';
            sizer.style.paddingRight = window.getComputedStyle(annotationsPane).width;
        } else {
            annotationsPane.style.display = 'none';
            sizer.style.paddingRight = 0;
        }
        canvas.refreshSize();
    }

/*jslint bitwise:true*/
    /**
     * Sorts the internal annotations array by order of occurence in the document.
     * Useful for calculating the order of annotations in the sidebar, and positioning them
     * accordingly
     * @return {undefined}
     */
    function sortAnnotations() {
        annotations.sort(function (a, b) {
            if ((a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
                return -1;
            }
            return 1;
        });
    }
/*jslint bitwise:false*/

    /**
     * Recalculates the rendering - positions, rotation angles for connectors,
     * etc - for all tracked annotations.
     * @return {undefined}
     */
    function rerenderAnnotations() {
        var i;

        for (i = 0; i < annotations.length; i += 1) {
            renderAnnotation(annotations[i]);
        }
    }
    this.rerenderAnnotations = rerenderAnnotations;

    /**
     * Reports the minimum height in pixels needed to display all
     * annotation notes in the annotation pane.
     * If there is no pane shown or are no annotations, null is returned.
     * @return {?string}
     */
    function getMinimumHeightForAnnotationPane() {
        if (annotationsPane.style.display !== 'none' && annotations.length > 0) {
            return (/**@type{!Element}*/(annotations[annotations.length-1].parentNode).getBoundingClientRect().bottom - annotationsPane.getBoundingClientRect().top) / canvas.getZoomLevel() + 'px';
        }
        return null;
    }
    this.getMinimumHeightForAnnotationPane = getMinimumHeightForAnnotationPane;

    /**
     * Adds an annotation to track, and wraps and highlights it
     * @param {!odf.AnnotationElement} annotation
     * @return {undefined}
     */
    function addAnnotation(annotation) {
        showAnnotationsPane(true);

        // TODO: make use of the fact that current list is already sorted
        // instead just iterate over the list until the right index to insert is found
        annotations.push(annotation);

        sortAnnotations();

        wrapAnnotation(annotation);
        if (annotation.annotationEndElement) {
            highlightAnnotation(annotation);
        }
        rerenderAnnotations();
    }
    this.addAnnotation = addAnnotation;

    /**
     * Unhighlights, unwraps, and ejects an annotation from the tracking
     * @param {!odf.AnnotationElement} annotation
     * @return {undefined}
     */
    function forgetAnnotation(annotation) {
        var index = annotations.indexOf(annotation);
        unwrapAnnotation(annotation);
        unhighlightAnnotation(annotation);
        if (index !== -1) {
            annotations.splice(index, 1);
        }
        if (annotations.length === 0) {
            showAnnotationsPane(false);
        }
    }

    /**
     * Untracks, unwraps, and unhighlights all annotations
     * @return {undefined}
     */
    function forgetAnnotations() {
        while (annotations.length) {
            forgetAnnotation(annotations[0]);
        }
    }
    this.forgetAnnotations = forgetAnnotations;
};
