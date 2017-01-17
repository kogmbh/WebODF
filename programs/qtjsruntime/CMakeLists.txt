set(CMAKE_AUTOMOC ON)

add_executable(qtjsruntime qtjsruntime.cpp pagerunner.cpp nativeio.cpp nam.h)

target_link_libraries(qtjsruntime
  Qt5::WebKitWidgets
  Qt5::Network
  Qt5::PrintSupport
)

add_subdirectory(officeshots)
