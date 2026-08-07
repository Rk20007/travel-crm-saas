#!/bin/bash

# Travel CRM SaaS - Push to GitHub Script
# This script pushes your project to GitHub

echo "========================================="
echo "Travel CRM SaaS - GitHub Push Script"
echo "========================================="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
    echo "Download from: https://git-scm.com/download"
    exit 1
fi

echo "✓ Git found"
echo ""

# Configure git if needed
echo "Configuring Git..."
git config user.name "Travel CRM Developer"
git config user.email "dev@travel-crm.local"

echo ""
echo "========================================="
echo "IMPORTANT STEPS:"
echo "========================================="
echo ""
echo "1. First, create a repository on GitHub:"
echo "   - Go to https://github.com/new"
echo "   - Repository name: travel-crm-saas"
echo "   - Click 'Create repository'"
echo ""
echo "2. After creating, GitHub shows you a URL like:"
echo "   https://github.com/Rk20007/travel-crm-saas.git"
echo ""
echo "3. Copy the URL and paste it when prompted below"
echo ""
read -p "Enter your GitHub repository URL: " GITHUB_URL

if [ -z "$GITHUB_URL" ]; then
    echo "❌ No URL provided. Exiting."
    exit 1
fi

echo ""
echo "========================================="
echo "Pushing to GitHub..."
echo "========================================="
echo ""

# Add all files
echo "Adding files..."
git add .

# Commit
echo "Creating commit..."
git commit -m "Initial commit: Travel CRM SaaS - Production Ready" --allow-empty

# Set main branch
git branch -M main

# Add remote
echo "Adding GitHub remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "$GITHUB_URL"

# Push
echo "Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✓ SUCCESS! Pushed to GitHub"
    echo "========================================="
    echo ""
    echo "Your repository is now live at:"
    echo "$GITHUB_URL"
    echo ""
    echo "View it at:"
    echo "https://github.com/Rk20007/travel-crm-saas"
    echo ""
else
    echo ""
    echo "❌ Push failed. Check your URL and try again."
    echo ""
    echo "Need authentication? Use:"
    echo "- Personal Access Token: https://github.com/settings/tokens"
    echo "- SSH Keys: https://github.com/settings/keys"
    exit 1
fi
