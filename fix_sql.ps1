$content = Get-Content "migration/finance/00000_master_finance_migration.sql" -Raw

# Replace patterns
$content = $content -replace 'DO \$([^$])', 'DO $$$$1'
$content = $content -replace 'END \$;', 'END $$;'
$content = $content -replace 'AS \$([^$])', 'AS $$$$1'
$content = $content -replace '([^$])\$ LANGUAGE', '$$1$$ LANGUAGE'

Set-Content "migration/finance/00000_master_finance_migration.sql" -Value $content -NoNewline

Write-Host "Fixed SQL file successfully!"
