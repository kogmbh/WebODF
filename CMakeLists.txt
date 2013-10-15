# WebODF is mostly a JavaScript project. CMake needs to know about the C++ parts
project (WebODF C CXX)
# version 2.8.2 is needed to have support for zip files in external projects
# issues with version 2.8.4 on Windows makes us test for a higher version
if(WIN32)
    cmake_minimum_required(VERSION 2.8.6)
else()
    cmake_minimum_required(VERSION 2.8.2)
endif(WIN32)
include(ProcessorCount OPTIONAL RESULT_VARIABLE ProcessorCountFound)
if (ProcessorCountFound)
  ProcessorCount(NProcessors)
else (ProcessorCountFound)
  set(NProcessors 1)
endif (ProcessorCountFound)

# At this point, the version number that is used throughout is defined
# The version number is gotten from either the git repository or the name of the
# folder. If the current folder has a name that matches "webodf-\d+.\d+.\d+"
# then that version number is used. If not, the folder should be a git folder
# and have ability to get a tag.
# The third option is to accept the version as cmake-parameter from the
# outside, which overwrites the other two alternatives.

SET(OVERRULED_WEBODF_VERSION "" CACHE STRING "WebODF Version to overrule what WebODF would calclulate")
if (OVERRULED_WEBODF_VERSION)
  set(WEBODF_VERSION ${OVERRULED_WEBODF_VERSION})
else (OVERRULED_WEBODF_VERSION)
  string(REGEX MATCH "^.*/webodf-([0-9]+.[0-9]+.[0-9]+)$" WEBODF_VERSION "${CMAKE_CURRENT_SOURCE_DIR}")
  if (CMAKE_MATCH_1)
    set(WEBODF_VERSION ${CMAKE_MATCH_1})
  else (CMAKE_MATCH_1)
    # get version number from git
    exec_program(git ${CMAKE_CURRENT_SOURCE_DIR}
      ARGS describe --tags --dirty --match "v[0-9]*"
      OUTPUT_VARIABLE GIT_WEBODF_VERSION)
    # check version number from git
    string(REGEX MATCH "^v([0-9]+.[0-9]+.[0-9]+(-[0-9]+-[0-9a-z]+(-dirty)?)?)$" CHECKED_WEBODF_VERSION "${GIT_WEBODF_VERSION}")
    if (CMAKE_MATCH_1)
      set(WEBODF_VERSION ${CMAKE_MATCH_1})
    else (CMAKE_MATCH_1)
      message(FATAL_ERROR "No valid version number found via git: ${GIT_WEBODF_VERSION}")
    endif (CMAKE_MATCH_1)
  endif (CMAKE_MATCH_1)
endif (OVERRULED_WEBODF_VERSION)
message(STATUS "WebODF version " ${WEBODF_VERSION})

# This makefile 'compiles' WebODF using various tools, instruments the code and
# builds and packages programs that use WebODF.

# Find installed dependencies
find_package(Qt4 4.7.0 COMPONENTS QtCore QtGui QtXml QtNetwork QtWebKit)
if (NOT QT4_FOUND)
  message(WARNING "Qt4 with modules QtCore QtGui QtXml QtNetwork QtWebKit was not found. qtjsruntime will no be built.")
endif (NOT QT4_FOUND)

# java runtime is needed for Closure Compiler
find_package(Java COMPONENTS Runtime)

if (CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)
  message(FATAL_ERROR "Compiling in the source directory is not supported. Use for example 'mkdir build; cd build; cmake ..'.")
endif (CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)

# Tools must be obtained to work with:
include (ExternalProject)

# allow specification of a directory with pre-downloaded
# requirements by evaluating environment variable
# $WEBODF_DOWNLOAD_DIR
# defaults to ./downloads in the build directory.
if ( IS_DIRECTORY $ENV{WEBODF_DOWNLOAD_DIR} )
    SET ( EXTERNALS_DOWNLOAD_DIR $ENV{WEBODF_DOWNLOAD_DIR} )
else ( IS_DIRECTORY $ENV{WEBODF_DOWNLOAD_DIR} )
    SET ( EXTERNALS_DOWNLOAD_DIR ${CMAKE_BINARY_DIR}/downloads )
endif ( IS_DIRECTORY $ENV{WEBODF_DOWNLOAD_DIR} )
MESSAGE ( STATUS "external downloads will be stored/expected in: ${EXTERNALS_DOWNLOAD_DIR}" )

if(Java_JAVA_EXECUTABLE)
    # Closure Compiler
    ExternalProject_Add(
        ClosureCompiler
        DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
        URL "http://closure-compiler.googlecode.com/files/compiler-20130823.tar.gz"
        URL_MD5 105db24c4676e23f2495adfdea3159bc
        CONFIGURE_COMMAND ""
        BUILD_COMMAND ""
        INSTALL_COMMAND ""
    )
    set(CLOSURE_JAR ${CMAKE_BINARY_DIR}/ClosureCompiler-prefix/src/ClosureCompiler/compiler.jar)
endif(Java_JAVA_EXECUTABLE)

# Rhino
if(Java_JAVA_EXECUTABLE)
    ExternalProject_Add(
        Rhino
        DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
        URL "http://ftp.mozilla.org/pub/js/rhino1_7R3.zip"
        URL_MD5 99d94103662a8d0b571e247a77432ac5
        CONFIGURE_COMMAND ""
        BUILD_COMMAND ""
        INSTALL_COMMAND ""
    )
    set(RHINO ${CMAKE_BINARY_DIR}/Rhino-prefix/src/Rhino/js.jar)
endif(Java_JAVA_EXECUTABLE)

# JSDoc
ExternalProject_Add(
    JsDoc
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "http://jsdoc-toolkit.googlecode.com/files/jsdoc_toolkit-2.4.0.zip"
    URL_MD5 a8f78f5ecd24b54501147b2af341a231
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
set(JSDOCDIR ${CMAKE_BINARY_DIR}/JsDoc-prefix/src/JsDoc/jsdoc-toolkit)

# Node.JS
set(NODEVERSION 0.10.20)
if(WIN32)
    # On windows, it is significantly faster and more reliable to download
    # a pre-built 32-bit binary
    set(NODE_BIN_URL "http://nodejs.org/dist/v${NODEVERSION}/node.exe")
    set(NODE_BIN_MD5 "3bc43fbbfcddc376d5769e9757bd0bca")
    file(DOWNLOAD "${NODE_BIN_URL}" "${EXTERNALS_DOWNLOAD_DIR}/node-download.exe"
        SHOW_PROGRESS
        EXPECTED_MD5 ${NODE_BIN_MD5}
    )
    set(NODE ${CMAKE_BINARY_DIR}/NodeJS-prefix/bin/node.exe)

    add_custom_command(
        OUTPUT "${NODE}"
        COMMAND ${CMAKE_COMMAND} ARGS -E make_directory ${CMAKE_BINARY_DIR}/NodeJS-prefix
        COMMAND ${CMAKE_COMMAND} ARGS -E make_directory ${CMAKE_BINARY_DIR}/NodeJS-prefix/bin
        COMMAND ${CMAKE_COMMAND} ARGS -E copy ${EXTERNALS_DOWNLOAD_DIR}/node-download.exe
            "${NODE}"
    )
    add_custom_target(NodeJS DEPENDS "${NODE}")
else(WIN32)
    ExternalProject_Add(
        NodeJS
        PREFIX ${CMAKE_BINARY_DIR}/NodeJS-prefix
        DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
        URL "http://nodejs.org/dist/v${NODEVERSION}/node-v${NODEVERSION}.tar.gz"
        URL_MD5 784e7d7a8e29dfec88ddb2e72a895407
        CONFIGURE_COMMAND ./configure --prefix=${CMAKE_BINARY_DIR}/NodeJS-prefix
        INSTALL_DIR ${CMAKE_BINARY_DIR}/NodeJS-prefix
        BUILD_COMMAND make -j${NProcessors}
        BUILD_IN_SOURCE 1
    )

    # copy node_modules directory from source to build
    # (this is needed if a module is required in there)
    add_custom_target(copy_node_modules ALL
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/node_modules ${CMAKE_BINARY_DIR}/node_modules
        COMMENT copying node_modules from source to build
    )
    set(NODE ${CMAKE_BINARY_DIR}/NodeJS-prefix/bin/node)
endif(WIN32)


# JSCoverage
if(WIN32)
    # JSCoverage only builds with Cygwin/MiniGW
    # Rather than force a dependency on a specific compiler, download binaries
    ExternalProject_Add(
        JSCoverage
        DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
        URL "http://siliconforks.com/jscoverage/download/jscoverage-0.5.1-windows.zip"
        CONFIGURE_COMMAND ""
        BUILD_COMMAND ""
        INSTALL_COMMAND ""
        TEST_COMMAND ""
    )
    set(JSCOVERAGE ${CMAKE_BINARY_DIR}/JSCoverage-prefix/src/JSCoverage/jscoverage)
else(WIN32)
    ExternalProject_Add(
        JSCoverage
        DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
        URL "http://siliconforks.com/jscoverage/download/jscoverage-0.5.1.tar.bz2"
        URL_MD5 a70d79a6759367fbcc0bcc18d6866ff3
        PATCH_COMMAND  cat ${CMAKE_CURRENT_SOURCE_DIR}/JSCoverage.patch | patch -p0
        CONFIGURE_COMMAND "./configure"
        BUILD_COMMAND make -j${NProcessors}
        BUILD_IN_SOURCE 1
        INSTALL_COMMAND ""
    )
    set(JSCOVERAGE ${CMAKE_BINARY_DIR}/JSCoverage-prefix/src/JSCoverage/jscoverage)
endif(WIN32)

# Dojo
ExternalProject_Add(
    Dojo
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "http://download.dojotoolkit.org/release-1.8.1/dojo-release-1.8.1-src.tar.gz"
    URL_MD5 9b80b9a736b81c336accd832f3c3aea2
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
set(DOJO ${CMAKE_BINARY_DIR}/Dojo-prefix/src/Dojo)

# Dojo requires a patch on windows
if(WIN32)
    set(DOJOPATCH_URL "http://bugs.dojotoolkit.org/raw-attachment/ticket/15413/node-win-1.8.patch")
    set(DOJOPATCH_MD5 "51eae664ddbe919c28c4e3082748cd19")
    set(DOJOPATCH ${EXTERNALS_DOWNLOAD_DIR}/dojo-node.patch)

    file(DOWNLOAD "${DOJOPATCH_URL}" "${DOJOPATCH}"
        SHOW_PROGRESS
        EXPECTED_MD5 ${DOJOPATCH_MD5}
    )


    ExternalProject_Add_Step(Dojo applyPatch
        COMMAND cat ${DOJOPATCH} | patch -p0 -d ${CMAKE_BINARY_DIR}/Dojo-prefix/src/Dojo/util/
        DEPENDEES build
    )
endif(WIN32)


# Ant
# Required for building Android applications
if(WIN32)
    # Ant is not generally installed on Windows systems
    ExternalProject_Add(
        AntBin
        DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
        URL "http://archive.apache.org/dist/ant/binaries/apache-ant-1.8.4-bin.zip"
        URL_MD5 ca632528c35b8a335edd4e2064f7129e
        CONFIGURE_COMMAND ""
        BUILD_COMMAND ""
        INSTALL_COMMAND ""
    )
    set(ANT ${CMAKE_BINARY_DIR}/AntBin-prefix/src/AntBin/bin/ant.bat)
endif()
if (NOT ANT)
  find_file(ANT NAMES ant ant.exe /usr/bin /usr/local/bin)
endif(NOT ANT)

# Android
if (NOT ANDROID_SDK_DIR)
  if(WIN32)
    find_path(ANDROID_SDK_DIR platform-tools/aapt.exe)
  else()
    find_path(ANDROID_SDK_DIR platform-tools/aapt)
  endif()
endif(NOT ANDROID_SDK_DIR)

set(LIBJSFILES lib/packages.js lib/runtime.js lib/core/Base64.js

    lib/core/RawDeflate.js
    lib/core/ByteArray.js
    lib/core/ByteArrayWriter.js
    lib/core/RawInflate.js
    lib/core/LoopWatchDog.js
    lib/core/Utils.js
    lib/core/DomUtils.js
    lib/core/Cursor.js
    lib/core/EventNotifier.js
    lib/core/UnitTester.js
    lib/core/PositionIterator.js
    lib/core/PositionFilter.js
    lib/core/PositionFilterChain.js
    lib/core/Async.js
    lib/core/Zip.js
    lib/core/CSSUnits.js

    lib/xmldom/LSSerializerFilter.js
    lib/xmldom/LSSerializer.js
    lib/xmldom/RelaxNGParser.js
    lib/xmldom/RelaxNG.js
    lib/xmldom/RelaxNG2.js
    lib/xmldom/XPath.js

    lib/gui/AnnotationViewManager.js
    lib/odf/OdfNodeFilter.js
    lib/odf/Namespaces.js
    lib/odf/StyleInfo.js
    lib/odf/OdfUtils.js
    lib/odf/TextSerializer.js
    lib/odf/TextStyleApplicator.js
    lib/odf/Style2CSS.js
    lib/odf/OdfContainer.js
    lib/odf/FontLoader.js
    lib/odf/ObjectNameGenerator.js
    lib/odf/Formatting.js
    lib/odf/OdfCanvas.js
    lib/odf/CommandLineTools.js

    lib/ops/Server.js
    lib/ops/Operation.js
    lib/ops/OpAddCursor.js
    lib/gui/StyleHelper.js
    lib/ops/OpApplyDirectStyling.js
    lib/ops/OpRemoveCursor.js
    lib/ops/OpMoveCursor.js
    lib/ops/OpSetBlob.js
    lib/ops/OpRemoveBlob.js
    lib/ops/OpInsertImage.js
    lib/ops/OpInsertTable.js
    lib/ops/OpInsertText.js
    lib/ops/OpRemoveText.js
    lib/ops/OpSplitParagraph.js
    lib/ops/OpSetParagraphStyle.js
    lib/ops/OpUpdateParagraphStyle.js
    lib/ops/OpAddStyle.js
    lib/ops/OpRemoveStyle.js
    lib/ops/OpAddAnnotation.js
    lib/ops/OpRemoveAnnotation.js
    lib/ops/OperationFactory.js
    lib/gui/SelectionMover.js
    lib/ops/OdtCursor.js
    lib/ops/EditInfo.js
    lib/gui/ShadowCursor.js
    lib/gui/Avatar.js
    lib/gui/Caret.js
    lib/gui/KeyboardHandler.js
    lib/gui/Clipboard.js
    lib/gui/DirectTextStyler.js
    lib/gui/DirectParagraphStyler.js
    lib/gui/ImageManager.js
    lib/gui/TextManipulator.js
    lib/gui/EventManager.js
    lib/gui/SessionController.js
    lib/ops/MemberModel.js
    lib/ops/TrivialMemberModel.js
    lib/ops/OperationRouter.js
    lib/ops/TrivialOperationRouter.js
    lib/gui/EditInfoHandle.js
    lib/gui/EditInfoMarker.js
    lib/gui/SessionView.js
    lib/gui/CaretManager.js
    lib/gui/PresenterUI.js
    lib/gui/XMLEdit.js
    lib/gui/UndoManager.js
    lib/gui/UndoStateRules.js
    lib/gui/TrivialUndoManager.js
    lib/gui/SelectionView.js
    lib/gui/SelectionViewManager.js

    lib/ops/OdtDocument.js
    lib/ops/Session.js
)

set(HTML5UIFILES
  app/app.js
  app/controller/Files.js
  app/model/FileSystem.js
  app/views/FileDetail.js
  app/views/FilesList.js
  app/views/OdfView.js
  app/views/Viewport.js
  sencha-touch.css
  sencha-touch.js
  app/store/FileStore.js
  ZoomOut.png
  ZoomIn.png
  go-previous.png
  go-next.png
  zoom-fit-width.png
  zoom-fit-best.png
  zoom-fit-height.png
)

set (RUNTIME ${CMAKE_CURRENT_SOURCE_DIR}/webodf/lib/runtime.js)

macro(COPY_FILES _varname _srcdir _tgtdir)
  foreach(_file ${ARGN})
    GET_FILENAME_COMPONENT(_subdir ${_file} PATH)
    FILE(MAKE_DIRECTORY ${_tgtdir}/${_subdir})
    if (IS_ABSOLUTE ${_file})
      SET(_srcfile ${_file})
    else (IS_ABSOLUTE ${_file})
      SET(_srcfile ${_srcdir}/${_file})
    endif (IS_ABSOLUTE ${_file})
    add_custom_command(
      OUTPUT ${_tgtdir}/${_file}
      COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different
        ${_srcfile}
        ${_tgtdir}/${_file}
      DEPENDS
        ${_srcfile}
    )
    set(${_varname} ${${_varname}} ${_tgtdir}/${_file})
  endforeach(_file)
endmacro(COPY_FILES _directory _files)

set (VIEWERBUILDDIR ${CMAKE_CURRENT_BINARY_DIR}/viewer)
set (WORDPRESSZIPDIR ${CMAKE_CURRENT_BINARY_DIR}/webodf-wordpress-${WEBODF_VERSION})
set (WORDPRESSZIP ${WORDPRESSZIPDIR}.zip)
set(WEBODFXPIDIR ${CMAKE_CURRENT_BINARY_DIR}/webodf-${WEBODF_VERSION})
set(WEBODFXPI ${WEBODFXPIDIR}.xpi)

add_subdirectory(webodf)
add_subdirectory(programs)

# package webodf
set(WEBODFZIP webodf-${WEBODF_VERSION}.zip)
set(WEBODFZIPDIR ${CMAKE_CURRENT_BINARY_DIR}/webodf-${WEBODF_VERSION})
add_custom_command(
    OUTPUT ${WEBODFZIP}
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${WEBODFZIPDIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${WEBODFZIPDIR}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/programs/viewer/README-viewer.odt ${WEBODFZIPDIR}/README.odt
    # viewer
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${VIEWERBUILDDIR} ${WEBODFZIPDIR}/viewer
    # editor
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_BINARY_DIR}/programs/editor ${WEBODFZIPDIR}/editor
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${WEBODFZIPDIR}/editor/dojo-deps
    # wordpressplugin
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/programs/wordpressplugin/readme.txt ${WEBODFZIPDIR}/wordpressplugin-readme.txt
    COMMAND ${CMAKE_COMMAND} -E copy ${WORDPRESSZIP} ${WEBODFZIPDIR}

    # firefox
    COMMAND ${CMAKE_COMMAND} -E copy ${WEBODFXPI} ${WEBODFZIPDIR}

    # zip using javascript code running in node.js
    COMMAND ${NODE} ARGS webodf/lib/runtime.js ${CMAKE_CURRENT_SOURCE_DIR}/webodf/tools/zipdir.js
        ${WEBODFZIPDIR}
        ${CMAKE_CURRENT_BINARY_DIR}/${WEBODFZIP}
    DEPENDS
        wordpress-target
        webodf-debug.js-target
        webodf.js-target
        editor-compiled.js-target
        viewer-minimized.js-target
        firefoxextension-target
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)
add_custom_target(zip DEPENDS ${WEBODFZIP})

# vim:expandtab
