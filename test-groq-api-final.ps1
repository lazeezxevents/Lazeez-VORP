# Test Groq API with currently available models

param(
    [string]$ApiKey = $env:GROQ_API_KEY
)

if (-not $ApiKey) {
    Write-Host "Error: GROQ_API_KEY environment variable not set" -ForegroundColor Red
    Write-Host "Get a free key from: https://console.groq.com/keys" -ForegroundColor Yellow
    exit 1
}

Write-Host "Testing Groq API with Available Models" -ForegroundColor Green
Write-Host ("=" * 60)

$GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
$Models = @("groq/compound-mini", "groq/compound")

$Results = @()

foreach ($Model in $Models) {
    Write-Host ""
    Write-Host "Testing model: $Model" -ForegroundColor Cyan
    Write-Host ("=" * 60)
    
    try {
        $Body = @{
            model = $Model
            messages = @(
                @{
                    role = "system"
                    content = "You are a helpful assistant."
                },
                @{
                    role = "user"
                    content = "Say hello in one sentence."
                }
            )
            temperature = 0.7
            max_tokens = 100
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
    
    Start-Sleep -Milliseconds 1000
}

Write-Host ""
Write-Host ("=" * 60)
Write-Host "Test Summary:" -ForegroundColor Cyan
Write-Host ("=" * 60)

foreach ($Result in $Results) {
    $Status = if ($Result.Success) { "PASS" } else { "FAIL" }
    Write-Host "$Status : $($Result.Model)"
}

$FailCount = ($Results | Where-Object { $_.Success -eq $false } | Measure-Object).Count

if ($FailCount -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS: All tests passed! Your Groq API is ready." -ForegroundColor Green
    exit 0
}
else {
    Write-Host ""
    Write-Host "FAILURE: Some tests failed" -ForegroundColor Red
    exit 1
}
