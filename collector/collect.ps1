# 한전 전력데이터개방포털 「계약종별 전력사용량」 API로 시군구별 월간 판매수입·고객호수·전력사용량을 모아
# js/region-data.js 를 만든다. 지역 화면은 이 파일이 있으면 샘플 대신 실데이터를 보여준다.
# API 명세: https://bigdata.kepco.co.kr/cmsmain.do?scode=S01&pcode=000493&pstate=cntr&redirect=Y
param(
  [string]$MetroName = '충청북도',
  [string]$Hq = '충북본부',
  [int]$Months = 12,
  [switch]$Mock  # API 키 없이 화면 연동을 시험할 때: 명세 형식의 가짜 응답 사용
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$base = 'https://bigdata.kepco.co.kr/openapi/v1'
$outFile = [IO.Path]::GetFullPath((Join-Path $here '..\js\region-data.js'))
# 키는 공유 폴더 밖(사용자 프로필)에 저장해 zip으로 퍼지지 않게 한다
$keyFile = Join-Path $env:APPDATA 'powercat-onboarding\kepco-key.txt'

function Get-ApiKey {
  if ($env:KEPCO_API_KEY) { return $env:KEPCO_API_KEY.Trim() }
  if (Test-Path $keyFile) { $k = (Get-Content $keyFile -Raw).Trim(); if ($k) { return $k } }
  $k = (Read-Host '전력데이터개방포털 API 인증키(40자리)를 붙여넣고 Enter').Trim()
  if ($k.Length -lt 20) { throw 'API 키 형식이 올바르지 않습니다.' }
  New-Item -ItemType Directory -Force (Split-Path $keyFile) | Out-Null
  [IO.File]::WriteAllText($keyFile, $k)
  Write-Host "키를 저장했습니다: $keyFile (프로젝트 폴더 밖이라 공유되지 않습니다)"
  return $k
}

# PowerShell 5.1은 charset 없는 응답을 깨뜨리므로 바이트를 받아 UTF-8로 직접 디코딩
function Invoke-Kepco([string]$path, [hashtable]$query) {
  $qs = ($query.GetEnumerator() | ForEach-Object { $_.Key + '=' + [uri]::EscapeDataString([string]$_.Value) }) -join '&'
  try {
    $res = Invoke-WebRequest -Uri "$base/$path`?$qs" -Method Get -UseBasicParsing -TimeoutSec 30
  } catch {
    $body = $_.ErrorDetails.Message
    if ($body -match '"404"|NotFound') { return [pscustomobject]@{ data = @() } } # 해당 월 자료 없음
    if ($body -match 'InvalidApiKey|"401"') {
      throw "API 키가 올바르지 않거나 아직 승인 전입니다. 키를 다시 넣으려면 이 파일을 지우고 재실행하세요: $keyFile"
    }
    throw "API 호출 실패 ($path): $body"
  }
  $text = [Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray())
  try { return $text | ConvertFrom-Json } catch { throw "API 응답을 읽을 수 없습니다: $($text.Substring(0, [Math]::Min(200, $text.Length)))" }
}

# ---------- 모의 응답 (명세의 필드명 그대로) ----------
$mockCities = '청주시 상당구', '청주시 서원구', '청주시 흥덕구', '청주시 청원구', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'
$mockCntr = '주택용', '일반용', '교육용', '산업용', '농사용', '가로등', '심야'
function Get-MockMonth([int]$y, [int]$m) {
  $rows = @()
  foreach ($c in $mockCities) {
    $seed = [Math]::Abs(($c.GetHashCode() -bxor ($y * 100 + $m)) % 100000)
    $rnd = New-Object Random $seed
    foreach ($t in $mockCntr) {
      $cust = $rnd.Next(200, 60000); $use = $cust * $rnd.Next(250, 4000); $cost = 100 + $rnd.NextDouble() * 80
      $rows += [pscustomobject]@{ year = "$y"; month = ('{0:D2}' -f $m); metro = $MetroName; city = $c; cntr = $t
        custCnt = $cust; powerUsage = $use; bill = [long]($use * $cost); unitCost = [Math]::Round($cost, 1); cntrPwr = $cust * 5 }
    }
  }
  return $rows
}

# ---------- 수집 ----------
if ($Mock) { Write-Host '모의 데이터로 만듭니다 (실데이터 아님).'; $metroCd = '00' }
else {
  $apiKey = Get-ApiKey
  # 사용량 API는 법정동 시도코드를 받는다 (일반 metroCd로는 서울 외 지역이 NotFound)
  $codes = Invoke-Kepco 'commonCode.do' @{ codeTy = 'lglDngMetroCd'; apiKey = $apiKey; returnType = 'json' }
  $metro = @($codes.data) | Where-Object { $_.codeNm -eq $MetroName } | Select-Object -First 1
  if (-not $metro) { throw "시도 코드에서 '$MetroName'을(를) 찾지 못했습니다." }
  $metroCd = $metro.code
  Write-Host "$MetroName 시도코드: $metroCd"
}

# 최근 달부터 거꾸로 조회해 자료가 있는 달을 $Months개 모은다 (공개는 보통 1~2개월 늦음)
$monthly = [ordered]@{}
$cursor = (Get-Date -Day 1).AddMonths(-1)
for ($i = 0; $i -lt $Months + 6 -and $monthly.Count -lt $Months; $i++) {
  $y = $cursor.Year; $m = $cursor.Month; $ym = '{0}-{1:D2}' -f $y, $m
  if ($Mock) { $rows = Get-MockMonth $y $m }
  else {
    $res = Invoke-Kepco 'powerUsage/contractType.do' @{ year = "$y"; month = ('{0:D2}' -f $m); metroCd = $metroCd; apiKey = $apiKey; returnType = 'json' }
    $rows = @($res.data) | Where-Object { $_ }
  }
  if ($rows.Count) { $monthly[$ym] = $rows; Write-Host "$ym : $($rows.Count)건" } else { Write-Host "$ym : 자료 없음" }
  $cursor = $cursor.AddMonths(-1)
}
if (-not $monthly.Count) { throw '조회된 자료가 없습니다. 키 승인 상태나 조회 기간을 확인해 주세요.' }

# ---------- 시군구별 합계 (계약종별을 더함) ----------
$ymList = @($monthly.Keys | Sort-Object)
$latest = $ymList[-1]
function Sum-Rows($rows) {
  $s = @{ custCnt = 0L; powerUsage = 0L; bill = 0L }
  foreach ($r in $rows) { $s.custCnt += [long]$r.custCnt; $s.powerUsage += [long]$r.powerUsage; $s.bill += [long]$r.bill }
  return $s
}
# 계약종별 사용량·고객호수 (지역 특성 비교용)
function Sum-ByCntr($rows) {
  $o = [ordered]@{}
  foreach ($t in @($rows | ForEach-Object { $_.cntr } | Select-Object -Unique)) {
    $s = Sum-Rows (@($rows) | Where-Object { $_.cntr -eq $t })
    $o[($t -replace '\s', '')] = [ordered]@{ custCnt = $s.custCnt; powerUsage = $s.powerUsage; bill = $s.bill }
  }
  return $o
}
$cityNames = @($monthly[$latest] | ForEach-Object { $_.city } | Select-Object -Unique)
$cities = @(foreach ($c in $cityNames) {
  $now = Sum-Rows (@($monthly[$latest]) | Where-Object { $_.city -eq $c })
  $trend = @(foreach ($ym in $ymList) {
    $t = Sum-Rows (@($monthly[$ym]) | Where-Object { $_.city -eq $c })
    [ordered]@{ ym = $ym; custCnt = $t.custCnt; powerUsage = $t.powerUsage; bill = $t.bill }
  })
  [ordered]@{ city = $c; custCnt = $now.custCnt; powerUsage = $now.powerUsage; bill = $now.bill; trend = $trend
    byCntr = (Sum-ByCntr (@($monthly[$latest]) | Where-Object { $_.city -eq $c })) }
})
$contracts = @(foreach ($t in @($monthly[$latest] | ForEach-Object { $_.cntr } | Select-Object -Unique)) {
  $s = Sum-Rows (@($monthly[$latest]) | Where-Object { $_.cntr -eq $t })
  [ordered]@{ cntr = $t; custCnt = $s.custCnt; powerUsage = $s.powerUsage; bill = $s.bill }
})

# ---------- 전국 시도 비교 (최신 월) : 신입사원에게 "우리 지역이 다른 곳과 어떻게 다른지" 보여 주기 위함 ----------
$ly, $lm = $latest.Split('-')
$metroRows = @()
if ($Mock) {
  $i = 0
  foreach ($n in '서울특별시', '부산광역시', '대구광역시', '인천광역시', '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청남도', '전북특별자치도', '전남광주통합특별시', '경상북도', '경상남도', '제주특별자치도') {
    $i++; $metroRows += Get-MockMonth ([int]$ly) ([int]$lm) | ForEach-Object { $_.metro = $n; $_.custCnt = [long]($_.custCnt * (0.5 + ($i % 5) * 0.4)); $_ }
  }
  $metroRows += @($monthly[$latest])
} else {
  foreach ($m in @($codes.data)) {
    $res = Invoke-Kepco 'powerUsage/contractType.do' @{ year = $ly; month = $lm; metroCd = $m.code; apiKey = $apiKey; returnType = 'json' }
    $metroRows += @($res.data) | Where-Object { $_ }
  }
}
$metros = @(foreach ($n in @($metroRows | ForEach-Object { $_.metro } | Select-Object -Unique)) {
  $rows = @($metroRows) | Where-Object { $_.metro -eq $n }
  $s = Sum-Rows $rows
  [ordered]@{ metro = $n; custCnt = $s.custCnt; powerUsage = $s.powerUsage; bill = $s.bill; byCntr = (Sum-ByCntr $rows) }
})
Write-Host "전국 비교: $($metros.Count)개 시도 ($latest)"

$data = [ordered]@{
  source = '한국전력공사 전력데이터개방포털 「계약종별 전력사용량」'
  mock = [bool]$Mock
  hq = $Hq; metro = $MetroName; collectedAt = (Get-Date -Format 'yyyy-MM-dd HH:mm')
  latest = $latest; months = $ymList; cities = $cities; contracts = $contracts; metros = $metros
}
$js = "// collector/collect.ps1 이 만든 파일입니다. 직접 고치지 말고 수집을 다시 실행하세요.`nwindow.OB = window.OB || {};`nOB.regionData = " + ($data | ConvertTo-Json -Depth 8 -Compress) + ";`n"
[IO.File]::WriteAllText($outFile, $js, (New-Object Text.UTF8Encoding $false))
Write-Host "완료: $outFile ($latest 기준, 시군구 $($cities.Count)곳, $($ymList.Count)개월)"
