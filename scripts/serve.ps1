# Server statico locale per provare Pressione 2.0 senza installare nulla.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts/serve.ps1
# Poi apri http://localhost:8080/
param(
    [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Non riesco ad aprire $prefix" -ForegroundColor Red
    Write-Host "Prova un'altra porta:  powershell -File scripts/serve.ps1 -Port 8090" -ForegroundColor Yellow
    exit 1
}

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.mjs'  = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.webp' = 'image/webp'
    '.ico'  = 'image/x-icon'
    '.sql'  = 'text/plain; charset=utf-8'
    '.txt'  = 'text/plain; charset=utf-8'
    '.md'   = 'text/plain; charset=utf-8'
    '.woff2' = 'font/woff2'
}

Write-Host ""
Write-Host "  PRESSIONE 2.0 - server locale" -ForegroundColor Green
Write-Host "  Cartella: $root"
Write-Host "  Apri:     $prefix" -ForegroundColor Cyan
Write-Host "  (Ctrl+C per fermare)" -ForegroundColor DarkGray
Write-Host ""

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $bytes = $null

        try {
            $path = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
            if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
            $relative = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))

            if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
                $response.StatusCode = 403
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('Accesso negato')
            } elseif (Test-Path $full -PathType Container) {
                $full = Join-Path $full 'index.html'
                if (-not (Test-Path $full)) {
                    $response.StatusCode = 404
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes('Indice non trovato')
                }
            }

            if (-not $bytes) {
                if (Test-Path $full -PathType Leaf) {
                    $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
                    $response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
                    $response.Headers['Cache-Control'] = 'no-store, must-revalidate'
                    $response.Headers['Service-Worker-Allowed'] = '/'
                    $bytes = [System.IO.File]::ReadAllBytes($full)
                } else {
                    $response.StatusCode = 404
                    $response.ContentType = 'text/plain; charset=utf-8'
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes('File non trovato: ' + $path)
                }
            } else {
                $response.ContentType = 'text/plain; charset=utf-8'
            }

            $response.ContentLength64 = $bytes.Length
            if ($request.HttpMethod -ne 'HEAD') {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            Write-Host ("{0} {1} {2}" -f $request.HttpMethod, $response.StatusCode, $path) -ForegroundColor DarkGray
        } catch {
            try {
                $response.StatusCode = 500
                $msg = [System.Text.Encoding]::UTF8.GetBytes('Errore del server locale')
                $response.OutputStream.Write($msg, 0, $msg.Length)
            } catch { }
            Write-Host "Errore: $($_.Exception.Message)" -ForegroundColor Red
        } finally {
            try { $response.Close() } catch { }
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
