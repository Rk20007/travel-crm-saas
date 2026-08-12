# How to Push to GitHub

## Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Enter Repository name: **travel-crm-saas**
3. Add description: "Production-level Travel CRM SaaS with Next.js, MongoDB, and Tailwind CSS"
4. Choose **Public** (or Private if you prefer)
5. Do NOT check "Add a README file" (we already have one)
6. Click **Create repository**

## Step 2: Get Your Repository URL

After creating, GitHub will show you the URL. It will look like:
```
https://github.com/Rk20007/travel-crm-saas.git
```

## Step 3: Configure Git (First Time Only)

If you haven't configured Git globally, run:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step 4: Initialize and Push

Run these commands in your project directory:

```bash
# Navigate to project
cd /vercel/share/v0-project

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Travel CRM SaaS application"

# Add remote (replace with your actual repo URL)
git remote add origin https://github.com/Rk20007/travel-crm-saas.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 5: Authentication

GitHub will ask for authentication. You have two options:

### Option A: Using Personal Access Token (Recommended)
1. Go to https://github.com/settings/tokens
2. Click "Generate new token"
3. Select "repo" scope
4. Copy the token
5. When git asks for password, paste the token instead

### Option B: Using SSH
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your.email@example.com"`
2. Add to GitHub: https://github.com/settings/keys
3. Use SSH URL: `git@github.com:Rk20007/travel-crm-saas.git`

## Complete Command Sequence

```bash
cd /vercel/share/v0-project

git init
git add .
git commit -m "Initial commit: Travel CRM SaaS - Production Ready"
git branch -M main
git remote add origin https://github.com/Rk20007/travel-crm-saas.git
git push -u origin main
```

## After First Push

For future changes, just use:
```bash
git add .
git commit -m "Your commit message"
git push
```

## Verify Push

After pushing, verify at:
https://github.com/Rk20007/travel-crm-saas

---

**Need Help?**
- Git not installed? Install from https://git-scm.com/download
- Authentication issues? Check GitHub SSH keys or Personal Access Tokens
- Permission denied? Check your GitHub credentials and token
