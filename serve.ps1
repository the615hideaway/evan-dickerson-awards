$port = 8080
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Evan Dickerson Awards running at http://localhost:$port" -ForegroundColor Yellow
Write-Host "Admin dashboard: http://localhost:$port/admin.html" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  $path = $request.Url.LocalPath
  if ($path -eq '/') { $path = '/index.html' }

  $filePath = Join-Path $root ($path.TrimStart('/').Replace('/', '\'))
  $ext = [System.IO.Path]::GetExtension($filePath)

  if (Test-Path $filePath -PathType Leaf) {
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $response.ContentType = $mime[$ext]
    if (-not $response.ContentType) { $response.ContentType = 'application/octet-stream' }
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $response.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
    $response.OutputStream.Write($msg, 0, $msg.Length)
  }

  $response.Close()
}