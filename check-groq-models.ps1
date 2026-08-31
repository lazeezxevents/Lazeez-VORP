# Diagnostic script to check Groq available models and API key validity

param(
    [string]$ApiKey = $env:GROQ_API_KEY
)

if (-not $ApiKey) {
    Write-Host "Error: GROQ_API_KEY not set" -ForegroundColor Red
    exit 1
}

$GROQ_API_URL = "https://api.groq.com/openai/v1/models"

Write-Host "Checking Groq API connection and available models..." -ForegroundColor Cyan
Write-Host ("=" * 60)

try {
    Write-Host ""
    Write-Host "Testing API Key validity and fetching models..." -ForegroundColor Yellow
    
    $Response = Invoke-WebRequest -Uri $GROQ_API_URL `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $ApiKey"
            "Content-Type" = "application/json"
        } `
        -ErrorAction Stop

    $Data = $Response.Content | ConvertFrom-Json
    
    Write-Host ""
    Write-Host "SUCCESS: Connected to Groq API!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available Models:" -ForegroundColor Green
    Write-Host ("=" * 60)
    
    if ($Data.data -and $Data.data.Count -gt 0) {
        foreach ($Model in $Data.data) {
            Write-Host "  - $($Model.id)" -ForegroundColor Cyan
        }
    }
    else {
        Write-Host "No models found" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Total models available: $($Data.data.Count)" -ForegroundColor Green
}
catch {
    $ErrorMsg = $_.Exception.Message
    Write-Host ""
    Write-Host "ERROR: Could not connect to Groq API" -ForegroundColor Red
    Write-Host "Details: $ErrorMsg" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "  1. Invalid API key" -ForegroundColor Gray
    Write-Host "  2. Groq API is down" -ForegroundColor Gray
    Write-Host "  3. Network connectivity issue" -ForegroundColor Gray
    exit 1
}
