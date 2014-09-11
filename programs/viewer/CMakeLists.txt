# files for the viewer
set(VIEWER_IMAGES
	images/texture.png
	images/toolbarButton-download.png
	images/toolbarButton-fullscreen.png
	images/toolbarButton-menuArrows.png
	images/toolbarButton-pageDown.png
	images/toolbarButton-pageUp.png
	images/toolbarButton-zoomIn.png
	images/toolbarButton-zoomOut.png
       images/nlnet.png
       images/kogmbh.png
)

# amalgamation:
# (write js code into into viewer-amalgamation.html), currently unused
add_custom_command(
    OUTPUT viewer-amalgamation.html
    COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/replaceByFileContents.js
        ${CMAKE_CURRENT_SOURCE_DIR}/index-amalgamation-template.html
        viewer-amalgamation.html
        @VIEWER_JS@ ${CMAKE_CURRENT_SOURCE_DIR}/viewer.js
        @WEBODF_JS@ ${CMAKE_BINARY_DIR}/webodf/webodf.js
    DEPENDS ${NODE}
        ${TOOLS_DIR}/replaceByFileContents.js
        viewer.js
        webodf.js-target
        index-amalgamation-template.html
)
add_custom_target(viewer-amalgamation.html-target DEPENDS viewer-amalgamation.html)

# minimize js code
add_custom_command(
	OUTPUT viewer-minimized.js
	COMMAND ${Java_JAVA_EXECUTABLE}
	ARGS -jar ${CLOSURE_JAR}
	${SHARED_CLOSURE_ARGS}
	--js ${CMAKE_CURRENT_SOURCE_DIR}/viewer.js
	--compilation_level SIMPLE_OPTIMIZATIONS
	--js_output_file ${CMAKE_CURRENT_BINARY_DIR}/viewer-minimized.js
	DEPENDS ClosureCompiler viewer.js
	)
add_custom_target(viewer-minimized.js-target DEPENDS viewer-minimized.js)

add_custom_command(
    OUTPUT ${VIEWERBUILDDIR}/webodf.js
	COMMAND ${CMAKE_COMMAND} -E remove_directory ${VIEWERBUILDDIR}
	COMMAND ${CMAKE_COMMAND} -E make_directory ${VIEWERBUILDDIR}
	COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/images ${VIEWERBUILDDIR}/images
	COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/viewer.css ${VIEWERBUILDDIR}/viewer.css
	COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/example.local.css ${VIEWERBUILDDIR}/example.local.css
	COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/../../webodf/webodf.js ${VIEWERBUILDDIR}/webodf.js
	COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/viewer-minimized.js ${VIEWERBUILDDIR}/viewer.js
	COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/index.html ${VIEWERBUILDDIR}/index.html
	COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/ODFViewerPlugin.css ${VIEWERBUILDDIR}/ODFViewerPlugin.css
	COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/ODFViewerPlugin.js ${VIEWERBUILDDIR}/ODFViewerPlugin.js
	COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/PluginLoader.js ${VIEWERBUILDDIR}/PluginLoader.js
    COMMAND ${CMAKE_COMMAND} -E copy ${LIBJSLICENSEFILE} ${VIEWERBUILDDIR}
    DEPENDS
        ${VIEWER_IMAGES}
        viewer.css
        example.local.css
        index.html
        PluginLoader.js
        ODFViewerPlugin.js
        ODFViewerPlugin.css
        webodf.js-target
        viewer-minimized.js-target
)
add_custom_target(build-viewerjsdir DEPENDS ${VIEWERBUILDDIR}/webodf.js)

add_custom_target(test-viewerjsdir DEPENDS webodf.js-tests)

add_custom_target(product-viewerjsdir DEPENDS build-viewerjsdir test-viewerjsdir)
