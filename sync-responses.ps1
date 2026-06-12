# Sync Google Sheet form responses to data/responses.json
# Run this script whenever you want to refresh the admin dashboard data.

$SheetId = '1gbUzlOErRQF-LC1qqtmHXp0gqPtod7_KmbkfP24rN0M'
$SheetName = 'Form Responses 1'
$OutputPath = Join-Path $PSScriptRoot 'data\responses.json'

$SheetUrl = "https://docs.google.com/spreadsheets/d/$SheetId/gviz/tq?tqx=out:json&sheet=$([uri]::EscapeDataString($SheetName))"

Write-Host "Fetching responses from Google Sheet..."

try {
    $Response = Invoke-WebRequest -Uri $SheetUrl -UseBasicParsing
    $Text = $Response.Content
    $JsonText = $Text -replace '^[\s\S]*setResponse\(', '' -replace '\);?\s*$', ''
    $Gviz = $JsonText | ConvertFrom-Json

    $Headers = @($Gviz.table.cols | ForEach-Object { $_.label })
    $Rows = @()

    foreach ($Row in $Gviz.table.rows) {
        $Cells = @()
        foreach ($Cell in $Row.c) {
            if ($null -eq $Cell) {
                $Cells += ''
            }
            elseif ($Cell.f -and "$($Cell.f)".Trim() -ne '') {
                $Cells += "$($Cell.f)"
            }
            elseif ($null -ne $Cell.v) {
                $Cells += "$($Cell.v)"
            }
            else {
                $Cells += ''
            }
        }
        if ($Cells | Where-Object { "$_".Trim() -ne '' }) {
            $Rows += ,$Cells
        }
    }

    $Payload = [ordered]@{
        source      = "https://docs.google.com/spreadsheets/d/$SheetId"
        sheetName   = $SheetName
        syncedAt    = (Get-Date).ToUniversalTime().ToString('o')
        totalBallots = $Rows.Count
        headers     = $Headers
        rows        = $Rows
    }

    $Json = $Payload | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText($OutputPath, $Json)
    Write-Host "Saved $($Rows.Count) ballots to $OutputPath"
}
catch {
    Write-Error "Sync failed: $_"
    exit 1
}