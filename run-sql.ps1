param([string]$SqlFile)

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error "Set SUPABASE_ACCESS_TOKEN env var first"
  exit 1
}

$sql = Get-Content -LiteralPath $SqlFile -Raw

# Escape the SQL for JSON: escape backslashes, quotes, newlines, tabs
$escaped = $sql -replace '\\', '\\'
$escaped = $escaped -replace '"', '\"'
$escaped = $escaped -replace "`r`n", '\n'
$escaped = $escaped -replace "`n", '\n'
$escaped = $escaped -replace "`t", '\t'

$bodyStr = "{`"query`": `"$escaped`"}"

$headers = @{
  "Authorization" = "Bearer $env:SUPABASE_ACCESS_TOKEN"
  "Content-Type" = "application/json"
}

try {
  $response = Invoke-WebRequest -Uri "https://api.supabase.com/v1/projects/yenkuvvumgmuyvjludeg/database/query" `
    -Method POST -Headers $headers -Body $bodyStr
  Write-Host "Status: $($response.StatusCode)"
  Write-Host $response.Content
} catch {
  Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
  $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
  Write-Host $reader.ReadToEnd()
  $reader.Close()
}
