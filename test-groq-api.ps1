# Test Groq API with new models
# Save this as test-groq-api.ps1

param(
    [string]$ApiKey = $env:GROQ_API_KEY
)

if (-not $ApiKey) {
    Write-Host "Error: GROQ_API_KEY environment variable not set" -ForegroundColor Red
    Write-Host "Get a free key from: https://console.groq.com/keys" -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting Groq API Model Tests" -ForegroundColor Green
Write-Host ("=" * 50)
Write-Host "API Key configured: $($ApiKey.Substring(0,8))...$($ApiKey.Substring(-8))" -ForegroundColor Cyan

$GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
$Models = @("llama-3.1-8b-versatile", "llama-3.1-70b-versatile")

$Results = @()

foreach ($Model in $Models) {
    Write-Host ""
    Write-Host "Testing model: $Model" -ForegroundColor Cyan
    Write-Host ("=" * 50)
    
    try {
        $Body = @{
            model = $Model
            messages = @(
                @{
                    role = "system"
                    content = "You are a helpful assistant. Respond in JSON format."
                },
                @{
                    role = "user"
                    content = "Say hello in JSON format with a greeting field."
                }
            )
            temperature = 0.7
            response_format = @{ type = "json_object" }
        } | ConvertTo-Json

        $Response = Invoke-WebRequest -Uri $GROQ_API_URL `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $ApiKey"
                "Content-Type" = "application/json"
            } `
            -Body $Body `
            -ErrorAction Stop

        $Data = $Response.Content | ConvertFrom-Json
        $Content = $Data.choices[0].message.content
        
        Write-Host "PASS: API Response successful!" -ForegroundColor Green
        Write-Host "Response: $Content" -ForegroundColor Gray
        
        $Results += @{ Model = $Model; Success = $true }
    }
    catch {
        $ErrorMsg = $_.Exception.Message
        Write-Host "FAIL: API Error - $ErrorMsg" -ForegroundColor Red
        $Results += @{ Model = $Model; Success = $false }
    }
    
    # Add delay to avoid rate limiting
    Start-Sleep -Milliseconds 1000
}

# Summary
Write-Host ""
Write-Host ("=" * 50)
Write-Host "Test Summary:" -ForegroundColor Cyan
Write-Host ("=" * 50)

foreach ($Result in $Results) {
    $Status = if ($Result.Success) { "PASS" } else { "FAIL" }
    Write-Host "$Status : $($Result.Model)"
}

$FailCount = ($Results | Where-Object { $_.Success -eq $false } | Measure-Object).Count

if ($FailCount -eq 0) {
    Write-Host ""
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host ""
    Write-Host "Some tests failed" -ForegroundColor Yellow
    exit 1
}
