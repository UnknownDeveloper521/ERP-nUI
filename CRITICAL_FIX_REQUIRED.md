# 🚨 CRITICAL: API Key Mismatch - FIX THIS NOW

## THE PROBLEM
Your Supabase API key is **INVALID**. The one hardcoded doesn't match your project.

## HOW TO FIX (2 MINUTES)

### STEP 1: Get Your CORRECT API Key from Supabase
1. Go to: https://app.supabase.co/project/zpecwgqgsjwjrfrfrzzq/settings/api
2. You'll see a section called "Project API keys"
3. Under "anon public" - **COPY** the full key (it starts with `eyJ...`)
4. Open this in a text editor and paste it somewhere safe

### STEP 2: Verify User Exists
1. Go to: https://app.supabase.co/project/zpecwgqgsjwjrfrfrzzq/auth/users
2. Confirm you see: `daxpanara.tassos@gmail.com` ✅
3. Status should show "Confirmed" ✅

### STEP 3: Replace API Key in Code
1. Open in Replit: `client/src/lib/supabase.ts`
2. Line 4: Replace the `SUPABASE_ANON_KEY` value with the CORRECT key you copied in Step 1
3. Make sure there are NO extra spaces or quotes

### STEP 4: Restart & Test
1. The app will auto-reload
2. Try login: `daxpanara.tassos@gmail.com` / `123456`
3. Should work! ✅

---

## EXAMPLE (WHAT IT SHOULD LOOK LIKE):
```typescript
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...";
```

The key should be a LONG string starting with `eyJ` and ending with a combination of characters.

---

## IF STILL NOT WORKING:
1. In Supabase, go to **Settings > Auth** 
2. Make sure "Email auth" is **ENABLED**
3. Your user `daxpanara.tassos@gmail.com` must be **Confirmed** (check the column)
4. Password must be exactly `123456` with no spaces

---

## ✅ WHEN FIXED:
Your ERP will be FULLY OPERATIONAL!
- ✅ Login works
- ✅ All 12 modules available
- ✅ Can publish to production
