# 로컬 서버: 정적 파일 + 장소 검색 중계(/api/place-search)
#   powershell -File serve.ps1 -Root . -Port 8770
# 카카오 로컬 API 키(REST API 키)가 브라우저에 노출되지 않도록 이 서버가 대신 호출한다.
# 키 위치: 환경변수 KAKAO_REST_KEY, 또는 %APPDATA%\powercat-onboarding\kakao-key.txt (1줄)
param([string]$Root = (Get-Location).Path, [int]$Port = 8765)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$types = @{ ".html" = "text/html; charset=utf-8"; ".png" = "image/png"; ".css" = "text/css"; ".js" = "text/javascript"; ".md" = "text/plain; charset=utf-8"; ".json" = "application/json; charset=utf-8" }
$keyFile = Join-Path $env:APPDATA "powercat-onboarding\kakao-key.txt"

function Get-KakaoKey {
  if ($env:KAKAO_REST_KEY) { return $env:KAKAO_REST_KEY.Trim() }
  if (Test-Path $keyFile) {
    $k = @(Get-Content $keyFile -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($k.Count -ge 1) { return $k[0] }
  }
  return $null
}

# HttpListener의 QueryString은 한글을 시스템 인코딩(CP949)으로 풀어 깨지므로 UTF-8로 직접 해석
function Get-Query($ctx, [string]$name) {
  foreach ($pair in $ctx.Request.Url.Query.TrimStart('?').Split('&')) {
    $kv = $pair.Split('=', 2)
    if ($kv[0] -eq $name -and $kv.Count -eq 2) { return [Uri]::UnescapeDataString($kv[1].Replace('+', ' ')) }
  }
  return $null
}

function Send-Json($ctx, [int]$status, [string]$json) {
  $b = [Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = "application/json; charset=utf-8"
  $ctx.Response.OutputStream.Write($b, 0, $b.Length)
}

# 카카오 키워드 장소 검색 (최대 15건). 결과 JSON을 그대로 돌려준다.
function Search-Kakao($ctx) {
  $key = Get-KakaoKey
  if (-not $key) { Send-Json $ctx 503 '{"error":"nokey"}'; return }
  $q = Get-Query $ctx "q"
  if (-not $q -or $q.Trim().Length -lt 1) { Send-Json $ctx 400 '{"error":"noquery"}'; return }
  $url = "https://dapi.kakao.com/v2/local/search/keyword.json?size=15&query=" + [Uri]::EscapeDataString($q.Trim())
  $cat = Get-Query $ctx "cat"
  if ($cat -match '^[A-Z]{2}\d$') { $url += "&category_group_code=" + $cat }
  try {
    $req = [Net.HttpWebRequest]::Create($url)
    $req.Headers.Add("Authorization", "KakaoAK " + $key)
    $req.Timeout = 8000
    $res = $req.GetResponse()
    $sr = New-Object IO.StreamReader($res.GetResponseStream(), [Text.Encoding]::UTF8)
    $body = $sr.ReadToEnd(); $sr.Close(); $res.Close()
    Send-Json $ctx 200 $body
  } catch [Net.WebException] {
    $code = 502
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    # 401: 키 오류 / 403: 앱에서 카카오맵 사용 설정이 꺼져 있음 / 429: 한도 초과
    $err = $(if ($code -eq 401) { "badkey" } elseif ($code -eq 403) { "disabled" } elseif ($code -eq 429) { "limit" } else { "upstream" })
    Send-Json $ctx $code ('{"error":"' + $err + '"}')
  }
}

$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $Root on http://localhost:$Port/"
Write-Host $(if (Get-KakaoKey) { "카카오 장소 검색: 사용 가능" } else { "카카오 장소 검색: 키 없음 (카카오키설정.bat 실행)" })
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    if ($p -eq "api/place-search/status") { Send-Json $c 200 $(if (Get-KakaoKey) { '{"kakao":true}' } else { '{"kakao":false}' }) }
    elseif ($p -eq "api/place-search") { Search-Kakao $c }
    else {
      if ($p -eq "" -or $p.EndsWith("/")) { $p += "index.html" }
      $f = Join-Path $Root $p
      if (Test-Path $f -PathType Leaf) {
        $b = [IO.File]::ReadAllBytes($f)
        $ext = [IO.Path]::GetExtension($f).ToLower()
        $c.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" })
        $c.Response.OutputStream.Write($b, 0, $b.Length)
      } else { $c.Response.StatusCode = 404 }
    }
  } catch { $c.Response.StatusCode = 500 }
  $c.Response.Close()
}
