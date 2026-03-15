if(NOT TARGET react-native-vision-camera::VisionCamera)
add_library(react-native-vision-camera::VisionCamera SHARED IMPORTED)
set_target_properties(react-native-vision-camera::VisionCamera PROPERTIES
    IMPORTED_LOCATION "C:/Users/bomst/projects/time-delay/node_modules/react-native-vision-camera/android/build/intermediates/cxx/Debug/6i253i1n/obj/x86/libVisionCamera.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/bomst/projects/time-delay/node_modules/react-native-vision-camera/android/build/headers/visioncamera"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

