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

/*global runtime, ops */

/**
 * @constructor
 */
ops.OperationTransformMatrix = function OperationTransformMatrix() {
    "use strict";

    var /**@const*/
        INCLUSIVE = true,
        /**@const*/
        EXCLUSIVE = false,
        /**@type {!Object.<string,!Object.<string,function(!Object,!Object,boolean=):?{opSpecsA:!Array.<!{optype:string}>, opSpecsB:!Array.<!{optype:string}>}>>}*/
        transformations;

    /* Utility methods */

    /**
     * Inverts the range spanned up by the spec's parameter position and length,
     * so that position is at the other end of the range and length relative to that.
     * @param {!ops.OpMoveCursor.Spec} moveCursorSpec
     * @return {undefined}
     */
    function invertMoveCursorSpecRange(moveCursorSpec) {
        moveCursorSpec.position = moveCursorSpec.position + moveCursorSpec.length;
        moveCursorSpec.length *= -1;
    }

    /**
     * Inverts the range spanned up by position and length if the length is negative.
     * Returns true if an inversion was done, false otherwise.
     * @param {!ops.OpMoveCursor.Spec} moveCursorSpec
     * @return {!boolean}
     */
    function invertMoveCursorSpecRangeOnNegativeLength(moveCursorSpec) {
        var isBackwards = (moveCursorSpec.length < 0);

        if (isBackwards) {
            invertMoveCursorSpecRange(moveCursorSpec);
        }
        return isBackwards;
    }

    /**
     * Returns a list with all attributes in setProperties that refer to styleName
     * @param {?odf.Formatting.StyleData} setProperties
     * @param {!string} styleName
     * @return {!Array.<!string>}
     */
    function getStyleReferencingAttributes(setProperties, styleName) {
        var attributes = [];
        /**
         * @param {string} attributeName
         */
        function check(attributeName) {
            if (setProperties[attributeName] === styleName) {
                attributes.push(attributeName);
            }
        }
        if (setProperties) {
            ['style:parent-style-name', 'style:next-style-name'].forEach(check);
        }
        return attributes;
    }
    /**
     * @param {?odf.Formatting.StyleData} setProperties
     * @param {!string} deletedStyleName
     * @return {undefined}
     */
    function dropStyleReferencingAttributes(setProperties, deletedStyleName) {
        /**
         * @param {string} attributeName
         */
        function del(attributeName) {
            if (setProperties[attributeName] === deletedStyleName) {
                delete setProperties[attributeName];
            }
        }
        if (setProperties) {
            ['style:parent-style-name', 'style:next-style-name'].forEach(del);
        }
    }

    /**
     * Creates a deep copy of the opspec
     * @param {!Object} opspec
     * @return {!Object}
     */
    function cloneOpspec(opspec) {
        var result = {};

        Object.keys(opspec).forEach(function (key) {
            if (typeof opspec[key] === 'object') {
                result[key] = cloneOpspec(opspec[key]);
            } else {
                result[key] = opspec[key];
            }
        });

        return result;
    }

    /**
     * @param {?Object.<string,*>} minorSetProperties
     * @param {?{attributes:string}} minorRemovedProperties
     * @param {?Object.<string,*>} majorSetProperties
     * @param {?{attributes:string}} majorRemovedProperties
     * @return {!{majorChanged:boolean,minorChanged:boolean}}
     */
    function dropOverruledAndUnneededAttributes(minorSetProperties, minorRemovedProperties, majorSetProperties, majorRemovedProperties) {
        var i, name,
            majorChanged = false, minorChanged = false,
            removedPropertyNames,
            /**@type{!Array.<string>}*/
            majorRemovedPropertyNames = [];
        if (majorRemovedProperties && majorRemovedProperties.attributes) {
            majorRemovedPropertyNames = majorRemovedProperties.attributes.split(',');
        }

        // iterate over all properties and see which get overwritten or deleted
        // by the overruling, so they have to be dropped
        if (minorSetProperties && (majorSetProperties || majorRemovedPropertyNames.length > 0)) {
            Object.keys(minorSetProperties).forEach(function (key) {
                var value = minorSetProperties[key],
                    overrulingPropertyValue;
                // TODO: support more than one level
                if (typeof value !== "object") {
                    if (majorSetProperties) {
                        overrulingPropertyValue = majorSetProperties[key];
                    }
                    if (overrulingPropertyValue !== undefined) {
                        // drop overruled
                        delete minorSetProperties[key];
                        minorChanged = true;

                        // major sets to same value?
                        if (overrulingPropertyValue === value) {
                            // drop major as well
                            delete majorSetProperties[key];
                            majorChanged = true;
                        }
                    } else if (majorRemovedPropertyNames.indexOf(key) !== -1) {
                        // drop overruled
                        delete minorSetProperties[key];
                        minorChanged = true;
                    }
                }
            });
        }

        // iterate over all overruling removed properties and drop any duplicates from
        // the removed property names
        if (minorRemovedProperties && minorRemovedProperties.attributes && (majorSetProperties || majorRemovedPropertyNames.length > 0)) {
            removedPropertyNames = minorRemovedProperties.attributes.split(',');
            for (i = 0; i < removedPropertyNames.length; i += 1) {
                name = removedPropertyNames[i];
                if ((majorSetProperties && majorSetProperties[name] !== undefined) ||
                        (majorRemovedPropertyNames && majorRemovedPropertyNames.indexOf(name) !== -1)) {
                    // drop
                    removedPropertyNames.splice(i, 1);
                    i -= 1;
                    minorChanged = true;
                }
            }
            // set back
            if (removedPropertyNames.length > 0) {
                minorRemovedProperties.attributes = removedPropertyNames.join(',');
            } else {
                delete minorRemovedProperties.attributes;
            }
        }

        return {
            majorChanged: majorChanged,
            minorChanged: minorChanged
        };
    }

    /**
     * Estimates if there are any properties set in the given properties object.
     * @param {!odf.Formatting.StyleData} properties
     * @return {!boolean}
     */
    function hasProperties(properties) {
        var /**@type{string}*/
            key;

        for (key in properties) {
            if (properties.hasOwnProperty(key)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Estimates if there are any properties set in the given properties object.
     * @param {!{attributes:string}} properties
     * @return {!boolean}
     */
    function hasRemovedProperties(properties) {
        var /**@type{string}*/
            key;

        for (key in properties) {
            if (properties.hasOwnProperty(key)) {
                // handle empty 'attribute' as not existing
                if (key !== 'attributes' || properties.attributes.length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * @param {?odf.Formatting.StyleData} minorSet
     * @param {?Object.<string,{attributes:string}>} minorRem
     * @param {?odf.Formatting.StyleData} majorSet
     * @param {?Object.<string,{attributes:string}>} majorRem
     * @param {!string} propertiesName
     * @return {?{majorChanged:boolean,minorChanged:boolean}}
     */
    function dropOverruledAndUnneededProperties(minorSet, minorRem, majorSet, majorRem, propertiesName) {
        var minorSP = /**@type{?odf.Formatting.StyleData}*/(minorSet ? minorSet[propertiesName] : null),
            minorRP = minorRem ? minorRem[propertiesName] : null,
            majorSP = /**@type{?odf.Formatting.StyleData}*/(majorSet ? majorSet[propertiesName] : null),
            majorRP = majorRem ? majorRem[propertiesName] : null,
            result;

        // TODO: also care for nested properties, like there can be e.g. with text:paragraph-properties
        result = dropOverruledAndUnneededAttributes(minorSP, minorRP, majorSP, majorRP);

        // remove empty setProperties
        if (minorSP && !hasProperties(minorSP)) {
            delete minorSet[propertiesName];
        }
        // remove empty removedProperties
        if (minorRP && !hasRemovedProperties(minorRP)) {
            delete minorRem[propertiesName];
        }

        // remove empty setProperties
        if (majorSP && !hasProperties(majorSP)) {
            delete majorSet[propertiesName];
        }
        // remove empty removedProperties
        if (majorRP && !hasRemovedProperties(majorRP)) {
            delete majorRem[propertiesName];
        }

        return result;
    }

    /**
     * Checks whether the given position is within the range of the add list operation.
     * This range check is always inclusive of the start paragraph position
     * @param {!number} position
     * @param {!ops.OpAddList.Spec} spec
     * @param {!boolean} isInclusiveEndPosition Range check is inclusive of the end paragraph position
     * @return {!boolean}
     */
    function isWithinRange(position, spec, isInclusiveEndPosition) {
        var withinEnd;

        withinEnd = isInclusiveEndPosition ? position <= spec.endParagraphPosition : position < spec.endParagraphPosition;

        return position >= spec.startParagraphPosition && withinEnd;
    }

    /* Transformation methods */

    /**
     * @param {!ops.OpAddList.Spec} addListSpecA
     * @param {!ops.OpAddList.Spec} addListSpecB
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformAddListAddList(addListSpecA, addListSpecB) {
        var opSpecsA = [addListSpecA],
            opSpecsB = [addListSpecB];

        //TODO: consider style names. This can't be resolved currently as there is no op to set a style on a list after creation.
        // same range so this becomes a no-op
        if (addListSpecA.startParagraphPosition === addListSpecB.startParagraphPosition &&
            addListSpecA.endParagraphPosition === addListSpecB.endParagraphPosition) {
            opSpecsA = [];
            opSpecsB = [];
        }

        // ranges intersect
        if (isWithinRange(addListSpecA.startParagraphPosition, addListSpecB, INCLUSIVE) ||
            isWithinRange(addListSpecA.endParagraphPosition, addListSpecB, INCLUSIVE)) {
            //TODO: do something useful here once we get list merge ops and solve the conflict by merging the lists
            return null;
        }

        return {
            opSpecsA: opSpecsA,
            opSpecsB: opSpecsB
        };
    }

    /**
     * @param {!ops.OpAddList.Spec} addListSpec
     * @param {!ops.OpInsertText.Spec} insertTextSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformAddListInsertText(addListSpec, insertTextSpec) {
        // insert text is before the add list range so adjust the start position and end position
        if (insertTextSpec.position < addListSpec.startParagraphPosition) {
            addListSpec.startParagraphPosition += insertTextSpec.text.length;
            addListSpec.endParagraphPosition += insertTextSpec.text.length;
        } else if (isWithinRange(insertTextSpec.position, addListSpec, EXCLUSIVE)) {
            // otherwise insert text is within the add list range so only shift the end of the range
            addListSpec.endParagraphPosition += insertTextSpec.text.length;
        }

        return {
            opSpecsA: [addListSpec],
            opSpecsB: [insertTextSpec]
        };
    }

    /**
     * @param {!ops.OpAddList.Spec} addListSpec
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformAddListMergeParagraph(addListSpec, mergeParagraphSpec) {
        if (mergeParagraphSpec.sourceStartPosition === addListSpec.startParagraphPosition) {
            // TODO: handle this properly once we have Merge/Split list ops as merge paragraph pulls the paragraph out of the list
            return null;
        }

        if (mergeParagraphSpec.sourceStartPosition < addListSpec.startParagraphPosition) {
            // merge op source paragraph is before the list range so adjust the start and the end
            addListSpec.startParagraphPosition -= 1;
            addListSpec.endParagraphPosition -= 1;
        } else if (isWithinRange(mergeParagraphSpec.sourceStartPosition, addListSpec, EXCLUSIVE)) {
            // merge op is fully contained in list range so just shift the end of the list range
            addListSpec.endParagraphPosition -= 1;
        } else if (mergeParagraphSpec.sourceStartPosition === addListSpec.endParagraphPosition) {
            // merge op source paragraph is the same as the end of the list range so shift
            // the end of the list range up to the merge op destination paragraph
            addListSpec.endParagraphPosition = mergeParagraphSpec.destinationStartPosition;
        }

        return {
            opSpecsA: [addListSpec],
            opSpecsB: [mergeParagraphSpec]
        };
    }

    /**
     * @param {!ops.OpAddList.Spec} addListSpec
     * @param {!ops.OpRemoveList.Spec} removeListSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformAddListRemoveList(addListSpec, removeListSpec) {
        // This should never happen as a client must ensure it does not add a list where one already exists
        // and remove a list that does not exist in the document.
        // This does not detect an overlap where the range of the add list operation occurs after the start position of the
        // removed list as we don't know the end position of the removed list.
        if (isWithinRange(removeListSpec.firstParagraphPosition, addListSpec, INCLUSIVE)) {
            return null;
        }

        return {
            opSpecsA: [addListSpec],
            opSpecsB: [removeListSpec]
        };
    }

    /**
     * @param {!ops.OpAddList.Spec} addListSpec
     * @param {!ops.OpRemoveText.Spec} removeTextSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformAddListRemoveText(addListSpec, removeTextSpec) {
        // remove text is before the add list range so adjust the start position and end position
        if (removeTextSpec.position < addListSpec.startParagraphPosition) {
            addListSpec.startParagraphPosition -= removeTextSpec.length;
            addListSpec.endParagraphPosition -= removeTextSpec.length;
        } else if (isWithinRange(removeTextSpec.position, addListSpec, EXCLUSIVE)) {
            // otherwise remove text is within the add list range so only shift the end of the range
            addListSpec.endParagraphPosition -= removeTextSpec.length;
        }

        return {
            opSpecsA: [addListSpec],
            opSpecsB: [removeTextSpec]
        };
    }

    /**
     * @param {!ops.OpAddList.Spec} addListSpec
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformAddListSplitParagraph(addListSpec, splitParagraphSpec) {
        // split op source paragraph is before the list range so adjust the start and the end
        if (splitParagraphSpec.sourceParagraphPosition < addListSpec.startParagraphPosition) {
            addListSpec.startParagraphPosition += 1;
            addListSpec.endParagraphPosition += 1;
        } else if (isWithinRange(splitParagraphSpec.sourceParagraphPosition, addListSpec, EXCLUSIVE)) {
            // split op is fully contained in list range so just shift the end of the list range
            addListSpec.endParagraphPosition += 1;
        } else if (splitParagraphSpec.sourceParagraphPosition === addListSpec.endParagraphPosition) {
            // split op source paragraph is the same as the end of the list range so shift the range
            // down to the split position which is the new end paragraph
            addListSpec.endParagraphPosition = splitParagraphSpec.position + 1;
        }

        return {
            opSpecsA: [addListSpec],
            opSpecsB: [splitParagraphSpec]
        };
    }

    /**
     * @param {!ops.OpAddListStyle.Spec} addListStyleSpecA
     * @param {!ops.OpAddListStyle.Spec} addListStyleSpecB
     */
    function transformAddListStyleAddListStyle(addListStyleSpecA, addListStyleSpecB) {
        //TODO: handle list style conflicts
        if(addListStyleSpecA.styleName === addListStyleSpecB.styleName) {
            return null;
        }

        return {
            opSpecsA: [addListStyleSpecA],
            opSpecsB: [addListStyleSpecB]
        };
    }

    /**
     * @param {!ops.OpAddStyle.Spec} addStyleSpec
     * @param {!ops.OpRemoveStyle.Spec} removeStyleSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformAddStyleRemoveStyle(addStyleSpec, removeStyleSpec) {
        var setAttributes,
            helperOpspec,
            addStyleSpecResult = [addStyleSpec],
            removeStyleSpecResult = [removeStyleSpec];

        if (addStyleSpec.styleFamily === removeStyleSpec.styleFamily) {
            // deleted style brought into use by addstyle op?
            setAttributes = getStyleReferencingAttributes(addStyleSpec.setProperties, removeStyleSpec.styleName);
            if (setAttributes.length > 0) {
                // just create a updateparagraph style op preceding to us which removes any set style from the paragraph
                helperOpspec = {
                    optype: "UpdateParagraphStyle",
                    memberid: removeStyleSpec.memberid,
                    timestamp: removeStyleSpec.timestamp,
                    styleName: addStyleSpec.styleName,
                    removedProperties: { attributes: setAttributes.join(',') }
                };
                removeStyleSpecResult.unshift(helperOpspec);
            }
            // in the addstyle op drop any attributes referencing the style deleted
            dropStyleReferencingAttributes(addStyleSpec.setProperties, removeStyleSpec.styleName);
        }

        return {
            opSpecsA:  addStyleSpecResult,
            opSpecsB:  removeStyleSpecResult
        };
    }

    /**
     * @param {!ops.OpApplyDirectStyling.Spec} applyDirectStylingSpecA
     * @param {!ops.OpApplyDirectStyling.Spec} applyDirectStylingSpecB
     * @param {!boolean} hasAPriority
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformApplyDirectStylingApplyDirectStyling(applyDirectStylingSpecA, applyDirectStylingSpecB, hasAPriority) {
        var majorSpec, minorSpec, majorSpecResult, minorSpecResult,
            majorSpecEnd, minorSpecEnd, dropResult,
            originalMajorSpec, originalMinorSpec,
            helperOpspecBefore, helperOpspecAfter,
            applyDirectStylingSpecAResult = [applyDirectStylingSpecA],
            applyDirectStylingSpecBResult = [applyDirectStylingSpecB];

        // overlapping and any conflicting attributes?
        if (!(applyDirectStylingSpecA.position + applyDirectStylingSpecA.length <= applyDirectStylingSpecB.position ||
              applyDirectStylingSpecA.position >= applyDirectStylingSpecB.position + applyDirectStylingSpecB.length)) {
            // adapt to priority
            majorSpec = hasAPriority ? applyDirectStylingSpecA : applyDirectStylingSpecB;
            minorSpec = hasAPriority ? applyDirectStylingSpecB : applyDirectStylingSpecA;

            // might need original opspecs?
            if (applyDirectStylingSpecA.position !== applyDirectStylingSpecB.position ||
                    applyDirectStylingSpecA.length !== applyDirectStylingSpecB.length) {
                originalMajorSpec = cloneOpspec(majorSpec);
                originalMinorSpec = cloneOpspec(minorSpec);
            }

            // for the part that is overlapping reduce setProperties by the overruled properties
            dropResult = dropOverruledAndUnneededProperties(
                minorSpec.setProperties,
                null,
                majorSpec.setProperties,
                null,
                'style:text-properties'
            );

            if (dropResult.majorChanged || dropResult.minorChanged) {
                // split the less-priority op into several ops for the overlapping and non-overlapping ranges
                majorSpecResult = [];
                minorSpecResult = [];

                majorSpecEnd = majorSpec.position + majorSpec.length;
                minorSpecEnd = minorSpec.position + minorSpec.length;

                // find if there is a part before and if there is a part behind,
                // create range-adapted copies of the original opspec, if the spec has changed
                if (minorSpec.position < majorSpec.position) {
                    if (dropResult.minorChanged) {
                        helperOpspecBefore = cloneOpspec(/**@type{!Object}*/(originalMinorSpec));
                        helperOpspecBefore.length = majorSpec.position - minorSpec.position;
                        minorSpecResult.push(helperOpspecBefore);

                        minorSpec.position = majorSpec.position;
                        minorSpec.length = minorSpecEnd - minorSpec.position;
                    }
                } else if (majorSpec.position < minorSpec.position) {
                    if (dropResult.majorChanged) {
                        helperOpspecBefore = cloneOpspec(/**@type{!Object}*/(originalMajorSpec));
                        helperOpspecBefore.length = minorSpec.position - majorSpec.position;
                        majorSpecResult.push(helperOpspecBefore);

                        majorSpec.position = minorSpec.position;
                        majorSpec.length = majorSpecEnd - majorSpec.position;
                    }
                }
                if (minorSpecEnd > majorSpecEnd) {
                    if (dropResult.minorChanged) {
                        helperOpspecAfter = originalMinorSpec;
                        helperOpspecAfter.position = majorSpecEnd;
                        helperOpspecAfter.length = minorSpecEnd - majorSpecEnd;
                        minorSpecResult.push(helperOpspecAfter);

                        minorSpec.length = majorSpecEnd - minorSpec.position;
                    }
                } else if (majorSpecEnd > minorSpecEnd) {
                    if (dropResult.majorChanged) {
                        helperOpspecAfter = originalMajorSpec;
                        helperOpspecAfter.position = minorSpecEnd;
                        helperOpspecAfter.length = majorSpecEnd - minorSpecEnd;
                        majorSpecResult.push(helperOpspecAfter);

                        majorSpec.length = minorSpecEnd - majorSpec.position;
                    }
                }

                // check if there are any changes left and this op has not become a noop
                if (majorSpec.setProperties && hasProperties(majorSpec.setProperties)) {
                    majorSpecResult.push(majorSpec);
                }
                // check if there are any changes left and this op has not become a noop
                if (minorSpec.setProperties && hasProperties(minorSpec.setProperties)) {
                    minorSpecResult.push(minorSpec);
                }

                if (hasAPriority) {
                    applyDirectStylingSpecAResult = majorSpecResult;
                    applyDirectStylingSpecBResult = minorSpecResult;
                } else {
                    applyDirectStylingSpecAResult = minorSpecResult;
                    applyDirectStylingSpecBResult = majorSpecResult;
                }
            }
        }

        return {
            opSpecsA:  applyDirectStylingSpecAResult,
            opSpecsB:  applyDirectStylingSpecBResult
        };
    }

    /**
     * @param {!ops.OpApplyDirectStyling.Spec} applyDirectStylingSpec
     * @param {!ops.OpInsertText.Spec} insertTextSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformApplyDirectStylingInsertText(applyDirectStylingSpec, insertTextSpec) {
        // adapt applyDirectStyling spec to inserted positions
        if (insertTextSpec.position <= applyDirectStylingSpec.position) {
            applyDirectStylingSpec.position += insertTextSpec.text.length;
        } else if (insertTextSpec.position <= applyDirectStylingSpec.position + applyDirectStylingSpec.length) {
            applyDirectStylingSpec.length += insertTextSpec.text.length;
        }

        return {
            opSpecsA:  [applyDirectStylingSpec],
            opSpecsB:  [insertTextSpec]
        };
    }

    /**
     * @param {!ops.OpApplyDirectStyling.Spec} applyDirectStylingSpec
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformApplyDirectStylingMergeParagraph(applyDirectStylingSpec, mergeParagraphSpec) {
        var pointA = applyDirectStylingSpec.position,
            pointB = applyDirectStylingSpec.position + applyDirectStylingSpec.length;

        // adapt applyDirectStyling spec to merged paragraph
        if (pointA >= mergeParagraphSpec.sourceStartPosition) {
            pointA -= 1;
        }
        if (pointB >= mergeParagraphSpec.sourceStartPosition) {
            pointB -= 1;
        }
        applyDirectStylingSpec.position = pointA;
        applyDirectStylingSpec.length = pointB - pointA;

        return {
            opSpecsA:  [applyDirectStylingSpec],
            opSpecsB:  [mergeParagraphSpec]
        };
    }

    /**
     * @param {!ops.OpApplyDirectStyling.Spec} applyDirectStylingSpec
     * @param {!ops.OpRemoveText.Spec} removeTextSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformApplyDirectStylingRemoveText(applyDirectStylingSpec, removeTextSpec) {
        var applyDirectStylingSpecEnd = applyDirectStylingSpec.position + applyDirectStylingSpec.length,
            removeTextSpecEnd = removeTextSpec.position + removeTextSpec.length,
            applyDirectStylingSpecResult = [applyDirectStylingSpec],
            removeTextSpecResult = [removeTextSpec];

        // transform applyDirectStylingSpec
        // removed positions by object up to move cursor position?
        if (removeTextSpecEnd <= applyDirectStylingSpec.position) {
            // adapt by removed position
            applyDirectStylingSpec.position -= removeTextSpec.length;
        // overlapping?
        } else if (removeTextSpec.position < applyDirectStylingSpecEnd) {
            // still to select range starting at cursor position?
            if (applyDirectStylingSpec.position < removeTextSpec.position) {
                // still to select range ending at selection?
                if (removeTextSpecEnd < applyDirectStylingSpecEnd) {
                    applyDirectStylingSpec.length -= removeTextSpec.length;
                } else {
                    applyDirectStylingSpec.length = removeTextSpec.position - applyDirectStylingSpec.position;
                }
            // remove overlapping section
            } else {
                // fall at start of removed section
                applyDirectStylingSpec.position = removeTextSpec.position;
                // still to select range at selection end?
                if (removeTextSpecEnd < applyDirectStylingSpecEnd) {
                    applyDirectStylingSpec.length = applyDirectStylingSpecEnd - removeTextSpecEnd;
                } else {
                    // completely overlapped by other, so becomes no-op
                    // TODO: once we can address spans, removeTextSpec would need to get a helper op
                    // to remove the empty span left over
                    applyDirectStylingSpecResult = [];
                }
            }
        }

        return {
            opSpecsA:  applyDirectStylingSpecResult,
            opSpecsB:  removeTextSpecResult
        };
    }

    /**
     * @param {!ops.OpApplyDirectStyling.Spec} applyDirectStylingSpec
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformApplyDirectStylingSplitParagraph(applyDirectStylingSpec, splitParagraphSpec) {
        // transform applyDirectStylingSpec
        if (splitParagraphSpec.position < applyDirectStylingSpec.position) {
            applyDirectStylingSpec.position += 1;
        } else if (splitParagraphSpec.position < applyDirectStylingSpec.position + applyDirectStylingSpec.length) {
            applyDirectStylingSpec.length += 1;
        }

        return {
            opSpecsA:  [applyDirectStylingSpec],
            opSpecsB:  [splitParagraphSpec]
        };
    }

    /**
     * @param {!ops.OpInsertText.Spec} insertTextSpecA
     * @param {!ops.OpInsertText.Spec} insertTextSpecB
     * @param {!boolean} hasAPriority
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformInsertTextInsertText(insertTextSpecA, insertTextSpecB, hasAPriority) {
        if (insertTextSpecA.position < insertTextSpecB.position) {
            insertTextSpecB.position += insertTextSpecA.text.length;
        } else if (insertTextSpecA.position > insertTextSpecB.position) {
            insertTextSpecA.position += insertTextSpecB.text.length;
        } else {
            if (hasAPriority) {
                insertTextSpecB.position += insertTextSpecA.text.length;
            } else {
                insertTextSpecA.position += insertTextSpecB.text.length;
            }
        }

        return {
            opSpecsA:  [insertTextSpecA],
            opSpecsB:  [insertTextSpecB]
        };
    }

    /**
     * @param {!ops.OpInsertText.Spec} insertTextSpec
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformInsertTextMergeParagraph(insertTextSpec, mergeParagraphSpec) {
        if (insertTextSpec.position >= mergeParagraphSpec.sourceStartPosition) {
            insertTextSpec.position -= 1;
        } else {
            if (insertTextSpec.position < mergeParagraphSpec.sourceStartPosition) {
                mergeParagraphSpec.sourceStartPosition += insertTextSpec.text.length;
            }
            if (insertTextSpec.position < mergeParagraphSpec.destinationStartPosition) {
                mergeParagraphSpec.destinationStartPosition += insertTextSpec.text.length;
            }
        }

        return {
            opSpecsA:  [insertTextSpec],
            opSpecsB:  [mergeParagraphSpec]
        };
    }

    /**
     * @param {!ops.OpInsertText.Spec} insertTextSpec
     * @param {!ops.OpMoveCursor.Spec} moveCursorSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformInsertTextMoveCursor(insertTextSpec, moveCursorSpec) {
        var isMoveCursorSpecRangeInverted = invertMoveCursorSpecRangeOnNegativeLength(moveCursorSpec);

        // adapt movecursor spec to inserted positions
        if (insertTextSpec.position < moveCursorSpec.position) {
            moveCursorSpec.position += insertTextSpec.text.length;
        } else if (insertTextSpec.position < moveCursorSpec.position + moveCursorSpec.length) {
            moveCursorSpec.length += insertTextSpec.text.length;
        }

        if (isMoveCursorSpecRangeInverted) {
            invertMoveCursorSpecRange(moveCursorSpec);
        }

        return {
            opSpecsA:  [insertTextSpec],
            opSpecsB:  [moveCursorSpec]
        };
    }

    /**
     * @param {!ops.OpInsertText.Spec} insertTextSpec
     * @param {!ops.OpRemoveList.Spec} removeListSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformInsertTextRemoveList(insertTextSpec, removeListSpec) {
        // adjust list start position only if text is inserted before the list start position
        if (insertTextSpec.position < removeListSpec.firstParagraphPosition) {
            removeListSpec.firstParagraphPosition += insertTextSpec.text.length;
        }

        return {
            opSpecsA: [insertTextSpec],
            opSpecsB: [removeListSpec]
        };
    }

    /**
     * @param {!ops.OpInsertText.Spec} insertTextSpec
     * @param {!ops.OpRemoveText.Spec} removeTextSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformInsertTextRemoveText(insertTextSpec, removeTextSpec) {
        var helperOpspec,
            removeTextSpecEnd = removeTextSpec.position + removeTextSpec.length,
            insertTextSpecResult = [insertTextSpec],
            removeTextSpecResult = [removeTextSpec];

        // update insertTextSpec
        // removed before/up to insertion point?
        if (removeTextSpecEnd <= insertTextSpec.position) {
            insertTextSpec.position -= removeTextSpec.length;
        // removed at/behind insertion point
        } else if (insertTextSpec.position <= removeTextSpec.position) {
            removeTextSpec.position += insertTextSpec.text.length;
        // insertion in middle of removed range
        } else {
            // we have to split the removal into two ops, before and after the insertion point
            removeTextSpec.length = insertTextSpec.position - removeTextSpec.position;
            helperOpspec = {
                optype: "RemoveText",
                memberid: removeTextSpec.memberid,
                timestamp: removeTextSpec.timestamp,
                position: insertTextSpec.position + insertTextSpec.text.length,
                length: removeTextSpecEnd - insertTextSpec.position
            };
            removeTextSpecResult.unshift(helperOpspec); // helperOp first, so its position is not affected by the real op
            // drop insertion point to begin of removed range
            // original insertTextSpec.position is used for removeTextSpec changes, so only change now
            insertTextSpec.position = removeTextSpec.position;
        }

        return {
            opSpecsA:  insertTextSpecResult,
            opSpecsB:  removeTextSpecResult
        };
    }

    /**
     * @param {!ops.OpInsertText.Spec} insertTextSpec
     * @param {!ops.OpSetParagraphStyle.Spec} setParagraphStyleSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformInsertTextSetParagraphStyle(insertTextSpec, setParagraphStyleSpec) {
        if (setParagraphStyleSpec.position > insertTextSpec.position) {
            setParagraphStyleSpec.position += insertTextSpec.text.length;
        }

        return {
            opSpecsA:  [insertTextSpec],
            opSpecsB:  [setParagraphStyleSpec]
        };
    }

    /**
     * @param {!ops.OpInsertText.Spec} insertTextSpec
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformInsertTextSplitParagraph(insertTextSpec, splitParagraphSpec) {
        if (insertTextSpec.position < splitParagraphSpec.sourceParagraphPosition) {
            splitParagraphSpec.sourceParagraphPosition += insertTextSpec.text.length;
        }

        if (insertTextSpec.position <= splitParagraphSpec.position) {
            splitParagraphSpec.position += insertTextSpec.text.length;
        } else {
            insertTextSpec.position += 1;
        }

        return {
            opSpecsA:  [insertTextSpec],
            opSpecsB:  [splitParagraphSpec]
        };
    }

    /**
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpecA
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpecB
     * @param {!boolean} hasAPriority
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformMergeParagraphMergeParagraph(mergeParagraphSpecA, mergeParagraphSpecB, hasAPriority) {
        var specsForB = [mergeParagraphSpecA],
            specsForA = [mergeParagraphSpecB],
            priorityOp,
            styleParagraphFixup,
            moveCursorA,
            moveCursorB;

        if (mergeParagraphSpecA.destinationStartPosition === mergeParagraphSpecB.destinationStartPosition) {
            // Two merge commands for the same paragraph result in a noop to both sides, as the same
            // paragraph can only be merged once.
            specsForB = [];
            specsForA = [];
            // If the moveCursor flag is set, the cursor will still need to be adjusted to the right location
            if (mergeParagraphSpecA.moveCursor) {
                moveCursorA = /**@type{!ops.OpMoveCursor.Spec}*/({
                    optype: "MoveCursor",
                    memberid: mergeParagraphSpecA.memberid,
                    timestamp: mergeParagraphSpecA.timestamp,
                    position: mergeParagraphSpecA.sourceStartPosition - 1
                });
                specsForB.push(moveCursorA);
            }
            if (mergeParagraphSpecB.moveCursor) {
                moveCursorB = /**@type{!ops.OpMoveCursor.Spec}*/({
                    optype: "MoveCursor",
                    memberid: mergeParagraphSpecB.memberid,
                    timestamp: mergeParagraphSpecB.timestamp,
                    position: mergeParagraphSpecB.sourceStartPosition - 1
                });
                specsForA.push(moveCursorB);
            }

            // Determine which merge style wins
            priorityOp = hasAPriority ? mergeParagraphSpecA : mergeParagraphSpecB;
            styleParagraphFixup = /**@type{!ops.OpSetParagraphStyle.Spec}*/({
                optype: "SetParagraphStyle",
                memberid: priorityOp.memberid,
                timestamp: priorityOp.timestamp,
                position: priorityOp.destinationStartPosition,
                styleName: priorityOp.paragraphStyleName
            });
            if (hasAPriority) {
                specsForB.push(styleParagraphFixup);
            } else {
                specsForA.push(styleParagraphFixup);
            }
        } else if (mergeParagraphSpecB.sourceStartPosition === mergeParagraphSpecA.destinationStartPosition) {
            // Two consecutive paragraphs are being merged. E.g., A <- B <- C.
            // Use the styleName of the lowest destination paragraph to set the paragraph style (A <- B)
            mergeParagraphSpecA.destinationStartPosition = mergeParagraphSpecB.destinationStartPosition;
            mergeParagraphSpecA.sourceStartPosition -= 1;
            mergeParagraphSpecA.paragraphStyleName = mergeParagraphSpecB.paragraphStyleName;
        } else if (mergeParagraphSpecA.sourceStartPosition === mergeParagraphSpecB.destinationStartPosition) {
            // Two consecutive paragraphs are being merged. E.g., A <- B <- C.
            // Use the styleName of the lowest destination paragraph to set the paragraph style (A <- B)
            mergeParagraphSpecB.destinationStartPosition = mergeParagraphSpecA.destinationStartPosition;
            mergeParagraphSpecB.sourceStartPosition -= 1;
            mergeParagraphSpecB.paragraphStyleName = mergeParagraphSpecA.paragraphStyleName;
        } else if (mergeParagraphSpecA.destinationStartPosition < mergeParagraphSpecB.destinationStartPosition) {
            mergeParagraphSpecB.destinationStartPosition -= 1;
            mergeParagraphSpecB.sourceStartPosition -= 1;
        } else { // mergeParagraphSpecB.destinationStartPosition < mergeParagraphSpecA.destinationStartPosition
            mergeParagraphSpecA.destinationStartPosition -= 1;
            mergeParagraphSpecA.sourceStartPosition -= 1;
        }

        return {
            opSpecsA:  specsForB,
            opSpecsB:  specsForA
        };
    }

    /**
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpec
     * @param {!ops.OpMoveCursor.Spec} moveCursorSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformMergeParagraphMoveCursor(mergeParagraphSpec, moveCursorSpec) {
        var pointA = moveCursorSpec.position,
            pointB = moveCursorSpec.position + moveCursorSpec.length,
            start = Math.min(pointA, pointB),
            end = Math.max(pointA, pointB);

        if (start >= mergeParagraphSpec.sourceStartPosition) {
            start -= 1;
        }
        if (end >= mergeParagraphSpec.sourceStartPosition) {
            end -= 1;
        }

        // When updating the cursor spec, ensure the selection direction is preserved.
        // If the length was previously positive, it should remain positive.
        if (moveCursorSpec.length >= 0) {
            moveCursorSpec.position = start;
            moveCursorSpec.length = end - start;
        } else {
            moveCursorSpec.position = end;
            moveCursorSpec.length = start - end;
        }

        return {
            opSpecsA:  [mergeParagraphSpec],
            opSpecsB:  [moveCursorSpec]
        };
    }

    /**
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpec
     * @param {!ops.OpRemoveList.Spec} removeListSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformMergeParagraphRemoveList(mergeParagraphSpec, removeListSpec) {
        // adjust list start position only if the paragraph being merged is before the list start position
        if (mergeParagraphSpec.sourceStartPosition < removeListSpec.firstParagraphPosition) {
            removeListSpec.firstParagraphPosition -= 1;
        } else if (mergeParagraphSpec.sourceStartPosition === removeListSpec.firstParagraphPosition) {
            // TODO: unable to handle this currently as merge paragraph pulls paragraphs out of the list
            // One possible solution would be to add paragraph lengths to the merge paragraph spec
            // to allow this transform to know how many steps to move the anchor of the remove list op
            return null;
        }

        return {
            opSpecsA: [mergeParagraphSpec],
            opSpecsB: [removeListSpec]
        };
    }

    /**
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpec
     * @param {!ops.OpRemoveText.Spec} removeTextSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformMergeParagraphRemoveText(mergeParagraphSpec, removeTextSpec) {
        // RemoveText ops can't cross paragraph boundaries, so only the position needs to be checked
        if (removeTextSpec.position >= mergeParagraphSpec.sourceStartPosition) {
            removeTextSpec.position -= 1;
        } else {
            if (removeTextSpec.position < mergeParagraphSpec.destinationStartPosition) {
                mergeParagraphSpec.destinationStartPosition -= removeTextSpec.length;
            }
            if (removeTextSpec.position < mergeParagraphSpec.sourceStartPosition) {
                mergeParagraphSpec.sourceStartPosition -= removeTextSpec.length;
            }
        }

        return {
            opSpecsA:  [mergeParagraphSpec],
            opSpecsB:  [removeTextSpec]
        };
    }

    /**
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpec
     * @param {!ops.OpSetParagraphStyle.Spec} setParagraphStyleSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformMergeParagraphSetParagraphStyle(mergeParagraphSpec, setParagraphStyleSpec) {
        var opSpecsA = [mergeParagraphSpec],
            opSpecsB = [setParagraphStyleSpec];

        // SetParagraphStyle ops can't cross paragraph boundaries
        if (setParagraphStyleSpec.position > mergeParagraphSpec.sourceStartPosition) {
            // Paragraph beyond the ones region affected by the merge
            setParagraphStyleSpec.position -= 1;
        } else if (setParagraphStyleSpec.position === mergeParagraphSpec.destinationStartPosition
                    || setParagraphStyleSpec.position === mergeParagraphSpec.sourceStartPosition) {
            // Attempting to style a merging paragraph
            setParagraphStyleSpec.position = mergeParagraphSpec.destinationStartPosition;
            mergeParagraphSpec.paragraphStyleName = setParagraphStyleSpec.styleName;
        }

        return {
            opSpecsA:  opSpecsA,
            opSpecsB:  opSpecsB
        };
    }

    /**
     * @param {!ops.OpMergeParagraph.Spec} mergeParagraphSpec
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformMergeParagraphSplitParagraph(mergeParagraphSpec, splitParagraphSpec) {
        var styleSplitParagraph,
            moveCursorOp,
            opSpecsA = [mergeParagraphSpec],
            opSpecsB = [splitParagraphSpec];

        if (splitParagraphSpec.position < mergeParagraphSpec.destinationStartPosition) {
            // Split occurs before the merge destination
            // Splitting a paragraph inserts one step, moving the merge along
            mergeParagraphSpec.destinationStartPosition += 1;
            mergeParagraphSpec.sourceStartPosition += 1;
        } else if (splitParagraphSpec.position >= mergeParagraphSpec.destinationStartPosition
            && splitParagraphSpec.position < mergeParagraphSpec.sourceStartPosition) {
            // split occurs within the paragraphs being merged
            splitParagraphSpec.paragraphStyleName = mergeParagraphSpec.paragraphStyleName;
            styleSplitParagraph = /**@type{!ops.OpSetParagraphStyle.Spec}*/({
                optype: "SetParagraphStyle",
                memberid: mergeParagraphSpec.memberid,
                timestamp: mergeParagraphSpec.timestamp,
                position: mergeParagraphSpec.destinationStartPosition,
                styleName: mergeParagraphSpec.paragraphStyleName
            });
            opSpecsA.push(styleSplitParagraph);
            if (splitParagraphSpec.position === mergeParagraphSpec.sourceStartPosition - 1
                    && mergeParagraphSpec.moveCursor) {
                // OdtDocument.getTextNodeAtStep + Spec.moveCursor make it very difficult to control cursor placement
                // When a split + merge combines, there is a tricky situation because the split will leave other cursors
                // on the last step in the new paragraph.
                // When the merge is relocated to attach to the front of the newly inserted paragraph below, the cursor
                // will end up at the start of the new paragraph. Workaround this by manually setting the cursor back
                // to the appropriate location after the merge completes
                moveCursorOp = /**@type{!ops.OpMoveCursor.Spec}*/({
                    optype: "MoveCursor",
                    memberid: mergeParagraphSpec.memberid,
                    timestamp: mergeParagraphSpec.timestamp,
                    position: splitParagraphSpec.position,
                    length: 0
                });
                opSpecsA.push(moveCursorOp);
            }

            // SplitParagraph ops effectively create new paragraph boundaries. The user intent
            // is for the source paragraph to be joined to the END of the dest paragraph. If the
            // split occurs in the dest paragraph, the source should be joined to the newly created
            // paragraph instead
            mergeParagraphSpec.destinationStartPosition = splitParagraphSpec.position + 1;
            mergeParagraphSpec.sourceStartPosition += 1;
        } else if (splitParagraphSpec.position >= mergeParagraphSpec.sourceStartPosition) {
            // Split occurs after the merge source
            // Merging paragraphs remove one step
            splitParagraphSpec.position -= 1;
            splitParagraphSpec.sourceParagraphPosition -= 1;
        }

        return {
            opSpecsA:  opSpecsA,
            opSpecsB:  opSpecsB
        };
    }

    /**
     * @param {!ops.OpRemoveList.Spec} removeListSpecA
     * @param {!ops.OpRemoveList.Spec} removeListSpecB
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveListRemoveList(removeListSpecA, removeListSpecB) {
        var opSpecsA = [removeListSpecA],
            opSpecsB = [removeListSpecB];

        if (removeListSpecA.firstParagraphPosition === removeListSpecB.firstParagraphPosition) {
            opSpecsA = [];
            opSpecsB = [];
        }

        return {
            opSpecsA: opSpecsA,
            opSpecsB: opSpecsB
        };
    }

    /**
     * @param {!ops.OpRemoveList.Spec} removeListSpec
     * @param {!ops.OpRemoveText.Spec} removeTextSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveListRemoveText(removeListSpec, removeTextSpec) {
        // adjust list start position only if text is removed before the list start position
        if (removeTextSpec.position < removeListSpec.firstParagraphPosition) {
            removeListSpec.firstParagraphPosition -= removeTextSpec.length;
        }

        return {
            opSpecsA: [removeListSpec],
            opSpecsB: [removeTextSpec]
        };
    }

    /**
     * @param {!ops.OpRemoveList.Spec} removeListSpec
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveListSplitParagraph(removeListSpec, splitParagraphSpec) {
        // adjust list start position only if the paragraph being split is before the list start position
        if (splitParagraphSpec.sourceParagraphPosition < removeListSpec.firstParagraphPosition) {
            removeListSpec.firstParagraphPosition += 1;
        }

        return {
            opSpecsA: [removeListSpec],
            opSpecsB: [splitParagraphSpec]
        };
    }

    /**
     * @param {!ops.OpUpdateParagraphStyle.Spec} updateParagraphStyleSpecA
     * @param {!ops.OpUpdateParagraphStyle.Spec} updateParagraphStyleSpecB
     * @param {!boolean} hasAPriority
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformUpdateParagraphStyleUpdateParagraphStyle(updateParagraphStyleSpecA, updateParagraphStyleSpecB, hasAPriority) {
        var majorSpec, minorSpec,
            updateParagraphStyleSpecAResult = [updateParagraphStyleSpecA],
            updateParagraphStyleSpecBResult = [updateParagraphStyleSpecB];

        // same style updated by other op?
        if (updateParagraphStyleSpecA.styleName === updateParagraphStyleSpecB.styleName) {
            majorSpec = hasAPriority ? updateParagraphStyleSpecA : updateParagraphStyleSpecB;
            minorSpec = hasAPriority ? updateParagraphStyleSpecB : updateParagraphStyleSpecA;

            // any properties which are set by other update op need to be dropped
            dropOverruledAndUnneededProperties(minorSpec.setProperties,
                minorSpec.removedProperties, majorSpec.setProperties,
                majorSpec.removedProperties, 'style:paragraph-properties');
            dropOverruledAndUnneededProperties(minorSpec.setProperties,
                minorSpec.removedProperties, majorSpec.setProperties,
                majorSpec.removedProperties, 'style:text-properties');
            dropOverruledAndUnneededAttributes(minorSpec.setProperties || null,
                /**@type{{attributes: string}}*/(minorSpec.removedProperties) || null,
                majorSpec.setProperties || null,
                /**@type{{attributes: string}}*/(majorSpec.removedProperties) || null);

            // check if there are any changes left and the major op has not become a noop
            if (!(majorSpec.setProperties && hasProperties(majorSpec.setProperties)) &&
                    !(majorSpec.removedProperties && hasRemovedProperties(majorSpec.removedProperties))) {
                // set major spec to noop
                if (hasAPriority) {
                    updateParagraphStyleSpecAResult = [];
                } else {
                    updateParagraphStyleSpecBResult = [];
                }
            }
            // check if there are any changes left and the minor op has not become a noop
            if (!(minorSpec.setProperties && hasProperties(minorSpec.setProperties)) &&
                    !(minorSpec.removedProperties && hasRemovedProperties(minorSpec.removedProperties))) {
                // set minor spec to noop 
                if (hasAPriority) {
                    updateParagraphStyleSpecBResult = [];
                } else {
                    updateParagraphStyleSpecAResult = [];
                }
            }
        }

        return {
            opSpecsA:  updateParagraphStyleSpecAResult,
            opSpecsB:  updateParagraphStyleSpecBResult
        };
    }

    /**
     * @param {!ops.OpUpdateMetadata.Spec} updateMetadataSpecA
     * @param {!ops.OpUpdateMetadata.Spec} updateMetadataSpecB
     * @param {!boolean} hasAPriority
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformUpdateMetadataUpdateMetadata(updateMetadataSpecA, updateMetadataSpecB, hasAPriority) {
        var majorSpec, minorSpec,
            updateMetadataSpecAResult = [updateMetadataSpecA],
            updateMetadataSpecBResult = [updateMetadataSpecB];

        majorSpec = hasAPriority ? updateMetadataSpecA : updateMetadataSpecB;
        minorSpec = hasAPriority ? updateMetadataSpecB : updateMetadataSpecA;

        // any properties which are set by other update op need to be dropped
        dropOverruledAndUnneededAttributes(minorSpec.setProperties || null,
                            minorSpec.removedProperties || null,
                            majorSpec.setProperties || null,
                            majorSpec.removedProperties || null);

        // check if there are any changes left and the major op has not become a noop
        if (!(majorSpec.setProperties && hasProperties(majorSpec.setProperties)) &&
                !(majorSpec.removedProperties && hasRemovedProperties(majorSpec.removedProperties))) {
            // set major spec to noop
            if (hasAPriority) {
                updateMetadataSpecAResult = [];
            } else {
                updateMetadataSpecBResult = [];
            }
        }
        // check if there are any changes left and the minor op has not become a noop
        if (!(minorSpec.setProperties && hasProperties(minorSpec.setProperties)) &&
                !(minorSpec.removedProperties && hasRemovedProperties(minorSpec.removedProperties))) {
            // set minor spec to noop 
            if (hasAPriority) {
                updateMetadataSpecBResult = [];
            } else {
                updateMetadataSpecAResult = [];
            }
        }

        return {
            opSpecsA:  updateMetadataSpecAResult,
            opSpecsB:  updateMetadataSpecBResult
        };
    }

    /**
     * @param {!ops.OpSetParagraphStyle.Spec} setParagraphStyleSpecA
     * @param {!ops.OpSetParagraphStyle.Spec} setParagraphStyleSpecB
     * @param {!boolean} hasAPriority
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformSetParagraphStyleSetParagraphStyle(setParagraphStyleSpecA, setParagraphStyleSpecB, hasAPriority) {
        if (setParagraphStyleSpecA.position === setParagraphStyleSpecB.position) {
            if (hasAPriority) {
                setParagraphStyleSpecB.styleName = setParagraphStyleSpecA.styleName;
            } else {
                setParagraphStyleSpecA.styleName = setParagraphStyleSpecB.styleName;
            }
        }

        return {
            opSpecsA:  [setParagraphStyleSpecA],
            opSpecsB:  [setParagraphStyleSpecB]
        };
    }

    /**
     * @param {!ops.OpSetParagraphStyle.Spec} setParagraphStyleSpec
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformSetParagraphStyleSplitParagraph(setParagraphStyleSpec, splitParagraphSpec) {
        var opSpecsA = [setParagraphStyleSpec],
            opSpecsB = [splitParagraphSpec],
            setParagraphClone;

        if (setParagraphStyleSpec.position > splitParagraphSpec.position) {
            setParagraphStyleSpec.position += 1;
        } else if (setParagraphStyleSpec.position === splitParagraphSpec.sourceParagraphPosition) {
            // When a set paragraph style & split conflict, the set paragraph style always wins

            splitParagraphSpec.paragraphStyleName = setParagraphStyleSpec.styleName;
            // The new paragraph that resulted from the already executed split op should be styled with
            // the original paragraph style.
            setParagraphClone = cloneOpspec(setParagraphStyleSpec);
            // A split paragraph op introduces a new paragraph boundary just passed the point where the split occurs
            setParagraphClone.position = splitParagraphSpec.position + 1;
            opSpecsA.push(setParagraphClone);
        }

        return {
            opSpecsA:  opSpecsA,
            opSpecsB:  opSpecsB
        };
    }

    /**
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpecA
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpecB
     * @param {!boolean} hasAPriority
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformSplitParagraphSplitParagraph(splitParagraphSpecA, splitParagraphSpecB, hasAPriority) {
        var specABeforeB,
            specBBeforeA;

        if (splitParagraphSpecA.position < splitParagraphSpecB.position) {
            specABeforeB =  true;
        } else if (splitParagraphSpecB.position < splitParagraphSpecA.position) {
            specBBeforeA = true;
        } else if (splitParagraphSpecA.position === splitParagraphSpecB.position) {
            if (hasAPriority) {
                specABeforeB =  true;
            } else {
                specBBeforeA = true;
            }
        }

        if (specABeforeB) {
            splitParagraphSpecB.position += 1;
            if (splitParagraphSpecA.position < splitParagraphSpecB.sourceParagraphPosition) {
                splitParagraphSpecB.sourceParagraphPosition += 1;
            } else {
                // Split occurs between specB's split position & it's source paragraph position
                // This means specA introduces a NEW paragraph boundary
                splitParagraphSpecB.sourceParagraphPosition = splitParagraphSpecA.position + 1;
            }
        } else if (specBBeforeA) {
            splitParagraphSpecA.position += 1;
            if (splitParagraphSpecB.position < splitParagraphSpecB.sourceParagraphPosition) {
                splitParagraphSpecA.sourceParagraphPosition += 1;
            } else {
                // Split occurs between specA's split position & it's source paragraph position
                // This means specB introduces a NEW paragraph boundary
                splitParagraphSpecA.sourceParagraphPosition = splitParagraphSpecB.position + 1;
            }
        }

        return {
            opSpecsA:  [splitParagraphSpecA],
            opSpecsB:  [splitParagraphSpecB]
        };
    }

    /**
     * @param {!ops.OpMoveCursor.Spec} moveCursorSpec
     * @param {!ops.OpRemoveCursor.Spec} removeCursorSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformMoveCursorRemoveCursor(moveCursorSpec, removeCursorSpec) {
        var isSameCursorRemoved = (moveCursorSpec.memberid === removeCursorSpec.memberid);

        return {
            opSpecsA:  isSameCursorRemoved ? [] : [moveCursorSpec],
            opSpecsB:  [removeCursorSpec]
        };
    }

    /**
     * @param {!ops.OpMoveCursor.Spec} moveCursorSpec
     * @param {!ops.OpRemoveText.Spec} removeTextSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformMoveCursorRemoveText(moveCursorSpec, removeTextSpec) {
        var isMoveCursorSpecRangeInverted = invertMoveCursorSpecRangeOnNegativeLength(moveCursorSpec),
            moveCursorSpecEnd = moveCursorSpec.position + moveCursorSpec.length,
            removeTextSpecEnd = removeTextSpec.position + removeTextSpec.length;

        // transform moveCursorSpec
        // removed positions by object up to move cursor position?
        if (removeTextSpecEnd <= moveCursorSpec.position) {
            // adapt by removed position
            moveCursorSpec.position -= removeTextSpec.length;
        // overlapping?
        } else if (removeTextSpec.position < moveCursorSpecEnd) {
            // still to select range starting at cursor position?
            if (moveCursorSpec.position < removeTextSpec.position) {
                // still to select range ending at selection?
                if (removeTextSpecEnd < moveCursorSpecEnd) {
                    moveCursorSpec.length -= removeTextSpec.length;
                } else {
                    moveCursorSpec.length = removeTextSpec.position - moveCursorSpec.position;
                }
            // remove overlapping section
            } else {
                // fall at start of removed section
                moveCursorSpec.position = removeTextSpec.position;
                // still to select range at selection end?
                if (removeTextSpecEnd < moveCursorSpecEnd) {
                    moveCursorSpec.length = moveCursorSpecEnd - removeTextSpecEnd;
                } else {
                    // completely overlapped by other, so selection gets void
                    moveCursorSpec.length = 0;
                }
            }
        }

        if (isMoveCursorSpecRangeInverted) {
            invertMoveCursorSpecRange(moveCursorSpec);
        }

        return {
            opSpecsA:  [moveCursorSpec],
            opSpecsB:  [removeTextSpec]
        };
    }

    /**
     * @param {!ops.OpMoveCursor.Spec} moveCursorSpec
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformMoveCursorSplitParagraph(moveCursorSpec, splitParagraphSpec) {
        var isMoveCursorSpecRangeInverted = invertMoveCursorSpecRangeOnNegativeLength(moveCursorSpec);

        // transform moveCursorSpec
        if (splitParagraphSpec.position < moveCursorSpec.position) {
            moveCursorSpec.position += 1;
        } else if (splitParagraphSpec.position < moveCursorSpec.position + moveCursorSpec.length) {
            moveCursorSpec.length += 1;
        }

        if (isMoveCursorSpecRangeInverted) {
            invertMoveCursorSpecRange(moveCursorSpec);
        }

        return {
            opSpecsA:  [moveCursorSpec],
            opSpecsB:  [splitParagraphSpec]
        };
    }

    /**
     * @param {!ops.OpRemoveCursor.Spec} removeCursorSpecA
     * @param {!ops.OpRemoveCursor.Spec} removeCursorSpecB
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveCursorRemoveCursor(removeCursorSpecA, removeCursorSpecB) {
        var isSameMemberid = (removeCursorSpecA.memberid === removeCursorSpecB.memberid);

        // if both are removing the same cursor, their transformed counter-ops become noops
        return {
            opSpecsA:  isSameMemberid ? [] : [removeCursorSpecA],
            opSpecsB:  isSameMemberid ? [] : [removeCursorSpecB]
        };
    }

    /**
     * @param {!ops.OpRemoveStyle.Spec} removeStyleSpecA
     * @param {!ops.OpRemoveStyle.Spec} removeStyleSpecB
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveStyleRemoveStyle(removeStyleSpecA, removeStyleSpecB) {
        var isSameStyle = (removeStyleSpecA.styleName === removeStyleSpecB.styleName && removeStyleSpecA.styleFamily === removeStyleSpecB.styleFamily);

        // if both are removing the same style, their transformed counter-ops become noops
        return {
            opSpecsA:  isSameStyle ? [] : [removeStyleSpecA],
            opSpecsB:  isSameStyle ? [] : [removeStyleSpecB]
        };
    }

    /**
     * @param {!ops.OpRemoveStyle.Spec} removeStyleSpec
     * @param {!ops.OpSetParagraphStyle.Spec} setParagraphStyleSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveStyleSetParagraphStyle(removeStyleSpec, setParagraphStyleSpec) {
        var helperOpspec,
            removeStyleSpecResult = [removeStyleSpec],
            setParagraphStyleSpecResult = [setParagraphStyleSpec];

        if (removeStyleSpec.styleFamily === "paragraph" && removeStyleSpec.styleName === setParagraphStyleSpec.styleName) {
            // transform removeStyleSpec
            // just create a setstyle op preceding to us which removes any set style from the paragraph
            helperOpspec = {
                optype: "SetParagraphStyle",
                memberid: removeStyleSpec.memberid,
                timestamp: removeStyleSpec.timestamp,
                position: setParagraphStyleSpec.position,
                styleName: ""
            };
            removeStyleSpecResult.unshift(helperOpspec);

            // transform setParagraphStyleSpec
            // instead of setting now remove any existing style from the paragraph
            setParagraphStyleSpec.styleName = "";
        }

        return {
            opSpecsA:  removeStyleSpecResult,
            opSpecsB:  setParagraphStyleSpecResult
        };
    }

    /**
     * @param {!ops.OpRemoveStyle.Spec} removeStyleSpec
     * @param {!ops.OpUpdateParagraphStyle.Spec} updateParagraphStyleSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveStyleUpdateParagraphStyle(removeStyleSpec, updateParagraphStyleSpec) {
        var setAttributes, helperOpspec,
            removeStyleSpecResult = [removeStyleSpec],
            updateParagraphStyleSpecResult = [updateParagraphStyleSpec];

        if (removeStyleSpec.styleFamily === "paragraph") {
            // transform removeStyleSpec
            // style brought into use by other op?
            setAttributes = getStyleReferencingAttributes(updateParagraphStyleSpec.setProperties, removeStyleSpec.styleName);
            if (setAttributes.length > 0) {
                // just create a updateparagraph style op preceding to us which removes any set style from the paragraph
                helperOpspec = {
                    optype: "UpdateParagraphStyle",
                    memberid: removeStyleSpec.memberid,
                    timestamp: removeStyleSpec.timestamp,
                    styleName: updateParagraphStyleSpec.styleName,
                    removedProperties: { attributes: setAttributes.join(',') }
                };
                removeStyleSpecResult.unshift(helperOpspec);
            }

            // transform updateParagraphStyleSpec
            // target style to update deleted by removeStyle?
            if (removeStyleSpec.styleName === updateParagraphStyleSpec.styleName) {
                // don't touch the dead
                updateParagraphStyleSpecResult = [];
            } else {
                // otherwise drop any attributes referencing the style deleted
                dropStyleReferencingAttributes(updateParagraphStyleSpec.setProperties, removeStyleSpec.styleName);
            }
        }

        return {
            opSpecsA:  removeStyleSpecResult,
            opSpecsB:  updateParagraphStyleSpecResult
        };
    }

    /**
     * @param {!ops.OpRemoveText.Spec} removeTextSpecA
     * @param {!ops.OpRemoveText.Spec} removeTextSpecB
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveTextRemoveText(removeTextSpecA, removeTextSpecB) {
        var removeTextSpecAEnd = removeTextSpecA.position + removeTextSpecA.length,
            removeTextSpecBEnd = removeTextSpecB.position + removeTextSpecB.length,
            removeTextSpecAResult = [removeTextSpecA],
            removeTextSpecBResult = [removeTextSpecB];

        // B removed positions by object up to As start position?
        if (removeTextSpecBEnd <= removeTextSpecA.position) {
            // adapt A by removed position
            removeTextSpecA.position -= removeTextSpecB.length;
        // A removed positions by object up to Bs start position?
        } else if (removeTextSpecAEnd <= removeTextSpecB.position) {
            // adapt B by removed position
            removeTextSpecB.position -= removeTextSpecA.length;
        // overlapping?
        // (removeTextSpecBEnd <= removeTextSpecA.position above catches non-overlapping from this condition)
        } else if (removeTextSpecB.position < removeTextSpecAEnd) {
            // A removes in front of B?
            if (removeTextSpecA.position < removeTextSpecB.position) {
                // A still to remove range at its end?
                if (removeTextSpecBEnd < removeTextSpecAEnd) {
                    removeTextSpecA.length = removeTextSpecA.length - removeTextSpecB.length;
                } else {
                    removeTextSpecA.length = removeTextSpecB.position - removeTextSpecA.position;
                }
                // B still to remove range at its end?
                if (removeTextSpecAEnd < removeTextSpecBEnd) {
                    removeTextSpecB.position = removeTextSpecA.position;
                    removeTextSpecB.length = removeTextSpecBEnd - removeTextSpecAEnd;
                } else {
                    // B completely overlapped by other, so it becomes a noop
                    removeTextSpecBResult = [];
                }
            // B removes in front of or starting at same like A
            } else {
                // B still to remove range at its end?
                if (removeTextSpecAEnd < removeTextSpecBEnd) {
                    removeTextSpecB.length = removeTextSpecB.length - removeTextSpecA.length;
                } else {
                    // B still to remove range at its start?
                    if (removeTextSpecB.position < removeTextSpecA.position) {
                        removeTextSpecB.length = removeTextSpecA.position - removeTextSpecB.position;
                    } else {
                        // B completely overlapped by other, so it becomes a noop
                        removeTextSpecBResult = [];
                    }
                }
                // A still to remove range at its end?
                if (removeTextSpecBEnd < removeTextSpecAEnd) {
                    removeTextSpecA.position = removeTextSpecB.position;
                    removeTextSpecA.length = removeTextSpecAEnd - removeTextSpecBEnd;
                } else {
                    // A completely overlapped by other, so it becomes a noop
                    removeTextSpecAResult = [];
                }
            }
        }
        return {
            opSpecsA:  removeTextSpecAResult,
            opSpecsB:  removeTextSpecBResult
        };
    }

    /**
     * @param {!ops.OpRemoveText.Spec} removeTextSpec
     * @param {!ops.OpSetParagraphStyle.Spec} setParagraphStyleSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveTextSetParagraphStyle(removeTextSpec, setParagraphStyleSpec) {
        // Removal is done entirely in some preceding paragraph
        if (removeTextSpec.position < setParagraphStyleSpec.position) {
            setParagraphStyleSpec.position -= removeTextSpec.length;
        }

        return {
            opSpecsA:  [removeTextSpec],
            opSpecsB:  [setParagraphStyleSpec]
        };
    }

    /**
     * @param {!ops.OpRemoveText.Spec} removeTextSpec
     * @param {!ops.OpSplitParagraph.Spec} splitParagraphSpec
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function transformRemoveTextSplitParagraph(removeTextSpec, splitParagraphSpec) {
        var removeTextSpecEnd = removeTextSpec.position + removeTextSpec.length,
            helperOpspec,
            removeTextSpecResult = [removeTextSpec],
            splitParagraphSpecResult = [splitParagraphSpec];

        // adapt removeTextSpec
        if (splitParagraphSpec.position <= removeTextSpec.position) {
            removeTextSpec.position += 1;
        } else if (splitParagraphSpec.position < removeTextSpecEnd) {
            // we have to split the removal into two ops, before and after the insertion
            removeTextSpec.length = splitParagraphSpec.position - removeTextSpec.position;
            helperOpspec = {
                optype: "RemoveText",
                memberid: removeTextSpec.memberid,
                timestamp: removeTextSpec.timestamp,
                position: splitParagraphSpec.position + 1,
                length: removeTextSpecEnd - splitParagraphSpec.position
            };
            removeTextSpecResult.unshift(helperOpspec); // helperOp first, so its position is not affected by the real op
        }

        // adapt splitParagraphSpec
        if (removeTextSpec.position + removeTextSpec.length <= splitParagraphSpec.position) {
            splitParagraphSpec.position -= removeTextSpec.length;
        } else if (removeTextSpec.position < splitParagraphSpec.position) {
            splitParagraphSpec.position = removeTextSpec.position;
        }

        if (removeTextSpec.position + removeTextSpec.length < splitParagraphSpec.sourceParagraphPosition) {
            // Removed text is before the source paragraph
            splitParagraphSpec.sourceParagraphPosition -= removeTextSpec.length;
        }
        // removeText ops can't cross over paragraph boundaries, so don't check this case

        return {
            opSpecsA:  removeTextSpecResult,
            opSpecsB:  splitParagraphSpecResult
        };
    }

    /**
     * Does an OT on the two passed opspecs, where they are not modified at all,
     * and so simply returns them in the result arrays.
     * @param {!Object} opSpecA
     * @param {!Object} opSpecB
     * @return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     */
    function passUnchanged(opSpecA, opSpecB) {
        return {
            opSpecsA:  [opSpecA],
            opSpecsB:  [opSpecB]
        };
    }

    /**
     * This is the lower-left half of the sparse NxN matrix with all the
     * transformation methods on the possible pairs of ops. As the matrix
     * is symmetric, only that half is used. So the user of this matrix has
     * to ensure the proper order of opspecs on lookup and on calling the
     * picked transformation method.
     *
     * Each transformation method takes the two opspecs (and optionally
     * a flag if the first has a higher priority, in case of tie breaking
     * having to be done). The method returns a record with the two
     * resulting arrays of ops, with key names "opSpecsA" and "opSpecsB".
     * Those arrays could have more than the initial respective opspec
     * inside, in case some additional helper opspecs are needed, or be
     * empty if the opspec turned into a no-op in the transformation.
     * If a transformation is not doable, the method returns "null".
     *
     * Some operations are added onto the stack only by the master session,
     * for example AddMember, RemoveMember, and UpdateMember. These therefore need
     * not be transformed against each other, since the master session is the
     * only originator of these ops. Therefore, their pairing entries in the
     * matrix are missing. They do however require a passUnchanged entry
     * with the other ops.
     *
     * Here the CC signature of each transformation method:
     * param {!Object} opspecA
     * param {!Object} opspecB
     * (param {!boolean} hasAPriorityOverB)  can be left out
     * return {?{opSpecsA:!Array.<!Object>, opSpecsB:!Array.<!Object>}}
     *
     * Empty cells in this matrix mean there is no such transformation
     * possible, and should be handled as if the method returns "null".
     */
    transformations = {
        "AddCursor": {
            "AddCursor":            passUnchanged,
            "AddList":              passUnchanged,
            "AddListStyle":         passUnchanged,
            "AddMember":            passUnchanged,
            "AddStyle":             passUnchanged,
            "ApplyDirectStyling":   passUnchanged,
            "InsertText":           passUnchanged,
            "MergeParagraph":       passUnchanged,
            "MoveCursor":           passUnchanged,
            "RemoveCursor":         passUnchanged,
            "RemoveList":           passUnchanged,
            "RemoveMember":         passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           passUnchanged,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       passUnchanged,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "AddList": {
            "AddList":              transformAddListAddList,
            "AddListStyle":         passUnchanged,
            "AddMember":            passUnchanged,
            "AddStyle":             passUnchanged,
            "ApplyDirectStyling":   passUnchanged,
            "InsertText":           transformAddListInsertText,
            "MergeParagraph":       transformAddListMergeParagraph,
            "MoveCursor":           passUnchanged,
            "RemoveCursor":         passUnchanged,
            "RemoveList":           transformAddListRemoveList,
            "RemoveMember":         passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           transformAddListRemoveText,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       transformAddListSplitParagraph,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "AddListStyle": {
            "AddListStyle":         transformAddListStyleAddListStyle,
            "AddMember":            passUnchanged,
            "AddStyle":             passUnchanged,
            "ApplyDirectStyling":   passUnchanged,
            "InsertText":           passUnchanged,
            "MergeParagraph":       passUnchanged,
            "MoveCursor":           passUnchanged,
            "RemoveCursor":         passUnchanged,
            "RemoveList":           passUnchanged,
            "RemoveMember":         passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           passUnchanged,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       passUnchanged,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "AddMember": {
            "AddStyle":             passUnchanged,
            "ApplyDirectStyling":   passUnchanged,
            "InsertText":           passUnchanged,
            "MergeParagraph":       passUnchanged,
            "MoveCursor":           passUnchanged,
            "RemoveCursor":         passUnchanged,
            "RemoveList":           passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           passUnchanged,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "AddStyle": {
            "AddStyle":             passUnchanged,
            "ApplyDirectStyling":   passUnchanged,
            "InsertText":           passUnchanged,
            "MergeParagraph":       passUnchanged,
            "MoveCursor":           passUnchanged,
            "RemoveCursor":         passUnchanged,
            "RemoveList":           passUnchanged,
            "RemoveMember":         passUnchanged,
            "RemoveStyle":          transformAddStyleRemoveStyle,
            "RemoveText":           passUnchanged,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       passUnchanged,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "ApplyDirectStyling": {
            "ApplyDirectStyling":   transformApplyDirectStylingApplyDirectStyling,
            "InsertText":           transformApplyDirectStylingInsertText,
            "MergeParagraph":       transformApplyDirectStylingMergeParagraph,
            "MoveCursor":           passUnchanged,
            "RemoveCursor":         passUnchanged,
            "RemoveList":           passUnchanged,
            "RemoveMember":         passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           transformApplyDirectStylingRemoveText,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       transformApplyDirectStylingSplitParagraph,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "InsertText": {
            "InsertText":           transformInsertTextInsertText,
            "MergeParagraph":       transformInsertTextMergeParagraph,
            "MoveCursor":           transformInsertTextMoveCursor,
            "RemoveCursor":         passUnchanged,
            "RemoveList":           transformInsertTextRemoveList,
            "RemoveMember":         passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           transformInsertTextRemoveText,
            "SetParagraphStyle":    transformInsertTextSetParagraphStyle,
            "SplitParagraph":       transformInsertTextSplitParagraph,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "MergeParagraph": {
            "MergeParagraph":       transformMergeParagraphMergeParagraph,
            "MoveCursor":           transformMergeParagraphMoveCursor,
            "RemoveCursor":         passUnchanged,
            "RemoveList":           transformMergeParagraphRemoveList,
            "RemoveMember":         passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           transformMergeParagraphRemoveText,
            "SetParagraphStyle":    transformMergeParagraphSetParagraphStyle,
            "SplitParagraph":       transformMergeParagraphSplitParagraph,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "MoveCursor": {
            "MoveCursor":           passUnchanged,
            "RemoveCursor":         transformMoveCursorRemoveCursor,
            "RemoveList":           passUnchanged,
            "RemoveMember":         passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           transformMoveCursorRemoveText,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       transformMoveCursorSplitParagraph,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "RemoveCursor": {
            "RemoveCursor":         transformRemoveCursorRemoveCursor,
            "RemoveMember":         passUnchanged,
            "RemoveList":           passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           passUnchanged,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       passUnchanged,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "RemoveList": {
            "RemoveList":           transformRemoveListRemoveList,
            "RemoveMember":         passUnchanged,
            "RemoveStyle":          passUnchanged,
            "RemoveText":           transformRemoveListRemoveText,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       transformRemoveListSplitParagraph,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "RemoveMember": {
            "RemoveStyle":          passUnchanged,
            "RemoveText":           passUnchanged,
            "SetParagraphStyle":    passUnchanged,
            "SplitParagraph":       passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "RemoveStyle": {
            "RemoveStyle":          transformRemoveStyleRemoveStyle,
            "RemoveText":           passUnchanged,
            "SetParagraphStyle":    transformRemoveStyleSetParagraphStyle,
            "SplitParagraph":       passUnchanged,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": transformRemoveStyleUpdateParagraphStyle
        },
        "RemoveText": {
            "RemoveText":           transformRemoveTextRemoveText,
            "SetParagraphStyle":    transformRemoveTextSetParagraphStyle,
            "SplitParagraph":       transformRemoveTextSplitParagraph,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "SetParagraphStyle": {
            "SetParagraphStyle":    transformSetParagraphStyleSetParagraphStyle,
            "SplitParagraph":       transformSetParagraphStyleSplitParagraph,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "SplitParagraph": {
            "SplitParagraph":       transformSplitParagraphSplitParagraph,
            "UpdateMember":         passUnchanged,
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "UpdateMember": {
            "UpdateMetadata":       passUnchanged,
            "UpdateParagraphStyle": passUnchanged
        },
        "UpdateMetadata": {
            "UpdateMetadata":       transformUpdateMetadataUpdateMetadata,
            "UpdateParagraphStyle": passUnchanged
        },
        "UpdateParagraphStyle": {
            "UpdateParagraphStyle": transformUpdateParagraphStyleUpdateParagraphStyle
        }
    };

    this.passUnchanged = passUnchanged;

    /**
     * @param {!Object.<!string,!Object.<!string,!Function>>}  moreTransformations
     * @return {undefined}
     */
    this.extendTransformations = function (moreTransformations) {
        Object.keys(moreTransformations).forEach(function (optypeA) {
            var moreTransformationsOptypeAMap = moreTransformations[optypeA],
                /**@type{!Object.<string,!Function>}*/
                optypeAMap,
                isExtendingOptypeAMap = transformations.hasOwnProperty(optypeA);

            runtime.log((isExtendingOptypeAMap ? "Extending" : "Adding") + " map for optypeA: " + optypeA);
            if (!isExtendingOptypeAMap) {
                transformations[optypeA] = {};
            }
            optypeAMap = transformations[optypeA];

            Object.keys(moreTransformationsOptypeAMap).forEach(function (optypeB) {
                var isOverwritingOptypeBEntry = optypeAMap.hasOwnProperty(optypeB);
                runtime.assert(optypeA <= optypeB, "Wrong order:" + optypeA + ", " + optypeB);
                runtime.log("  " + (isOverwritingOptypeBEntry ? "Overwriting" : "Adding") + " entry for optypeB: " + optypeB);
                optypeAMap[optypeB] = moreTransformationsOptypeAMap[optypeB];
            });
        });
    };

    /**
     * @param {!{optype:string}} opSpecA op with lower priority in case of tie breaking
     * @param {!{optype:string}} opSpecB op with higher priority in case of tie breaking
     * @return {?{opSpecsA:!Array.<!{optype:string}>,
     *            opSpecsB:!Array.<!{optype:string}>}}
     */
    this.transformOpspecVsOpspec = function (opSpecA, opSpecB) {
        var isOptypeAAlphaNumericSmaller = (opSpecA.optype <= opSpecB.optype),
            helper, transformationFunctionMap, transformationFunction, result;

runtime.log("Crosstransforming:");
runtime.log(runtime.toJson(opSpecA));
runtime.log(runtime.toJson(opSpecB));

        // switch order if needed, to match the mirrored part of the matrix
        if (!isOptypeAAlphaNumericSmaller) {
            helper = opSpecA;
            opSpecA = opSpecB;
            opSpecB = helper;
        }
        // look up transformation method
        transformationFunctionMap = transformations[opSpecA.optype];
        transformationFunction = transformationFunctionMap && transformationFunctionMap[opSpecB.optype];

        // transform
        if (transformationFunction) {
            result = transformationFunction(opSpecA, opSpecB, !isOptypeAAlphaNumericSmaller);
            if (!isOptypeAAlphaNumericSmaller && result !== null) {
                // switch result back
                result = {
                    opSpecsA:  result.opSpecsB,
                    opSpecsB:  result.opSpecsA
                };
            }
        } else {
            result = null;
        }
runtime.log("result:");
if (result) {
runtime.log(runtime.toJson(result.opSpecsA));
runtime.log(runtime.toJson(result.opSpecsB));
} else {
runtime.log("null");
}
        return result;
    };
};
