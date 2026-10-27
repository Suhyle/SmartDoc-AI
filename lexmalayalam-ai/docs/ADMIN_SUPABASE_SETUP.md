# SmartDoc AI — Admin System Supabase Setup Guide

This guide explains step-by-step how to manually configure Supabase for the **SmartDoc AI Administration System**.

---

## Prerequisites

Make sure you have access to your **Supabase Dashboard**:
- URL: [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Select your project.

---

## Step 1: Run the Database Setup SQL Script

1. Open your Supabase Project.
2. In the left navigation bar, click on **SQL Editor**.
3. Click **New Query**.
4. Open the file `supabase/admin_setup.sql` in your project folder, copy all of its content, and paste it into the Supabase SQL Editor.
5. Click **Run** (or press `Ctrl` + `Enter`).
6. Verify that you see a success message: `"Success. No rows returned"`.

This script automatically:
- Adds the `role` column to `user_profiles`.
- Creates the `feedback` table for storing user feedback & admin notes.
- Creates the `is_admin()` helper function.
- Sets up Row Level Security (RLS) policies protecting user profiles, notifications, recommendations, and feedback.

---

## Step 2: Create the Administrator Account in Supabase Auth

1. In the Supabase Dashboard left menu, click **Authentication** → **Users**.
2. Click **Add User** → **Create User**.
3. Enter the Administrator login details:
   - **Email**: Enter your admin email address (e.g. `suhyle@gmail.com` or `admin@smartdoc.ai`).
   - **Password**: Enter your desired secure password (DO NOT commit this password to GitHub).
   - Check **Auto-confirm User?** (so email verification is not required for admin login).
4. Click **Create User**.

---

## Step 3: Promote the User Account to Administrator (`role = 'admin'`)

1. In **Authentication** → **Users**, locate the newly created Administrator account.
2. Click on the user to copy their **User UID** (a 36-character UUID string like `c9b71a23-4567-89ab-cdef-0123456789ab`).
3. Open the **SQL Editor** in Supabase.
4. Paste the following query, replacing `YOUR_ADMIN_AUTH_USER_UUID` with the actual UUID copied from step 2:

```sql
INSERT INTO public.user_profiles (id, full_name, role, updated_at)
VALUES ('YOUR_ADMIN_AUTH_USER_UUID', 'Muhammed Suhyle', 'admin', now())
ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Muhammed Suhyle';
```

5. Click **Run**.

---

## Step 4: Test Admin Login & Protection

1. Open your application in the browser at `/admin-login`.
2. Enter your Administrator Email and Password configured in Step 2.
3. Click **Sign In**.
4. You should be granted access and redirected to `/admin` (SmartDoc AI Admin Panel).
5. Verify that:
   - The top profile shows **Muhammed Suhyle Administrator**.
   - Navigating to `/admin` while logged out or as a normal user shows **"You do not have administrator access"** and blocks entry.

---

## Step 5: (Optional) Verify RLS Security

To ensure security is working properly:
- Try opening `/admin` in an Incognito window: It will redirect you to `/admin-login`.
- Log in with a normal user account: Attempting to access `/admin` will show the Access Denied guard screen.
