cmake_minimum_required(VERSION 3.31)
project(mibtop)

set(CMAKE_CXX_STANDARD 17)

add_executable(mibtop
        src/main.cpp
        src/monitor.cpp
        src/utils.cpp
)

target_include_directories(mibtop PRIVATE ${PROJECT_SOURCE_DIR}/include)
