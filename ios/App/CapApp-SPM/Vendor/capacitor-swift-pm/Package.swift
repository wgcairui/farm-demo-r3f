// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "capacitor-swift-pm",
    products: [
        .library(
            name: "Capacitor",
            targets: ["Capacitor"]
        ),
        .library(
            name: "Cordova",
            targets: ["Cordova"]
        )
    ],
    dependencies: [],
    targets: [
        // 本地 vendor（原为 github release 下载，本机到 github.com 不通，改为本地引用）
        .binaryTarget(
            name: "Capacitor",
            path: "Frameworks/Capacitor.xcframework.zip"
        ),
        .binaryTarget(
            name: "Cordova",
            path: "Frameworks/Cordova.xcframework.zip"
        )
    ]
)
