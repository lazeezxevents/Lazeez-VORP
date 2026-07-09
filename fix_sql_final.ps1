# Read all lines
$lines = Get-Content "migration/finance/00000_master_finance_migration.sql"
$fixed = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
    # Fix AS $ followed by newline (function body start)
    if ($lines[$i] -match '^AS \$$') {
        $lines[$i] = $lines[$i] -replace '^AS \$$', 'AS $$'
        $fixed = $true
        Write-Host "Fixed line $($i+1): AS `$ -> AS `$`$"
    }
    
    # Fix $ LANGUAGE (function body end)
    if ($lines[$i] -match '^\$ LANGUAGE') {
        $lines[$i] = $lines[$i] -replace '^\$ LANGUAGE', '$$ LANGUAGE'
        $fixed = $true
        Write-Host "Fixed line $($i+1): `$ LANGUAGE -> `$`$ LANGUAGE"
    }
    
    # Fix DO $ at start of line
    if ($lines[$i] -match '^DO \$$') {
        $lines[$i] = $lines[$i] -replace '^DO \$$', 'DO $$'
        $fixed = $true
        Write-Host "Fixed line $($i+1): DO `$ -> DO `$`$"
    }
    
    # Fix END $; at start of line
    if ($lines[$i] -match '^END \$;$') {
        $lines[$i] = $lines[$i] -replace '^END \$;$', 'END $$;'
        $fixed = $true
        Write-Host "Fixed line $($i+1): END `$; -> END `$`$;"
    }
}

if ($fixed) {
    # Save the file
    $lines | Set-Content "migration/finance/00000_master_finance_migration.sql"
    Write-Host "`nSQL file fixed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nNo fixes needed - file is already correct!" -ForegroundColor Green
}
