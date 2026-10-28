# 카카오 로컬 API 키 저장 (이 PC에만 저장, 코드·zip에는 들어가지 않음)
# 발급: https://developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가 → 앱 키의 'REST API 키'
#       (필요하면 제품 설정 → 카카오맵 → 사용 설정 ON)
$dir = Join-Path $env:APPDATA "powercat-onboarding"
$file = Join-Path $dir "kakao-key.txt"
Write-Host ""
Write-Host "카카오 장소 검색 키 설정" -ForegroundColor Cyan
Write-Host "developers.kakao.com 의 내 애플리케이션 → 앱 키에서 'REST API 키'를 복사해 붙여넣으세요."
if (Test-Path $file) { Write-Host "이미 저장된 키가 있어요. 새로 입력하면 덮어씁니다." -ForegroundColor Yellow }
Write-Host ""
$sec = Read-Host "REST API 키 (입력해도 화면에 보이지 않아요)" -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
if (-not $key) { Write-Host "키를 입력하지 않았어요. 저장하지 않았습니다." -ForegroundColor Red; exit 1 }

# 저장 전에 실제로 검색이 되는지 확인
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
  $req = [Net.HttpWebRequest]::Create("https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=" + [Uri]::EscapeDataString("청주 청남대"))
  $req.Headers.Add("Authorization", "KakaoAK " + $key)
  $req.GetResponse().Close()
  Write-Host "검색 확인 완료!" -ForegroundColor Green
} catch [Net.WebException] {
  $code = $(if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 })
  if ($code -eq 401) { Write-Host "키가 맞지 않아요(401). 'REST API 키'를 복사했는지 확인하세요. 저장하지 않았습니다." -ForegroundColor Red; exit 1 }
  if ($code -eq 403) { Write-Host "앱에서 카카오맵 사용이 꺼져 있어요(403). 내 애플리케이션 → 제품 설정 → 카카오맵 → 사용 설정을 ON 한 뒤 다시 실행하세요. 키는 저장해 둘게요." -ForegroundColor Yellow }
  else { Write-Host "확인 요청이 실패했어요($code). 인터넷 연결을 확인하세요. 키는 저장해 둘게요." -ForegroundColor Yellow }
}

New-Item -ItemType Directory -Force $dir | Out-Null
[IO.File]::WriteAllLines($file, @($key), (New-Object Text.UTF8Encoding $false))
Write-Host ""
Write-Host "저장했어요: $file" -ForegroundColor Green
Write-Host "실행.bat 으로 앱을 다시 켜면 '우리 지역 알려주기' 등록 팝업에서 카카오 검색이 됩니다."
