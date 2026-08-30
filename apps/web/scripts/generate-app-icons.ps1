param(
    [string]$MasterPath = (Join-Path $PSScriptRoot '..\assets\brand\agm-app-icon-dual-route-master.png'),
    [string]$AndroidMasterPath = (Join-Path $PSScriptRoot '..\assets\brand\agm-android-icon-master.png')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$webRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedMaster = [System.IO.Path]::GetFullPath($MasterPath)
$resolvedAndroidMaster = [System.IO.Path]::GetFullPath($AndroidMasterPath)
$publicIcons = Join-Path $webRoot 'public\icons'
$windowsIcons = Join-Path $publicIcons 'windows'
$androidRes = Join-Path $webRoot 'android\app\src\main\res'

[System.IO.Directory]::CreateDirectory($publicIcons) | Out-Null
[System.IO.Directory]::CreateDirectory($windowsIcons) | Out-Null

function Save-SquarePng {
    param(
        [System.Drawing.Image]$Source,
        [int]$Size,
        [string]$Destination,
        [switch]$Round
    )

    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        if ($Round) {
            $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
            try {
                $clip.AddEllipse(0, 0, $Size, $Size)
                $graphics.SetClip($clip)
                $graphics.DrawImage($Source, 0, 0, $Size, $Size)
            }
            finally {
                $clip.Dispose()
            }
        }
        else {
            $graphics.DrawImage($Source, 0, 0, $Size, $Size)
        }
        $directory = [System.IO.Path]::GetDirectoryName($Destination)
        [System.IO.Directory]::CreateDirectory($directory) | Out-Null
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Write-MultiSizeIco {
    param(
        [string[]]$PngPaths,
        [int[]]$Sizes,
        [string]$Destination
    )

    $payloads = @($PngPaths | ForEach-Object { ,([System.IO.File]::ReadAllBytes($_)) })
    $stream = [System.IO.File]::Create($Destination)
    $writer = [System.IO.BinaryWriter]::new($stream)
    try {
        $writer.Write([uint16]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]$payloads.Count)
        $offset = 6 + (16 * $payloads.Count)
        for ($index = 0; $index -lt $payloads.Count; $index++) {
            $sizeByte = if ($Sizes[$index] -eq 256) { 0 } else { $Sizes[$index] }
            $writer.Write([byte]$sizeByte)
            $writer.Write([byte]$sizeByte)
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([uint16]1)
            $writer.Write([uint16]32)
            $writer.Write([uint32]$payloads[$index].Length)
            $writer.Write([uint32]$offset)
            $offset += $payloads[$index].Length
        }
        foreach ($payload in $payloads) {
            $writer.Write($payload)
        }
    }
    finally {
        $writer.Dispose()
        $stream.Dispose()
    }
}

$source = [System.Drawing.Image]::FromFile($resolvedMaster)
try {
    if ($source.Width -ne $source.Height) {
        throw "Application icon master must be square; received $($source.Width)x$($source.Height)."
    }

    foreach ($size in @(180, 192, 512)) {
        $name = if ($size -eq 180) { 'agm-app-icon-apple-180.png' } else { "agm-app-icon-$size.png" }
        Save-SquarePng -Source $source -Size $size -Destination (Join-Path $publicIcons $name)
    }
    foreach ($size in @(192, 512)) {
        Save-SquarePng -Source $source -Size $size -Destination (Join-Path $publicIcons "agm-app-icon-maskable-$size.png")
    }

    $windowsSizes = @(16, 24, 32, 48, 64, 128, 256)
    $windowsPngs = @()
    foreach ($size in $windowsSizes) {
        $path = Join-Path $windowsIcons "agm-cockpit-$size.png"
        Save-SquarePng -Source $source -Size $size -Destination $path
        $windowsPngs += $path
    }
    Write-MultiSizeIco -PngPaths $windowsPngs -Sizes $windowsSizes -Destination (Join-Path $publicIcons 'agm-cockpit.ico')

}
finally {
    $source.Dispose()
}

# Android remains an independent application surface. Its approved launcher
# artwork must never be regenerated from the website/Windows icon master.
$androidSource = [System.Drawing.Image]::FromFile($resolvedAndroidMaster)
try {
    if ($androidSource.Width -ne $androidSource.Height) {
        throw "Android icon master must be square; received $($androidSource.Width)x$($androidSource.Height)."
    }
    $androidDensities = [ordered]@{
        'mdpi' = @{ Legacy = 48; Foreground = 108 }
        'hdpi' = @{ Legacy = 72; Foreground = 162 }
        'xhdpi' = @{ Legacy = 96; Foreground = 216 }
        'xxhdpi' = @{ Legacy = 144; Foreground = 324 }
        'xxxhdpi' = @{ Legacy = 192; Foreground = 432 }
    }
    foreach ($density in $androidDensities.Keys) {
        $destination = Join-Path $androidRes "mipmap-$density"
        $legacySize = $androidDensities[$density].Legacy
        $foregroundSize = $androidDensities[$density].Foreground
        Save-SquarePng -Source $androidSource -Size $legacySize -Destination (Join-Path $destination 'ic_launcher.png')
        Save-SquarePng -Source $androidSource -Size $legacySize -Destination (Join-Path $destination 'ic_launcher_round.png') -Round
        Save-SquarePng -Source $androidSource -Size $foregroundSize -Destination (Join-Path $destination 'ic_launcher_foreground.png')
    }
}
finally {
    $androidSource.Dispose()
}

Write-Output "AGM website/Windows icons generated from $resolvedMaster"
Write-Output "AGM Android icons generated independently from $resolvedAndroidMaster"
