#!/bin/zsh
# Xcode 27 / iOS 27 SDK 强制 UIScene 生命周期（TN3187），Expo SDK 57 prebuild 模板
# 尚未适配（expo#46664 / facebook/react-native#54739），启动即崩：
#   EXC_BREAKPOINT @ UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption
# 本脚本对 prebuild 产物打补丁（幂等，prebuild 后需重跑）：
#   1. Info.plist 注入 UIApplicationSceneManifest → SceneDelegate
#   2. AppDelegate.swift 去掉 window 生命周期启动，追加 SceneDelegate 桥接 RN
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/apps/mobile/ios/Farm3DDemo"
PLIST="$DIR/Info.plist"
DELEGATE="$DIR/AppDelegate.swift"

# 1) Info.plist: 注入 scene manifest
if ! grep -q "UIApplicationSceneManifest" "$PLIST"; then
  python3 - "$PLIST" <<'PYEOF'
import sys
p = sys.argv[1]
s = open(p).read()
manifest = """<key>UIApplicationSceneManifest</key>
	<dict>
		<key>UIApplicationSupportsMultipleScenes</key>
		<false/>
		<key>UISceneConfigurations</key>
		<dict>
			<key>UIWindowSceneSessionRoleApplication</key>
			<array>
				<dict>
					<key>UISceneConfigurationName</key>
					<string>Default</string>
					<key>UISceneDelegateClassName</key>
					<string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
				</dict>
			</array>
		</dict>
	</dict>
"""
# 插在第一个 <dict> 之后
idx = s.index("<dict>") + len("<dict>")
open(p, "w").write(s[:idx] + "\n\t" + manifest + s[idx:])
PYEOF
  echo "Info.plist: 已注入 UIApplicationSceneManifest"
else
  echo "Info.plist: 已有 scene manifest，跳过"
fi

# 2) AppDelegate.swift: 替换为 scene 生命周期版本
if ! grep -q "SceneDelegate" "$DELEGATE"; then
  cat > "$DELEGATE" <<'SWIFTEOF'
internal import Expo
import React
import ReactAppDependencyProvider

// Xcode 27 (iOS 27 SDK) 强制 UIScene 生命周期（TN3187）。
// Expo SDK 57 prebuild 模板仍是 window 生命周期，启动即崩（expo#46664），
// 官方修复合并前由本文件 + Info.plist 的 UIApplicationSceneManifest 承接。
@main
class AppDelegate: ExpoAppDelegate {
  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let appDelegate = UIApplication.shared.delegate as! AppDelegate
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    appDelegate.reactNativeDelegate = delegate
    appDelegate.reactNativeFactory = factory

    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: nil)
    self.window = window
    window.makeKeyAndVisible()
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
SWIFTEOF
  echo "AppDelegate.swift: 已迁移到 UIScene 生命周期"
else
  echo "AppDelegate.swift: 已含 SceneDelegate，跳过"
fi
