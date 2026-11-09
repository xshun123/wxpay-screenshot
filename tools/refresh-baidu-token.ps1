# 刷新百度 OCR access_token（30 天有效），写到 docs/ocr-token.json
# 用法：
#   $env:BAIDU_AK="你的 API Key"; $env:BAIDU_SK="你的 Secret Key"
#   powershell -ExecutionPolicy Bypass -File tools\refresh-baidu-token.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ak = $env:BAIDU_AK
$sk = $env:BAIDU_SK
if (-not $ak -or -not $sk) { throw '请先设置环境变量 BAIDU_AK / BAIDU_SK' }

$url = "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=$ak&client_secret=$sk"
$resp = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 30
if (-not $resp.access_token) { throw '拿不到 access_token，检查 AK/SK' }

$obj = @{
  token = $resp.access_token
  exp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + [int64]$resp.expires_in * 1000
  note = 'baidu ocr token, refresh by tools/refresh-baidu-token.ps1'
}
$json = $obj | ConvertTo-Json -Depth 3
foreach ($p in @("$root\docs\ocr-token.json", "$root\site\ocr-token.json")) {
  Set-Content -LiteralPath $p -Value $json -Encoding UTF8
  Write-Output ("written: " + $p)
}
Write-Output ('token 有效期至: ' + [DateTimeOffset]::FromUnixTimeMilliseconds($obj.exp).ToLocalTime())
