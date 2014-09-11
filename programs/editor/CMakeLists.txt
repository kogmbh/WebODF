SET(COMMON_EDITOR_FILES
    Tools.js
    avatar-joe.png
    EditorSession.js
    Translator.js
    FullWindowZoomHelper.js
    wodotexteditor.css
)

SET(ALONE_EDITOR_ONLY_FILES
    wodotexteditor.js
    images/kogmbh.png
    images/webodf.png
)
SET(ALONE_EDITOR_EXAMPLE_FILES
    FileSaver.js
    localfileeditor.js
    localeditor.html
    texteditor.html
    welcome.odt
)
SET(ALONE_EDITOR_FILES
    ${COMMON_EDITOR_FILES}
    ${ALONE_EDITOR_ONLY_FILES}
)

SET(COMMON_COLLAB_FILES
    SessionListView.js
    MemberListView.js
    document-save.png
    network-disconnect.png
    vcs-locally-modified.png
    wodocollabpane.css
    wodocollabtexteditor.js
)

SET(COLLAB_EDITOR_ONLY_FILES
    collabeditor.html
    pullboxeditor.js
)

SET(SPLIT_SCREEN_EDITOR_ONLY_FILES
    splitscreeneditor.css
    splitscreeneditor.js
    splitscreeneditor.html
    welcome.odt
    avatar-peggy.png
)

# creates a copy of the compiled webodf.js in the editor build dir
add_custom_target(editor-webodf.js-target
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/webodf/webodf.js .
)
add_dependencies(editor-webodf.js-target webodf.js-target)


####################
## Dojo amalgamation
####################

SET(DOJO_DEPS ${CMAKE_CURRENT_BINARY_DIR}/dojo-deps)

add_custom_command(
    OUTPUT dojo-amalgamation.js

    # from our sources
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/dojo-deps/ dojo-deps/

    # from dojo download (DEPENDS Dojo)
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${DOJO}/dojo/ dojo-deps/src/dojo/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${DOJO}/dijit/ dojo-deps/src/dijit/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${DOJO}/dojox/ dojo-deps/src/dojox/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${DOJO}/util/ dojo-deps/src/util/

    # now do the dojo magic...
    COMMAND ${NODE} ${DOJO_DEPS}/src/dojo/dojo.js load=build
        --require ${DOJO_DEPS}/src/app/run.js
        --profile ${DOJO_DEPS}/profiles/app.profile.js
        --releaseDir ${DOJO_DEPS}/dist

    COMMAND ${CMAKE_COMMAND} -E make_directory dojo/

    COMMAND ${CMAKE_COMMAND} -E copy dojo-deps/dist/dojo/dojo.js dojo/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dojo/resources/ dojo/resources/

    COMMAND ${CMAKE_COMMAND} -E make_directory app/resources/
    COMMAND ${CMAKE_COMMAND} -E copy dojo-deps/dist/app/resources/app.css app/resources/

    COMMAND ${CMAKE_COMMAND} -E make_directory dijit/
    COMMAND ${CMAKE_COMMAND} -E make_directory dijit/themes
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dijit/themes/a11y/ dijit/themes/a11y/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dijit/themes/claro/ dijit/themes/claro/
    COMMAND ${CMAKE_COMMAND} -E copy dojo-deps/dist/dijit/themes/dijit.css dijit/themes/dijit.css
    COMMAND ${CMAKE_COMMAND} -E copy dojo-deps/dist/dijit/themes/dijit_rtl.css dijit/themes/dijit_rtl.css
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dijit/icons/ dijit/icons/

    COMMAND ${CMAKE_COMMAND} -E make_directory dojox/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dojox/layout/resources/ dojox/layout/resources/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dojox/widget/ColorPicker/ dojox/widget/ColorPicker/

    COMMAND ${NODE} ${CMAKE_SOURCE_DIR}/webodf/tools/dojoNlsCompile.js dojo-deps/dist de ru > dojobundle.js

    COMMAND ${NODE} ${CMAKE_CURRENT_SOURCE_DIR}/libexec/mergeIntoDojo.js dojobuild=${DOJO_DEPS}/dist/dojo/dojo.js dojobundle.js > dojo-amalgamation.js

    # cleanup
    # COMMAND ${CMAKE_COMMAND} -E remove_directory dojo-deps/dist

    DEPENDS ${NODE} Dojo
)

####################
## Dojo amalgamation
####################

add_custom_target(more-common-editorfiles-target
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/resources/ resources/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/translations/ translations/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/widgets/ widgets/
)

##################
## Wodo.TextEditor
##################

set(WODOTEXTEDITORDOC_BUILDDIR  ${WODOTEXTEDITORBUILDDIR}/docs)
set(WODOTEXTEDITORCODE_BUILDDIR ${WODOTEXTEDITORBUILDDIR}/wodotexteditor)

add_custom_command(
    OUTPUT ${WODOTEXTEDITORBUILDDIR}/webodf.js
    # clean up output dir
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${WODOTEXTEDITORBUILDDIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${WODOTEXTEDITORBUILDDIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${WODOTEXTEDITORCODE_BUILDDIR}

    COMMAND ${CMAKE_COMMAND} -E copy webodf.js ${WODOTEXTEDITORCODE_BUILDDIR}

    COMMAND ${CMAKE_COMMAND} -E copy_directory resources/ ${WODOTEXTEDITORCODE_BUILDDIR}/resources/
    COMMAND ${CMAKE_COMMAND} -E copy_directory translations/ ${WODOTEXTEDITORCODE_BUILDDIR}/translations/
    COMMAND ${CMAKE_COMMAND} -E copy_directory widgets/ ${WODOTEXTEDITORCODE_BUILDDIR}/widgets/

    # dojo compiled
    COMMAND ${CMAKE_COMMAND} -E copy dojo-amalgamation.js ${WODOTEXTEDITORCODE_BUILDDIR}

    # more dojo (data) files
    COMMAND ${CMAKE_COMMAND} -E make_directory ${WODOTEXTEDITORCODE_BUILDDIR}/dojo
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo/resources ${WODOTEXTEDITORCODE_BUILDDIR}/dojo/resources
    COMMAND ${CMAKE_COMMAND} -E copy_directory app/ ${WODOTEXTEDITORCODE_BUILDDIR}/app/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dijit/ ${WODOTEXTEDITORCODE_BUILDDIR}/dijit/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojox/ ${WODOTEXTEDITORCODE_BUILDDIR}/dojox/

    COMMAND ${CMAKE_COMMAND} -E copy ${LIBJSLICENSEFILE} ${WODOTEXTEDITORBUILDDIR}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/HOWTO-wodotexteditor.md  ${WODOTEXTEDITORBUILDDIR}/HOWTO.md

    DEPENDS dojo-amalgamation.js editor-webodf.js-target more-common-editorfiles-target
)

foreach(AE_FILE ${ALONE_EDITOR_FILES})
    set(AE_BUILDFILE ${WODOTEXTEDITORCODE_BUILDDIR}/${AE_FILE})
    set(AE_FILE ${CMAKE_CURRENT_SOURCE_DIR}/${AE_FILE})
    add_custom_command(
      OUTPUT ${AE_BUILDFILE}
      COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different
        ${AE_FILE}
        ${AE_BUILDFILE}
      DEPENDS
        ${AE_FILE} ${WODOTEXTEDITORBUILDDIR}/webodf.js
    )
    list(APPEND WODOTEXTEDITOR_BUILDFILES ${AE_BUILDFILE})
endforeach(AE_FILE)

foreach(AE_FILE ${ALONE_EDITOR_EXAMPLE_FILES})
    set(AE_BUILDFILE ${WODOTEXTEDITORBUILDDIR}/${AE_FILE})
    set(AE_FILE ${CMAKE_CURRENT_SOURCE_DIR}/${AE_FILE})
    add_custom_command(
      OUTPUT ${AE_BUILDFILE}
      COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different
        ${AE_FILE}
        ${AE_BUILDFILE}
      DEPENDS
        ${AE_FILE} ${WODOTEXTEDITORBUILDDIR}/webodf.js
    )
    list(APPEND WODOTEXTEDITOR_BUILDFILES ${AE_BUILDFILE})
endforeach(AE_FILE)

add_custom_target(wodotexteditorbuilddir-target DEPENDS ${WODOTEXTEDITORBUILDDIR}/webodf.js ${WODOTEXTEDITOR_BUILDFILES})

add_custom_command(
    OUTPUT ${WODOTEXTEDITORDOC_BUILDDIR}/index.html
    COMMAND ${Java_JAVA_EXECUTABLE} ARGS -jar ${JSDOCDIR}/jsrun.jar
        ${JSDOCDIR}/app/run.js
        -d=${WODOTEXTEDITORDOC_BUILDDIR}
        -t=${JSDOCDIR}/templates/jsdoc
        wodotexteditor.js
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    DEPENDS wodotexteditorbuilddir-target JsDoc
)
add_custom_target(wodotexteditor-doc DEPENDS ${WODOTEXTEDITORDOC_BUILDDIR}/index.html)

# package wodotexteditor
set(WODOTEXTEDITOR_ZIP wodotexteditor-${WEBODF_VERSION}.zip)
add_custom_command(
    OUTPUT ${WODOTEXTEDITOR_ZIP}
    # zip using javascript code running in node.js
    COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
        ${WODOTEXTEDITORBUILDDIR}
        ${CMAKE_BINARY_DIR}/${WODOTEXTEDITOR_ZIP}
        notopdir
        wodotexteditor-${WEBODF_VERSION}
    DEPENDS
        wodotexteditorbuilddir-target
        wodotexteditor-doc
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)
add_custom_target(build-wodotexteditor DEPENDS ${WODOTEXTEDITOR_ZIP})

add_custom_target(test-wodotexteditor DEPENDS webodf.js-tests)

add_custom_target(product-wodotexteditor DEPENDS build-wodotexteditor test-wodotexteditor)


################
## Collab editor
################

# intermediate solution until session-based editor component and backends are sorted out

COPY_FILES(COLLAB_EDITOR_DEPS ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_BINARY_DIR}
    ${COMMON_EDITOR_FILES}
    ${COMMON_COLLAB_FILES}
    ${COLLAB_EDITOR_ONLY_FILES}
)

add_custom_target(server-collab-editorfiles-target
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/backend backend/
)

add_custom_target(collabeditor DEPENDS dojo-amalgamation.js editor-webodf.js-target ${COLLAB_EDITOR_DEPS} more-common-editorfiles-target server-collab-editorfiles-target)

COPY_FILES(SPLIT_SCREEN_EDITOR_DEPS ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_BINARY_DIR}
    ${COMMON_EDITOR_FILES}
    ${COMMON_COLLAB_FILES}
    ${SPLIT_SCREEN_EDITOR_ONLY_FILES}
)

add_custom_target(splitscreeneditor DEPENDS dojo-amalgamation.js editor-webodf.js-target ${SPLIT_SCREEN_EDITOR_DEPS} more-common-editorfiles-target server-collab-editorfiles-target)
