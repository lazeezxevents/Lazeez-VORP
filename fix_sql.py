import re

# Read the file
with open('migration/finance/00000_master_finance_migration.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace single $ with $$ in specific contexts
# DO $ -> DO $$
content = re.sub(r'DO \$\s', r'DO $$ ', content)

# END $; -> END $$;
content = re.sub(r'END \$;', r'END $$;', content)

# AS $ -> AS $$
content = re.sub(r'AS \$\s', r'AS $$ ', content)

# $ LANGUAGE -> $$ LANGUAGE
content = re.sub(r'\$ LANGUAGE', r'$$ LANGUAGE', content)

# Write back
with open('migration/finance/00000_master_finance_migration.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed SQL file successfully!")
