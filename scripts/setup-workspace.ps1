$Root = "D:\PrintCut"
$folders = @("inbox", "jobs", "output", "archive", "error", "logs")

foreach ($folder in $folders) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root $folder) | Out-Null
}

Write-Host ""
Write-Host "Created Print/Cut workspace at:"
Write-Host $Root
Write-Host ""
Write-Host "Drop artwork into:"
Write-Host (Join-Path $Root "inbox")
