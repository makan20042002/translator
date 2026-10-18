param(
    [string]$ImagePath = "",
    [string]$Language = "",
    [switch]$ListLanguages
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

if ($ListLanguages) {
    $langs = @()
    foreach ($l in [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages) {
        $langs += @{
            tag = $l.LanguageTag
            displayName = $l.DisplayName
            nativeName = $l.NativeName
        }
    }
    @{ ok = $true; languages = $langs } | ConvertTo-Json -Compress
    exit 0
}

if (-not $ImagePath -or -not (Test-Path $ImagePath)) {
    @{ ok = $false; error = "Image file not found: $ImagePath" } | ConvertTo-Json -Compress
    exit 1
}

# WinRT decoder
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeBufferExtensions, System.Runtime.WindowsRuntime, ContentType = WindowsRuntime] | Out-Null

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod
})[0]

function AwaitTask($asyncOp) {
    $retType = $asyncOp.GetType().GetGenericArguments()[0]
    $m = $asTaskGeneric.MakeGenericMethod($retType)
    $task = $m.Invoke($null, @($asyncOp))
    $task.Wait()
    return $task.Result
}

$fullPath = [System.IO.Path]::GetFullPath($ImagePath)
$fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($fullPath)
$file = AwaitTask $fileOp

$streamOp = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
$stream = AwaitTask $streamOp

$decOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
$decoder = AwaitTask $decOp

$bmpOp = $decoder.GetSoftwareBitmapAsync()
$softwareBmp = AwaitTask $bmpOp

$engine = $null
if ($Language -and $Language -ne "auto") {
    $langObj = [Windows.Globalization.Language]::new($Language)
    if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($langObj)) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($langObj)
    } else {
        $avail = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag })
        @{
            ok = $false
            error = "Windows OCR language '$Language' is not installed."
            languageNotInstalled = $true
            requestedLanguage = $Language
            availableLanguages = $avail
            installationGuidance = "To add language OCR support: Open Windows Settings > Time & Language > Language & region > Add a language (ensure Optical Character Recognition is checked)."
        } | ConvertTo-Json -Compress
        exit 1
    }
}

if ($null -eq $engine) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if ($null -eq $engine) {
    $first = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -First 1
    if ($first) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($first) }
}

if ($null -eq $engine) {
    @{ ok = $false; error = "No OCR engine available on this system." } | ConvertTo-Json -Compress
    exit 1
}

$recOp = $engine.RecognizeAsync($softwareBmp)
$ocrRes = AwaitTask $recOp

$lines = @()
foreach ($l in $ocrRes.Lines) {
    $words = @()
    foreach ($w in $l.Words) {
        $words += @{
            text = $w.Text
            x = [int]$w.BoundingRect.X
            y = [int]$w.BoundingRect.Y
            width = [int]$w.BoundingRect.Width
            height = [int]$w.BoundingRect.Height
        }
    }
    $lines += @{
        text = $l.Text
        words = $words
    }
}

@{
    ok = $true
    text = $ocrRes.Text
    angle = $ocrRes.TextAngle
    language = $engine.RecognizerLanguage.LanguageTag
    lines = $lines
} | ConvertTo-Json -Compress -Depth 5
