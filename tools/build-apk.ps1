<#
.SYNOPSIS
  微信转账模拟器 - 离线构建可安装 APK（无需 Android Studio / Gradle）
.DESCRIPTION
  依赖：JDK 17+ (JAVA_HOME)、Android SDK 的 platform android-34 与 build-tools 36.0.0+。
  注意 build-tools 必须 >= 36.0.0：34.x 的 d8 解析 javac 21 生成的 MethodParameters 会 NPE。
  产物：dist\微信转账模拟器-<版本>.apk（debug 签名，可直接安装）
  中间文件全部落在系统 TEMP 下的 ASCII 目录，避免 aapt2 处理中文路径失败。
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\build-apk.ps1 -SdkPath C:\Android\Sdk
#>
param(
  [string]$SdkPath = $env:ANDROID_SDK_ROOT,
  [string]$BuildTools = '36.0.0',
  [int]$VersionCode = 1,
  [string]$VersionName = '3.0'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $SdkPath) { throw 'SdkPath 未指定：传 -SdkPath 或设置 ANDROID_SDK_ROOT' }
$bt = Join-Path $SdkPath ("build-tools\$BuildTools")
$ajar = Join-Path $SdkPath 'platforms\android-34\android.jar'
$zxing = Join-Path $root 'android\app\libs\core-3.5.3.jar'
foreach ($p in @($bt, $ajar, $env:JAVA_HOME)) { if (-not (Test-Path $p)) { throw "缺少依赖: $p" } }
$src = Join-Path $root 'android\app\src\main'
$dist = Join-Path $root 'dist'
$stage = Join-Path $env:TEMP ('wxtransfer-build-' + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Force -Path $stage,$dist | Out-Null
try {
  Write-Output "[1/8] 暂存源码 -> $stage"
  Copy-Item -LiteralPath (Join-Path $src 'res') -Destination $stage -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $src 'java') -Destination $stage -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $src 'assets') -Destination $stage -Recurse -Force
  if (-not (Test-Path $zxing)) { throw "缺少二维码解码库: $zxing" }
  $mf = Get-Content -LiteralPath (Join-Path $src 'AndroidManifest.xml') -Raw -Encoding UTF8
  $needle = '<manifest xmlns:android="http://schemas.android.com/apk/res/android">'
  $repl = '<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.cinder.wxtransfer">'
  if (-not $mf.Contains($needle)) { throw 'AndroidManifest.xml 结构变化，找不到 <manifest> 节点' }
  Set-Content -LiteralPath (Join-Path $stage 'AndroidManifest.xml') -Value ($mf.Replace($needle, $repl)) -Encoding UTF8 -NoNewline
  Write-Output '[2/8] aapt2 compile 资源'
  & (Join-Path $bt 'aapt2.exe') compile --dir (Join-Path $stage 'res') -o (Join-Path $stage 'res.zip')
  if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile 失败' }
  Write-Output '[3/8] aapt2 link 打包资源与 assets'
  & (Join-Path $bt 'aapt2.exe') link -o (Join-Path $stage 'base.apk') -I $ajar --manifest (Join-Path $stage 'AndroidManifest.xml') -A (Join-Path $stage 'assets') --min-sdk-version 24 --target-sdk-version 34 --version-code $VersionCode --version-name $VersionName (Join-Path $stage 'res.zip')
  if ($LASTEXITCODE -ne 0) { throw 'aapt2 link 失败' }
  Write-Output '[4/8] javac 编译 Java 源码'
  New-Item -ItemType Directory -Force -Path (Join-Path $stage 'classes') | Out-Null
  $javac = Join-Path $env:JAVA_HOME 'bin\javac.exe'
  & $javac -encoding UTF-8 -source 17 -target 17 -classpath "$ajar;$zxing" -d (Join-Path $stage 'classes') (Join-Path $stage 'java\com\cinder\wxtransfer\MainActivity.java')
  if ($LASTEXITCODE -ne 0) { throw 'javac 失败' }
  Write-Output '[5/8] d8 生成 classes.dex'
  New-Item -ItemType Directory -Force -Path (Join-Path $stage 'dex') | Out-Null
  $cls = (Get-ChildItem (Join-Path $stage 'classes') -Recurse -Filter *.class).FullName
  & (Join-Path $bt 'd8.bat') --lib $ajar --min-api 24 --output (Join-Path $stage 'dex') $cls $zxing
  if ($LASTEXITCODE -ne 0) { throw 'd8 失败（确认 build-tools >= 36.0.0）' }
  Write-Output '[6/8] 合并 dex 进 APK'
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $dexBytes = [System.IO.File]::ReadAllBytes((Join-Path $stage 'dex\classes.dex'))
  $zip = [System.IO.Compression.ZipFile]::Open((Join-Path $stage 'base.apk'), 'Update')
  $old = $zip.GetEntry('classes.dex')
  if ($old) { $old.Delete() }
  $entry = $zip.CreateEntry('classes.dex', [System.IO.Compression.CompressionLevel]::Optimal)
  $stream = $entry.Open()
  $stream.Write($dexBytes, 0, $dexBytes.Length)
  $stream.Close()
  $zip.Dispose()
  Write-Output '[7/8] zipalign 对齐'
  & (Join-Path $bt 'zipalign.exe') -p -f 4 (Join-Path $stage 'base.apk') (Join-Path $stage 'aligned.apk')
  if ($LASTEXITCODE -ne 0) { throw 'zipalign 失败' }
  Write-Output '[8/8] 签名并校验'
  $ks = Join-Path $root 'tools\debug.keystore'
  $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
  if (-not (Test-Path $ks)) {
    & $keytool -genkeypair -keystore $ks -storetype JKS -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=Android,C=US' 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '生成 debug keystore 失败' }
  }
  $apk = Join-Path $dist ("微信转账模拟器-$VersionName.apk")
  & (Join-Path $bt 'apksigner.bat') sign --ks $ks --ks-pass pass:android --key-pass pass:android --v1-signing-enabled true --v2-signing-enabled true --out $apk (Join-Path $stage 'aligned.apk')
  if ($LASTEXITCODE -ne 0) { throw 'apksigner 签名失败' }
  & (Join-Path $bt 'apksigner.bat') verify $apk
  if ($LASTEXITCODE -ne 0) { throw 'apksigner 校验失败' }
  $info = Get-Item $apk
  Write-Output ''
  Write-Output ('OK  ->  ' + $info.FullName)
  Write-Output ('    版本 ' + $VersionName + ' (' + $VersionCode + ')  包名 com.cinder.wxtransfer  大小 ' + $info.Length + ' bytes')
} finally {
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}