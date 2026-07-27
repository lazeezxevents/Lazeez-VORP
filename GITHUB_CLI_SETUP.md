# GitHub CLI Setup Guide

**Date:** July 27, 2026  
**Status:** ✅ Installed

---

## Installation Complete

GitHub CLI has been successfully installed on your system using:
```powershell
winget install --id GitHub.cli
```

**Version Installed:** 2.96.0

---

## Using GitHub CLI

To use GitHub CLI (`gh`), you need to **restart your terminal** or open a new PowerShell window.

### Authentication

Once you restart your terminal, authenticate with GitHub:

```powershell
gh auth login
```

Follow the prompts:
1. Choose: **GitHub.com**
2. Choose: **HTTPS** (recommended)
3. Choose: **Login with a web browser**
4. Copy the one-time code shown
5. Press Enter to open browser
6. Paste the code and authorize

---

## Useful GitHub CLI Commands

### Repository Management
```powershell
# View repository info
gh repo view

# Clone a repository
gh repo clone owner/repo

# Create a new repository
gh repo create my-new-repo
```

### Pull Requests
```powershell
# Create a pull request
gh pr create

# List open pull requests
gh pr list

# View a pull request
gh pr view 123

# Merge a pull request
gh pr merge 123

# Check out a pull request locally
gh pr checkout 123
```

### Issues
```powershell
# Create an issue
gh issue create

# List issues
gh issue list

# View an issue
gh issue view 456

# Close an issue
gh issue close 456
```

### Workflows (GitHub Actions)
```powershell
# List workflows
gh workflow list

# View workflow runs
gh run list

# View specific run
gh run view 12345

# Watch a workflow run
gh run watch
```

### Releases
```powershell
# Create a release
gh release create v1.0.0

# List releases
gh release list

# Download release assets
gh release download v1.0.0
```

---

## Quick Reference

### Check Status
```powershell
gh auth status    # Check authentication
gh repo view      # View current repo
gh pr status      # PR status for current branch
```

### Common Workflows
```powershell
# Create feature branch and PR
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
gh pr create --fill

# Update PR from feedback
git add .
git commit -m "Address review feedback"
git push

# Merge when approved
gh pr merge --merge  # or --squash or --rebase
```

---

## Current Git Status

### Latest Commit on Main
```
✅ Commit: 9669adb
✅ Message: fix: issue notifications, calendar navigation, and MOU generation
✅ Branch: main (synced with origin/main)
```

### Files Changed in Latest Commit
- ✅ `src/components/pages/Calendar.tsx` - Fixed navigation
- ✅ `src/utils/mouPdfGenerator.ts` - Fixed text wrapping & prices
- ✅ `src/utils/mouDocxGenerator.ts` - Fixed price display
- ✅ `supabase/migrations/20260727_fix_issue_notifications.sql` - DB fixes
- ✅ `DEPLOYMENT_INSTRUCTIONS.md` - Deployment guide
- ✅ `FIXES_ISSUE_NOTIFICATION_AND_CALENDAR.md` - Fix documentation
- ✅ `MOU_GENERATION_FIXES.md` - MOU generation docs

---

## Alternative: Using Git Commands

If you prefer traditional git commands instead of GitHub CLI:

### Push to Main
```powershell
git checkout main
git pull origin main
git push origin main
```

### Create Pull Request (Manual)
```powershell
git checkout -b feature-branch
# Make changes
git add .
git commit -m "Your message"
git push origin feature-branch
# Then create PR on GitHub web interface
```

---

## Troubleshooting

### "gh command not found"
**Solution:** Restart your PowerShell terminal. The PATH variable needs to be refreshed.

### Authentication Issues
```powershell
# Re-authenticate
gh auth logout
gh auth login
```

### Permission Denied
```powershell
# Check authentication status
gh auth status

# Refresh credentials
gh auth refresh
```

---

## Integration with Kiro IDE

You can use GitHub CLI directly from Kiro's terminal:

1. Open integrated terminal in Kiro
2. Run any `gh` command
3. Terminal will show real-time output

Example workflow in Kiro:
```powershell
# Check current status
gh pr status

# Create PR from current branch
gh pr create --title "Fix: MOU generation" --body "Fixed text overflow and price display"

# Review CI checks
gh run watch
```

---

## Best Practices

### Commit Messages
Use conventional commits format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code restructure
- `test:` - Adding tests
- `chore:` - Maintenance

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `hotfix/description` - Urgent fixes
- `refactor/description` - Code improvements

### Working with Main
```powershell
# Always pull before starting work
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/my-feature

# Push and create PR
git push origin feature/my-feature
gh pr create
```

---

## Next Steps

1. **Restart Terminal** to use `gh` commands
2. **Authenticate** with `gh auth login`
3. **Try it out** with `gh repo view`

---

**Installation Path:** `C:\Program Files\GitHub CLI\gh.exe`  
**Documentation:** https://cli.github.com/manual/  
**Status:** ✅ Ready to use after terminal restart
