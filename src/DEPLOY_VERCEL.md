# Deployment Guide: Vercel

This application is configured for easy deployment on Vercel. Since it is a Vite-based Single Page Application (SPA), we have already included a `vercel.json` file to handle routing correctly.

## Prerequisites

1.  **Vercel Account:** Create an account at [vercel.com](https://vercel.com) if you don't have one.
2.  **GitHub/GitLab/Bitbucket:** It is recommended to push your code to a Git repository for automatic deployments.

## Option 1: Deploy via Git Integration (Recommended)

1.  **Push your code** to a Git repository (GitHub, GitLab, or Bitbucket).
2.  **Log in to Vercel** and go to your dashboard.
3.  Click **"Add New..."** -> **"Project"**.
4.  **Import your repository**.
5.  **Configure Project:**
    *   **Framework Preset:** Vercel should automatically detect **Vite**.
    *   **Root Directory:** `./` (default)
    *   **Build Command:** `npm run build` (or `vite build`)
    *   **Output Directory:** `dist`
    *   **Install Command:** `npm install`
6.  **Environment Variables:**
    *   Expand the "Environment Variables" section.
    *   Add the variables from your `.env.local` file:
        *   `VITE_SUPABASE_URL`
        *   `VITE_SUPABASE_ANON_KEY`
        *   `VITE_GOOGLE_API_KEY`
        *   `VITE_GOOGLE_CLIENT_ID`
        *   `VITE_GOOGLE_FOLDER_ID`
7.  Click **"Deploy"**.

## Option 2: Deploy via Vercel CLI

If you prefer using the command line:

1.  Install Vercel CLI: `npm i -g vercel`
2.  Run `vercel login` and follow the instructions.
3.  Run `vercel` in the project root directory.
4.  Follow the prompts:
    *   Set up and deploy? **Yes**
    *   Scope? (Select your team/account)
    *   Link to existing project? **No**
    *   Project name? (Press Enter for default)
    *   Directory? (Press Enter for default)
    *   **Auto-detect settings:** It should detect Vite. If asked, confirm settings:
        *   Build Command: `vite build`
        *   Output Directory: `dist`
5.  **Environment Variables:** You will need to add environment variables in the Vercel Project Settings on the website after the first deployment (which might fail if variables are missing), or use `vercel env add` before deploying.

## Important Notes

*   **Routing:** The `vercel.json` file ensures that all routes are redirected to `index.html`, which is required for React Router to work correctly in production.
*   **Supabase:** Ensure your Supabase URL and Anon Key are correctly set in Vercel's Environment Variables.
