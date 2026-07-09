# Read the entire file
$content = Get-Content "migration/finance/00000_master_finance_migration.sql" -Raw

# Fix all single $ delimiters that should be $$
# Pattern 1: DO $ followed by newline/space
$content = $content -replace '(?m)^DO \$\s*$', 'DO $$'

# Pattern 2: END $; at end of line
$content = $content -replace '(?m)^END \$;', 'END $$;'

# Pattern 3: AS $ followed by newline/space
$content = $content -replace '(?m)^AS \$\s*$', 'AS $$'

# Pattern 4: $ LANGUAGE (single $ before LANGUAGE)
$content = $content -replace '(?m)^\$ LANGUAGE', '$$ LANGUAGE'

# Save the file
Set-Content "migration/finance/00000_master_finance_migration.sql" -Value $content -NoNewline

Write-Host "SQL file fixed successfully!" -ForegroundColor Green
Write-Host "Replaced single dollar signs with double dollar signs for PostgreSQL compatibility." -ForegroundColor Green
