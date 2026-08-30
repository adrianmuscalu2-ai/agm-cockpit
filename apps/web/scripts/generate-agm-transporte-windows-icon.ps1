param(
    [string]$MasterPath = (Join-Path $PSScriptRoot '..\assets\brand\agm-android-icon-master.png')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$webRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedMaster = [System.IO.Path]::GetFullPath($MasterPath)
$publicIcons = Join-Path $webRoot 'public\icons'
$windowsIcons = Join-Path $publicIcons 'windows'
[System.IO.Directory]::CreateDirectory($windowsIcons) | Out-Null

function Save-SquarePng {
    param(
        [System.Drawing.Image]$Source,
        [int]$Size,
        [string]$Destination
    )

    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($Source, 0, 0, $Size, $Size)
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
        throw "AGM Transporte icon master must be square; received $($source.Width)x$($source.Height)."
    }

    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $pngPaths = foreach ($size in $sizes) {
        $path = Join-Path $windowsIcons "agm-transporte-$size.png"
        Save-SquarePng -Source $source -Size $size -Destination $path
        $path
    }

    Write-MultiSizeIco -PngPaths $pngPaths -Sizes $sizes -Destination (Join-Path $publicIcons 'agm-transporte.ico')
}
finally {
    $source.Dispose()
}

Write-Output "AGM Transporte Windows icon generated independently from $resolvedMaster"
