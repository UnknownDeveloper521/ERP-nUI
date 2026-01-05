# 🗄️ SUPABASE DATABASE SETUP GUIDE

## Step 1: Create Database Tables

1. Go to your Supabase project: https://app.supabase.com/project/zpecwgqgsjwjrfrfrzzq
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire SQL schema from `database-schema.sql` file in your Replit project
5. Paste it into the SQL editor
6. Click **Run**
7. Wait for it to complete ✅

## Step 2: Create Admin User

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Click **Invite** button
3. Fill in:
   - **Email:** admin@tassos.com
   - **Password:** 123456
   - **Auto confirm user:** Check this box
4. Click **Invite User**

## Step 3: Verify Everything Works

1. Go back to your Replit app
2. Click **Run** to restart it
3. Try logging in:
   - Email: `admin@tassos.com`
   - Password: `123456`
4. You should see: ✅ Login successful!

## Step 4: Insert Sample Data (Optional)

To test your modules, run this sample data SQL in Supabase SQL Editor:

```sql
-- Add a sample category
INSERT INTO public.categories (name, description) VALUES
  ('Electronics', 'Electronic equipment and devices');

-- Add sample products
INSERT INTO public.products (sku, name, category_id, unit_price, cost_price, unit) VALUES
  ('PROD-001', 'Laptop Computer', (SELECT id FROM public.categories LIMIT 1), 1500.00, 900.00, 'unit'),
  ('PROD-002', 'Office Chair', (SELECT id FROM public.categories LIMIT 1), 250.00, 150.00, 'unit');

-- Add sample customers
INSERT INTO public.customers (name, email, phone, city) VALUES
  ('Acme Corp', 'contact@acme.com', '1234567890', 'New York'),
  ('Tech Solutions', 'info@techsol.com', '0987654321', 'San Francisco');

-- Add sample vendors
INSERT INTO public.vendors (name, email, phone, city) VALUES
  ('Global Supplies', 'sales@globalsupply.com', '1111111111', 'Chicago'),
  ('Tech Distributors', 'support@techdist.com', '2222222222', 'Boston');

-- Add sample employees
INSERT INTO public.employees (employee_id, first_name, last_name, email, department, designation) VALUES
  ('EMP-001', 'John', 'Smith', 'john@tassos.com', 'Sales', 'Sales Manager'),
  ('EMP-002', 'Jane', 'Doe', 'jane@tassos.com', 'Operations', 'Operations Lead');
```

## Step 5: Ready to Publish! 🚀

Your database is now set up! You can now:
- ✅ Publish your ERP to production
- ✅ Login with real Supabase authentication
- ✅ Store real data in the database
- ✅ Use all modules with persistent data

### To Publish:
1. In Replit, go to **Publish** tab
2. Click the blue **Publish** button
3. Your app will be live at a `.replit.app` domain!

---

## Database Schema Overview

Your ERP now has these tables:

- **Auth & Roles:** roles, user_profiles
- **Products:** categories, products, inventory
- **Sales:** customers, sales_orders, sales_order_items
- **Purchases:** vendors, purchase_orders, purchase_order_items
- **HRMS:** employees, payroll
- **Accounting:** accounts, journal_entries, journal_entry_lines
- **Logistics:** vehicles, drivers, trips, trip_weighments
- **CRM:** interactions
- **System:** audit_logs

All tables are indexed for performance and ready for production use!
