# List Editing

At its most basic level this list editing feature is about manipulating `text:list` elements in a document. These elements are defined here in the ODF standard http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#__RefHeading__1415148_253892949

Possible elements of a list:
```xml
<text:list text:continue-list="" text:continue-numbering="" text:style-name="" xml:id="">
<text:list-header xml:id="">
  <text:h/>
  <text:list/>
  <text:number/>
  <text:p/>
  <text:soft-page-break/>
</text:list-header>
<text:list-item  text:start-value="" text:style-override="" xml:id="">
  <text:h/>
  <text:list/>
  <text:number/>
  <text:p/>
  <text:soft-page-break/>
</text:list-item>
</text:list>
```
Possible elements of a list style:
```xml
<text:list-style  style:display-name="" style:name="" text:consecutive-numbering="">
  <text:list-level-style-bullet/>
  <text:list-level-style-image/>
  <text:list-level-style-number/>
</text:list-style>
```

## Problem/Goal

This section will define what it is we are trying to solve by implementing list editing and what information needs to be considered for the design of the operations that make list editing changes in the document.

### Creating a list from non-list paragraphs
This could be a new list in the document or if created from paragraphs that occur directly after an existing list in the document then this new list is merged into the previous list if their styles match. Any existing list items that are part of the selection are also merged into the new list.

### Turn list items back into non-list paragraphs
If the selection covers an entire top level list then that whole list is removed. If the selection only covers a subset of a top level list then that list will need to be split.

### Inserting text to create list items
Inserting a line break and then additional text anywhere in an existing list causes a new list item to be created. If there was text after the line break then this becomes a part of the new list item which in essence splits the list item. This is already implemented by WebODF.

Inserting two line breaks in other editors causes a list to be terminated and any further text inserted at that point is part of a non-list paragraph. This has not been implemented.

### Removing list items by deleting text
Removing all the text from a list item leaves behind a list item containing an empty paragraph. Removing the line break at the start of a list item merges it into the previous list item much like normal paragraph editing. These actions are already implemented by WebODF.

Removing the empty paragraph in a list item causes the list item to be deleted and the top level list to be split at that point. This has not been implemented.

### Change the style of a list
In a selection that contains existing list items this changes the `text:list-style` used for the list items. If this is a partial selection of a top level list then the list will be split. Any non-list paragraphs will be merged into the modified list.

### Promote/Demote a list item
Since lists can be hierarchical we can move list items up or down a level in the hierarchy. In most editors other than LibreOffice this only works within a single top level list. LibreOffice differs in that it allows shifting the level of list items across multiple lists.

### Insert multiple paragraphs into a single list item
This is usually done by the shortcut Shift-Enter which creates a new paragraph enclosed by the list item of the previous paragraph.

### Changing a list item to a list header
This is supported in LibreOffice but doesn't exist for other editors. A list header is a list item that does not have any kind of list label.

### Continuing the numbering of the previous list in the document
The `text:continue-numbering` attribute specifies whether to continue the numbering of a top level list that directly precedes it in the document. The `text:continue-id` attribute specifies the `xml:id` of some previous list to continue in the document.

### Restart list numbering
In numbered lists the `text:start-value` attribute on a list item specifies the value the numbering should start at. This is generally used to restart the list numbering at the number 1.

### General concerns
The current WebODF addressing system deals with text positions and `text:list` elements don't add extra walk-able steps to the document. This means that we can only handle lists based on the paragraphs they contain. This is ok as a top level list that does not contain a paragraph can be considered an invalid construct. However in a nested list structure some `text:list` elements may not have any paragraph elements directly contained by their child list items. This can be seen below.

```xml
<text:list>
    <text:list-item>
        <text:p>Level 1</text:p>
        <text:list>
            <text:list-item>
                <text:list>
                    <text:list-item>
                        <text:p>Level 3</text:p>
                    </text:list-item>
                </text:list>
            </text:list-item>
        </text:list>
    </text:list-item>
</text:list>
```

In this example the second level `text:list` element has no paragraph so it can't be identified directly with a step co-ordinate. This limits us to using such a co-ordinate to identify the top level list in the document.

There are other ways to identify a list such as using an `xml:id` attribute but this is not useful positional information for operations or op transforms.

As mentioned already adding a list to the document doesn't add more content and also does not reorder or shift paragraphs around. This is a useful property and needs to be preserved especially for lists inside other elements such as tables and floating frames.

## Operations
The design for these operations was done with the recommendations from this [document](https://github.com/kogmbh/WebODF/blob/master/webodf/README_operationaltransforms.md) in mind.
Following other operations that deal with paragraphs such as OpMergeParagraph all step positions that identify paragraph positions must be the first step in the paragraph. A further extension of this concept is that a list in a document will be identified by the first step in the first paragraph of the list.

### OpAddList
This operation takes a range of paragraphs and converts them into a list. This will create a new top level list at the point of the first paragraph in the range. Each paragraph in the range will become a list item in the new list. The op should reject any range of paragraphs that do not have the same parent. This is to prevent document contents changing order. The new list should have an `xml:id` but this is not a part of this op.

#### Spec
* startParagraphPosition
* endParagraphPosition
* styleName - optional

### OpRemoveList
This operation takes the position of a top level list and converts all the list items back to non-list paragraphs. This will not handle dealing with any complications arising from continued list numbering or a deleted `xml:id`.

#### Spec
* firstParagraphPosition
* lastParagraphPosition - this may only be needed to assist OT by defining list bounds

### OpSplitList
This operation takes the position of a top level list and also a paragraph position to split the list at. This paragraph becomes the new first paragraph of the split list. Splitting the list does not affect the structure of hierarchical lists. Splitting a list clones the attributes on the top level list into the new list created as part of the split.

#### Spec
* sourceStartPosition
* splitPosition

### OpMergeList
This operation is similar to OpMergeParagraph. It takes two adjacent top level lists in the document and merges them into one list. Lists that are not adjacent can not be merged. The list specified by the sourceStartPosition will be merged into the list identified by destinationStartPosition. Lists can't be merged in the other direction. Merging a list does not affect the structure of hierarchical lists. Merging a list is similar to removing a list but any continued list or `xml:id` concerns are not handled by this OP.

#### Spec
* sourceStartPosition
* destinationStartPosition

### OpSetListProperties
This operation sets the properties as attributes on the top level list element identified by firstParagraphPosition. This can be used to set things like the `xml:id` or the `text:continue-id` on a list.

#### Spec
* firstParagraphPosition
* listProperties

### OpPromoteListItems
This operation takes a range of paragraphs which are part of a list to promote to a higher list level in the hierarchy. This means that any list item at list level 2 is now at list level 1. All paragraphs in the range must be part of the list identified by listPosition. All paragraphs in the range must be able to be promoted to the next list level. This means that any range with paragraphs already at list level 1 cannot be promoted further.

#### Spec
* listPosition
* startParagraphPosition
* endParagraphPosition

### OpDemoteListItems
This operation takes a range of paragraphs which are part of a list to demote to a lower list level in the hierarchy. This means that any list item at list level 2 is now at list level 3. All paragraphs in the range must be part of the list identified by listPosition. All paragraphs in the range must be able to be demoted to the next list level. This means that any range with paragraphs already at list level 10 cannot be demoted further.

#### Spec
* listPosition
* startParagraphPosition
* endParagraphPosition

## Scenarios
This section aims to provide some examples as to how the proposed operations solve some of the list editing actions identified earlier.

### Adding list items
The most basic action is converting a set of paragraphs so that they become a list. This is achieved by using OpAddList only. A more interesting scenario is when the selected paragraphs are already part of a list as illustrated below:

```xml
<text:p>Test</text:p>
<text:p>Test</text:p>
<text:list text:style-name="styleA">
    <text:list-item>
        <text:p>Level 1</text:p>
        <text:list>
            <text:list-item>
                <text:p>Level 2</text:p>
                <text:list>
                    <text:list-item>
                        <text:p>Level 3</text:p>
                    </text:list-item>
                </text:list>
            </text:list-item>
        </text:list>
    </text:list-item>
</text:list>
```

Assuming a selection covering the first two paragraphs and the first two list items being converted into a new list with the style "styleB" the desired result is as follows:

```xml
<text:list text:style-name="styleB">
    <text:list-item>
        <text:p>Test</text:p>
    </text:list-item>
    <text:list-item>
        <text:p>Test</text:p>
    </text:list-item>
    <text:list-item>
        <text:p>Level 1</text:p>
        <text:list>
            <text:list-item>
                <text:p>Level 2</text:p>
            </text:list-item>
        </text:list>
    </text:list-item>
</text:list>
<text:list text:style-name="styleA">
    <text:list-item>
        <text:list>
            <text:list-item>
                <text:list>
                    <text:list-item>
                        <text:p>Level 3</text:p>
                    </text:list-item>
                </text:list>
            </text:list-item>
        </text:list>
    </text:list-item>
</text:list>
```

The sequence of operations required for this is to firstly do an OpAddList on the non-list paragraphs to create a new list with the style name "styleB". Since the selection then intersects with existing items we must then split them out into their own top level list so we can work with them. This is done with an OpSplitList at the paragraph containing "Level 3". Then an OpMergeList is done to join the new list with the top part of the split list.

### Removing list items
The most basic list removal scenario is to remove all the list items in a list which can be done by only using OpRemoveList. A more difficult scenario is to partially remove a list shown below:

```xml
<text:list text:style-name="styleA">
    <text:list-item>
        <text:p>Level 1</text:p>
        <text:list>
            <text:list-item>
                <text:p>Level 2</text:p>
                <text:list>
                    <text:list-item>
                        <text:p>Level 3</text:p>
                        <text:list>
                            <text:list-item>
                                <text:p>Level 4</text:p>
                            </text:list-item>
                        </text:list>
                    </text:list-item>
                </text:list>
            </text:list-item>
        </text:list>
    </text:list-item>
</text:list>
```

Assuming a selection that removes the paragraphs "Level 2" and "Level 3" the desired result is as follows.

```xml
<text:list text:style-name="styleA">
    <text:list-item>
        <text:p>Level 1</text:p>
    </text:list-item>
</text:list>
<text:p>Level 2</text:p>
<text:p>Level 3</text:p>
<text:list text:style-name="styleA">
    <text:list-item>
        <text:list>
            <text:list-item>
                <text:list>
                    <text:list-item>
                        <text:list>
                            <text:list-item>
                                <text:p>Level 4</text:p>
                            </text:list-item>
                        </text:list>
                    </text:list-item>
                </text:list>
            </text:list-item>
        </text:list>
    </text:list-item>
</text:list>
```

The sequence of ops here is to do an OpSplitList at the paragraph "Level 2" and then another split list at the "Level 4" paragraph. This should leave us with three lists with the middle list containing the paragraphs "Level 2" and "Level 3". An OpRemoveList can then be done on this middle list to convert this back to non-list paragraphs.

### Changing style of list items
Reusing the example from before instead of removing the paragraphs "Level 2" and "Level 3" we will instead change the list style applied to them. The desired result is below:

```xml
<text:list text:style-name="styleA">
    <text:list-item>
        <text:p>Level 1</text:p>
    </text:list-item>
</text:list>
<text:list text:style-name="styleB">
    <text:list-item>
        <text:list>
            <text:list-item>
                <text:p>Level 2</text:p>
                <text:list>
                    <text:list-item>
                        <text:p>Level 3</text:p>
                    </text:list-item>
                </text:list>
            </text:list-item>
        </text:list>
    </text:list-item>
</text:list>
<text:list text:style-name="styleA">
    <text:list-item>
        <text:list>
            <text:list-item>
                <text:list>
                    <text:list-item>
                        <text:list>
                            <text:list-item>
                                <text:p>Level 4</text:p>
                            </text:list-item>
                        </text:list>
                    </text:list-item>
                </text:list>
            </text:list-item>
        </text:list>
    </text:list-item>
</text:list>
```

The sequence of ops is also similar starting with the same usage of OpSplitList resulting in three lists. However instead of doing an OpRemoveList we do an OpSetListProperties on the middle list to apply the new style to it.

### Collaborative editing interactions between adding lists and merging paragraphs
In a collaborative editing scenario one user may choose to create a list over some range while another may choose to merge a paragraph in that range. If the paragraph that is merged is not the first paragraph in the range it is easy to solve as the resulting list simply has one less item.

However if the first paragraph is merged then it more difficult to solve. We will look at an example document fragment below. Client A will create a list including paragraphs "Two" and "Three". Client B will merge paragraph "Two" into "One".

```xml
<text:p>One</text:p>
<text:p>Two</text:p>
<text:p>Three</text:p>
```

After the ops are applied locally on each client the results are as follows:

**Client A**
```xml
<text:p>One</text:p>
<text:list>
	<text:list-item>
    	<text:p>Two</text:p>
    </text:list-item>
    <text:list-item>
    	<text:p>Three</text:p>
    </text:list-item>
</text:list>
```

**Client B**
```xml
<text:p>OneTwo</text:p>
<text:p>Three</text:p>
```

One way this could be resolved is to apply the OpMergeParagraph on Client A and then modify OpAddList to move to the start of the range by the length of the merged paragraph which is then sent back to Client B. The final result is shown below:

```xml
<text:p>OneTwo</text:p>
<text:list>
    <text:list-item>
    	<text:p>Three</text:p>
    </text:list-item>
</text:list>
```

This would require a change to OpMergeParagraph to provide the paragraph lengths. Another possible way to resolve the conflict is that Client A locally applies an OpAddList for paragraph "One" and then does a local OpMergeList to join it with the other list. Then the OpMergeParagraph received from Client B is applied. Next it modifies the original OpAddList to change the start of the paragraph range to be the same as the destination paragraph of the OpMergeParagraph executed by Client B and sends this op back to Client B. We then end up with the final result below:

```xml
<text:list>
	<text:list-item>
    	<text:p>OneTwo</text:p>
    </text:list-item>
    <text:list-item>
    	<text:p>Three</text:p>
    </text:list-item>
</text:list>
```

### Collaborative editing interactions between adding/removing lists general text editing
Apart from some tricky possibilities with OpMergeParagraph as shown above resolving collaborative editing conflicts between OpAdd/OpRemoveList and other text editing operations such as OpSplitParagraph, OpInsertText and OpRemoveText is relatively straightforward. As list operations don't add or remove steps from the document conflict resolution is done by simply adjusting the ranges and positions of list operations by the amount that text editing operations change the document.

A simple example is removing some text in a paragraph that is to be added as a list. This can be resolved by adjusting the end paragraph of the range used by OpAddList by the amount of characters removed by OpRemoveText.

### Prohibited collaborative editing interactions
Some possible conflicts should not be possible assuming a well behaved controller. OpAddList and OpRemoveList should never conflict as you can't add a list where one already exists or remove a list that does not exist. OpAddList should also never conflict with OpMergeList, OpSplitList, OpPromoteList and OpDemoteList as these ops all work with existing lists only.

If there is ever a conflict it means the document is now in an invalid state and an unresolvable conflict will be the result.
