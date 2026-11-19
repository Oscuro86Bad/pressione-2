# Genera le icone PNG dell'app con System.Drawing (Windows PowerShell).
# Uso:  powershell -ExecutionPolicy Bypass -File scripts/make-icon.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outDir = Join-Path $root 'icons'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

function Draw-Heart([System.Drawing.Graphics]$g) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.StartFigure()
    $p.AddBezier(256, 448, 146, 370, 64, 300, 64, 196)
    $p.AddBezier(64, 196, 64, 128, 144, 100, 200, 140)
    $p.AddBezier(200, 140, 224, 158, 244, 184, 256, 212)
    $p.AddBezier(256, 212, 268, 184, 288, 158, 312, 140)
    $p.AddBezier(312, 140, 368, 100, 448, 128, 448, 196)
    $p.AddBezier(448, 196, 448, 300, 366, 370, 256, 448)
    $p.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(247, 255, 255, 255))
    $g.FillPath($brush, $p)
    $brush.Dispose()
    $p.Dispose()
}

function Draw-Pulse([System.Drawing.Graphics]$g) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 200, 85, 61)), 20
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $pts = @(
        (New-Object System.Drawing.PointF 112, 258),
        (New-Object System.Drawing.PointF 190, 258),
        (New-Object System.Drawing.PointF 218, 196),
        (New-Object System.Drawing.PointF 262, 326),
        (New-Object System.Drawing.PointF 292, 258),
        (New-Object System.Drawing.PointF 400, 258)
    )
    $g.DrawLines($pen, $pts)
    $pen.Dispose()
}

function New-Icon([int]$size, [string]$file, [bool]$rounded, [double]$contentScale) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $rect = New-Object System.Drawing.RectangleF 0, 0, 512, 512
    $c1 = [System.Drawing.Color]::FromArgb(255, 23, 122, 113)
    $c2 = [System.Drawing.Color]::FromArgb(255, 8, 58, 55)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 135.0

    if ($rounded) {
        $path = New-RoundedPath 0 0 512 512 116
        $g.FillPath($brush, $path)
        $path.Dispose()
    } else {
        $g.FillRectangle($brush, $rect)
    }
    $brush.Dispose()

    # Alone decorativo
    $soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(20, 255, 255, 255))
    $g.FillEllipse($soft, 300, 20, 260, 260)
    $g.FillEllipse($soft, -40, 300, 300, 300)
    $soft.Dispose()

    # Contenuto (cuore + battito), scalato attorno al centro
    $state = $g.Save()
    $g.TranslateTransform(256, 256)
    $g.ScaleTransform([float]$contentScale, [float]$contentScale)
    $g.TranslateTransform(-256, -256)
    Draw-Heart $g
    Draw-Pulse $g
    $g.Restore($state)

    $g.Dispose()
    $target = Join-Path $outDir $file
    $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host ("Creata {0} ({1}x{1})" -f $file, $size)
}

New-Icon 192 'icon-192.png' $true 0.92
New-Icon 512 'icon-512.png' $true 0.92
New-Icon 512 'maskable-512.png' $false 0.66
New-Icon 180 'apple-touch-icon.png' $false 0.86
Write-Host 'Icone generate in' $outDir
