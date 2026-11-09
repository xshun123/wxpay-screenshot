# 微信转账模拟器（安卓 · v3）

微信转账/聊天截图生成器：真头像、扫码付款页、转账记录、收款人档案、相机扫码。单文件 Canvas 渲染 + 原生 WebView 外壳，离线可用，导出 750×1624（记录页更长）PNG 直接进相册。

| 项目 | 值 |
|---|---|
| APK | `dist/微信转账模拟器-3.0.apk`（325 KB，v2+v3 签名，可直接安装） |
| 包名 | `com.cinder.wxtransfer` |
| 版本 | 3.0 (versionCode 1) |
| minSdk / targetSdk | 24 / 34（Android 7.0 起） |
| 依赖 | `com.google.zxing:core:3.5.3`（离线放 `android/app/libs/`），无 AndroidX |

## 功能

**1. 真头像**
我的 / 对方各自从相册选一张，缩到 720px 存 JPEG，圆形裁切后渲染进聊天气泡、转账卡片、转账详情、付款页、转账记录。

**2. 扫码（相册 + 相机）**
- **相册选码**：选一张微信收款码截图 → App 内 ZXing 解码 → 认出 `wxp://` 自动跳付款页。
- **相机扫**：WebView `getUserMedia` 实时取景，取景框内自动识别（约每 0.35s 解一帧），相机权限被拒时自动提示改用相册。

**3. 收款人档案（v3 新增，你点头要的那个）**
扫一次码 → 填好昵称和头像 → 点「存当前」，这条档案就按「码指纹 → 昵称 + 头像」存在本地（localStorage）。
**以后再扫同一个收款码，昵称和头像自动带出来**，不用重填。档案列表可「使用 / 删」，最多存 20 条。

> 为什么是这种方案：微信收款码里只编码 `wxp://` 支付标识，昵称头像是微信服务端查的，码本身不带身份。所以「自动出头像名字」只能靠本地档案绑定，这也是能做到的最接近真实的做法。

**4. 转账记录**
多笔支出/收入：头像、金额、对方、说明、时间、状态（已收款/待收款/已退还），顶部自动汇总「共 N 笔 · 支出 ¥X · 收入 ¥Y」，条数变多导出长图不截断。

**5. 聊天多条转账卡片**
`[转账]200.00:饭钱:待收款`（我方右侧橙卡）与 `[收款]88.00:奶茶:已收款`（对方左侧），任意混排。

## 装到手机

1. 把 `dist/微信转账模拟器-3.0.apk` 拷到手机。
2. 点安装，允许「安装未知来源应用」。
3. 桌面绿色 ¥ 图标，打开即用。

首次保存图片：Android 10+ 自动写 `相册/Pictures/微信转账模拟器`；Android 7~9 会弹存储权限，允许后再点「保存 PNG」。

## 界面怎么用

四个页面：**聊天 / 转账详情 / 付款页 / 转账记录**（顶部切换），下方是参数面板。

- **头像**：点「选图片」调系统相册；「清」回退到首字色块。
- **昵称 / 金额 / 说明 / 状态 / 时间 / 日期分隔**：全局共用，四页同步。
- **聊天内容**（一行一条）：
  ```
  对方：在吗？上次那顿饭我先帮你垫了
  我：多少来着，我转你
  对方：200
  我：[转账]200.00:饭钱:待收款
  ```
- **转账记录**：点「+ 加一笔」，每行填 支出/收入、金额、昵称、说明、时间、状态。
- **扫一扫**：「相册选码」或「相机扫」；识别到 `wxp://` 自动切付款页并标「已识别收款码」。
- **收款人档案**：扫完码填好信息点「存当前」；之后再扫同码自动套用。
- **保存 PNG / 复制**：原生 MediaStore / ClipboardItem。

## 目录结构

```
微信转账模拟器/
├─ dist/微信转账模拟器-3.0.apk
├─ preview/{chat,detail,pay,records}.png
├─ web/index.html                   ← 单文件 H5（手机浏览器可直接打开验证）
├─ android/                         ← 标准 Gradle 工程（Android Studio 可打开）
│  └─ app/
│     ├─ build.gradle
│     ├─ libs/core-3.5.3.jar        ← ZXing（离线）
│     └─ src/main/{AndroidManifest.xml, assets/index.html, java/…, res/…}
├─ tools/build-apk.ps1              ← 无 Studio 命令行构建脚本
└─ .github/workflows/build-apk.yml
```

## 自己编译

### A. 命令行（本机已验证）

需要：JDK 17+（`JAVA_HOME`）、Android SDK 的 `platforms/android-34` 与 `build-tools/36.0.0`。

```powershell
powershell -ExecutionPolicy Bypass -File tools\build-apk.ps1 -SdkPath C:\Android\Sdk
```

流程：aapt2 compile → aapt2 link → javac（含 ZXing jar）→ d8 → 合并 dex → zipalign → apksigner。产物进 `dist/`，首次运行生成 `tools/debug.keystore`（密码 `android`）。

> build-tools 必须 **36.0.0+**：34.x 的 d8 解析 javac 21 的 `MethodParameters` 会 NPE。
> 中间文件落在系统 TEMP 的 ASCII 目录 —— aapt2 打不开中文路径。

### B. Android Studio

`File → Open` 选 `android/` → Gradle sync（AGP 8.5.2 / Gradle 8.7）→ `Build → Build APK(s)`。

### C. GitHub Actions

推仓库后 Actions 自动编译，Artifacts 里下 `WeChatTransfer-apk.zip`。

## 实现要点

- 全程 Canvas 2D 手绘，`toDataURL('image/png')` 出图 —— 不用 html-to-image，绕开 WebView 白屏。
- 宽度固定 375 逻辑像素、`SCALE=2`；高度按视图内容动态计算，导出即完整长图。
- 头像 `arc + clip + drawImage` cover 裁切；选图即缩到 720px，控制内存与档案体积。
- 扫码：图片 → base64 → `window.Android.decodeQr()` → Java `BitmapFactory` + ZXing（`RGBLuminanceSource/HybridBinarizer/MultiFormatReader`），失败自动旋转 90/180/270 重试。
- 相机：`getUserMedia` + 每 350ms 抽帧 → 同一套解码桥；Java 侧 `WebChromeClient.onPermissionRequest` 授予 `VIDEO_CAPTURE`，并按需申请 `CAMERA` 运行时权限。
- 档案：`localStorage` 存 `{key(FNV-1a of code), code, name, avatar(dataURL), at}`，上限 20 条。
- 圆角手写 `rr()`（moveTo + arcTo），兼容老 WebView。
- 配色：气泡绿 `#95EC69`、微信绿 `#07C160`、底色 `#EDEDED`、转账橙 `#FA9D3B`、正文 `#191919`、次要 `#888888`、浅字 `#B2B2B2`、分隔线 `#D9D9D9`、已退还灰 `#9A9A9A`。

## 已验证

- APK：`apksigner verify` v2+v3 通过；badging 显示 versionName 3.0、`CAMERA` 权限、图标、启动 Activity 正常。
- dex 含 ZXing；`assets/index.html` 与 `web/index.html` 字节一致。
- 扫码链路：JVM 上用同一套 ZXing 逻辑生成并解码 `wxp://f2f0...` 收款码，内容完全一致。
- 页面：inline script `node --check` 通过；Chromium 无头渲染四个视图 + 控制面板，无脚本报错，`preview/` 是实拍。

> 说明：截图/演示工具，不接支付通道，不产生真实资金流动。


---

## 网站版（微信支付「支付成功」页）

同一套工程里另有一个独立的**网页版**，专门生成微信「支付成功」截图，单文件、无水印、无广告：

- 文件：`site/index.html`（双击即用，或部署成真网站，见 `site/README.md`）
- 功能：头像 / 商品名称 / 支付金额 / 状态文字与颜色 / 状态栏时间与电量 / 完成按钮，全部即时预览
- 导出：750×1624 或 1125×2436 PNG
- 本地预览：`cd site && python -m http.server 8123` → http://127.0.0.1:8123


Made by yuangeluyou.com :)