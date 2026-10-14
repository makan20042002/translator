Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\brand\makanlab-square-icon.png"
if (-not (Test-Path $srcPath)) {
    Write-Error "Source icon not found at $srcPath"
    exit 1
}

$destDirs = @(
    (Join-Path $PSScriptRoot "..\assets"),
    (Join-Path $PSScriptRoot "..\..\exe translator\assets")
)

foreach ($d in $destDirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)

function Resize-Image($image, $width, $height) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($image, 0, 0, $width, $height)
    $g.Dispose()
    return $bmp
}

function Image-ToPngBytes($bmp) {
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    return $bytes
}

# Generate PNGs
$bmp256 = Resize-Image $srcImg 256 256
$bmp32 = Resize-Image $srcImg 32 32

foreach ($d in $destDirs) {
    $bmp256.Save((Join-Path $d "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp32.Save((Join-Path $d "tray.png"), [System.Drawing.Imaging.ImageFormat]::Png)
}

# Generate Multi-size ICO: 16, 24, 32, 48, 64, 128, 256
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngDataList = @()

foreach ($sz in $sizes) {
    $resized = Resize-Image $srcImg $sz $sz
    $pngBytes = Image-ToPngBytes $resized
    $resized.Dispose()
    $pngDataList += ,@($sz, $pngBytes)
}

$srcImg.Dispose()
$bmp256.Dispose()
$bmp32.Dispose()

# Build ICO binary
$msIco = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($msIco)

# Header
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type: ICO
$bw.Write([uint16]$pngDataList.Count) # Count

$offset = 6 + ($pngDataList.Count * 16)

for ($i = 0; $i -lt $pngDataList.Count; $i++) {
    $sz = $pngDataList[$i][0]
    [byte[]]$dataBytes = $pngDataList[$i][1]

    $wByte = if ($sz -eq 256) { [byte]0 } else { [byte]$sz }
    $hByte = if ($sz -eq 256) { [byte]0 } else { [byte]$sz }

    $bw.Write($wByte) # Width
    $bw.Write($hByte) # Height
    $bw.Write([byte]0) # Color count
    $bw.Write([byte]0) # Reserved
    $bw.Write([uint16]1) # Color planes
    $bw.Write([uint16]32) # Bits per pixel
    $bw.Write([uint32]$dataBytes.Length) # Image size in bytes
    $bw.Write([uint32]$offset) # Offset

    $offset += $dataBytes.Length
}

# Image data
for ($i = 0; $i -lt $pngDataList.Count; $i++) {
    [byte[]]$bytesToWrite = $pngDataList[$i][1]
    $bw.Write($bytesToWrite, 0, $bytesToWrite.Length)
}

$icoBytes = $msIco.ToArray()
$bw.Dispose()
$msIco.Dispose()

foreach ($d in $destDirs) {
    $icoPath = Join-Path $d "icon.ico"
    [System.IO.File]::WriteAllBytes($icoPath, $icoBytes)
    Write-Host "Created $icoPath ($($icoBytes.Length) bytes)"
}
