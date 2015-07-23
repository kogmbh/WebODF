
COPY_FILES(OFFICESHOTSFILES ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}
    index.html.in webodf-odf-to-exported.sh
    )
  
add_custom_target(officeshotsDepencencies ALL DEPENDS ${OFFICESHOTSFILES})
