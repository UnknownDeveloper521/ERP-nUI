import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import { createAuthedSupabaseClient, getBearerTokenFromHeaders, getUserFromAccessToken } from "./supabase";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==================== DASHBOARD STATS ====================
  
  app.get("/api/stats/dashboard", async (_req, res) => {
    try {
      const [employees, departments, products, customers, leads, vehicles] = await Promise.all([
        storage.getAllEmployees(),
        storage.getAllDepartments(),
        storage.getAllProducts(),
        storage.getAllCustomers(),
        storage.getAllLeads(),
        storage.getAllVehicles(),
      ]);

      res.json({
        employees: employees.length,
        departments: departments.length,
        products: products.length,
        customers: customers.length,
        leads: leads.length,
        vehicles: vehicles.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== HRMS ROUTES ====================
  
  // Employees
  app.get("/api/employees", async (_req, res) => {
    const employees = await storage.getAllEmployees();
    res.json(employees);
  });

  app.get("/api/employees/:id", async (req, res) => {
    const employee = await storage.getEmployee(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(employee);
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const validated = schema.insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validated);
      res.status(201).json(employee);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/employees/:id", async (req, res) => {
    try {
      const employee = await storage.updateEmployee(req.params.id, req.body);
      res.json(employee);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    await storage.deleteEmployee(req.params.id);
    res.status(204).send();
  });

  // Departments
  app.get("/api/departments", async (_req, res) => {
    const departments = await storage.getAllDepartments();
    res.json(departments);
  });

  app.get("/api/departments/:id", async (req, res) => {
    const department = await storage.getDepartment(req.params.id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }
    res.json(department);
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const validated = schema.insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(validated);
      res.status(201).json(department);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/departments/:id", async (req, res) => {
    try {
      const department = await storage.updateDepartment(req.params.id, req.body);
      res.json(department);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/departments/:id", async (req, res) => {
    await storage.deleteDepartment(req.params.id);
    res.status(204).send();
  });

  // Attendance
  app.get("/api/attendance", async (_req, res) => {
    const attendance = await storage.getAllAttendance();
    res.json(attendance);
  });

  app.get("/api/attendance/employee/:employeeId", async (req, res) => {
    const attendance = await storage.getAttendanceByEmployee(req.params.employeeId);
    res.json(attendance);
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const validated = schema.insertAttendanceSchema.parse(req.body);
      const attendance = await storage.createAttendance(validated);
      res.status(201).json(attendance);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Leaves
  app.get("/api/leaves", async (_req, res) => {
    const leaves = await storage.getAllLeaves();
    res.json(leaves);
  });

  app.get("/api/leaves/employee/:employeeId", async (req, res) => {
    const leaves = await storage.getLeavesByEmployee(req.params.employeeId);
    res.json(leaves);
  });

  app.post("/api/leaves", async (req, res) => {
    try {
      const validated = schema.insertLeaveSchema.parse(req.body);
      const leave = await storage.createLeave(validated);
      res.status(201).json(leave);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/leaves/:id/status", async (req, res) => {
    try {
      const { status, approvedBy } = req.body;
      const leave = await storage.updateLeaveStatus(req.params.id, status, approvedBy);
      res.json(leave);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Payroll
  app.get("/api/payroll", async (_req, res) => {
    const payroll = await storage.getAllPayroll();
    res.json(payroll);
  });

  app.get("/api/payroll/employee/:employeeId", async (req, res) => {
    const payroll = await storage.getPayrollByEmployee(req.params.employeeId);
    res.json(payroll);
  });

  app.post("/api/payroll", async (req, res) => {
    try {
      const validated = schema.insertPayrollSchema.parse(req.body);
      const payroll = await storage.createPayroll(validated);
      res.status(201).json(payroll);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/payroll/:id", async (req, res) => {
    try {
      const payroll = await storage.updatePayroll(req.params.id, req.body);
      res.json(payroll);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Job Postings
  app.get("/api/job-postings", async (_req, res) => {
    const jobPostings = await storage.getAllJobPostings();
    res.json(jobPostings);
  });

  app.get("/api/job-postings/:id", async (req, res) => {
    const jobPosting = await storage.getJobPosting(req.params.id);
    if (!jobPosting) {
      return res.status(404).json({ message: "Job posting not found" });
    }
    res.json(jobPosting);
  });

  app.post("/api/job-postings", async (req, res) => {
    try {
      const validated = schema.insertJobPostingSchema.parse(req.body);
      const jobPosting = await storage.createJobPosting(validated);
      res.status(201).json(jobPosting);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/job-postings/:id", async (req, res) => {
    try {
      const jobPosting = await storage.updateJobPosting(req.params.id, req.body);
      res.json(jobPosting);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Applications
  app.get("/api/applications", async (_req, res) => {
    const applications = await storage.getAllApplications();
    res.json(applications);
  });

  app.get("/api/applications/job/:jobPostingId", async (req, res) => {
    const applications = await storage.getApplicationsByJob(req.params.jobPostingId);
    res.json(applications);
  });

  app.post("/api/applications", async (req, res) => {
    try {
      const validated = schema.insertApplicationSchema.parse(req.body);
      const application = await storage.createApplication(validated);
      res.status(201).json(application);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/applications/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const application = await storage.updateApplicationStatus(req.params.id, status);
      res.json(application);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== INVENTORY ROUTES ====================
  
  // Alerts & Thresholds
  app.get("/api/thresholds", async (req, res) => {
    try {
      const token = getBearerTokenFromHeaders(req.headers as any);
      if (!token) return res.status(401).json({ message: "Missing Authorization token" });

      const sb = createAuthedSupabaseClient(token);
      const { data, error } = await sb
        .from("inventory_thresholds")
        .select("material_type, material_id, warehouse_location, min_qty, reorder_level, max_qty, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        const msg = String(error.message || "");
        if (msg.toLowerCase().includes("material_type") && msg.toLowerCase().includes("does not exist")) {
          return res.status(409).json({
            message:
              "inventory_thresholds schema mismatch: expected columns (material_type, material_id, warehouse_location). Run your latest SQL migration and then refresh Supabase schema cache.",
          });
        }
        throw error;
      }
      const rows = (data || []).map((t: any) => ({
        id: `${t.material_type}::${t.material_id}::${t.warehouse_location}`,
        ...t,
      }));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/thresholds", async (req, res) => {
    try {
      const token = getBearerTokenFromHeaders(req.headers as any);
      if (!token) return res.status(401).json({ message: "Missing Authorization token" });

      const sb = createAuthedSupabaseClient(token);
      const { data: isAdmin, error: adminErr } = await sb.rpc("is_admin");
      if (adminErr) throw adminErr;
      if (!isAdmin) return res.status(403).json({ message: "Admin only" });

      const material_type = String(req.body.material_type || "").toUpperCase();
      const material_id = req.body.material_id ? String(req.body.material_id) : null;
      const warehouse_location = String(req.body.warehouse_location || "").trim();
      const min_qty = Number(req.body.min_qty ?? 0);
      const reorder_level = Number(req.body.reorder_level ?? 0);
      const max_qty = Number(req.body.max_qty ?? 0);

      if (!material_type || !["ROLL", "PACKAGING"].includes(material_type)) {
        return res.status(400).json({ message: "material_type must be ROLL or PACKAGING" });
      }
      if (!material_id) return res.status(400).json({ message: "material_id is required" });
      if (!warehouse_location) return res.status(400).json({ message: "warehouse_location is required" });

      const upsertPayload = {
        material_type,
        material_id,
        warehouse_location,
        min_qty,
        reorder_level,
        max_qty,
      };

      const { data, error } = await sb
        .from("inventory_thresholds")
        .upsert([upsertPayload], { onConflict: "material_type,material_id,warehouse_location" })
        .select("material_type, material_id, warehouse_location, min_qty, reorder_level, max_qty, created_at")
        .single();
      if (error) {
        const msg = String(error.message || "");
        if (msg.toLowerCase().includes("material_type") && msg.toLowerCase().includes("schema cache")) {
          return res.status(409).json({
            message:
              "Supabase schema cache is not updated (material_type not found). After running the SQL migration, go to Supabase: Settings → API → Refresh schema cache.",
          });
        }
        if (msg.toLowerCase().includes("material_type") && msg.toLowerCase().includes("does not exist")) {
          return res.status(409).json({
            message:
              "inventory_thresholds table is missing required columns. Please run the provided SQL that creates inventory_thresholds(material_type, material_id, warehouse_location, ...) and then refresh schema cache.",
          });
        }
        throw error;
      }

      res.status(201).json({
        id: `${data.material_type}::${data.material_id}::${data.warehouse_location}`,
        ...data,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/thresholds/:id", async (req, res) => {
    try {
      const token = getBearerTokenFromHeaders(req.headers as any);
      if (!token) return res.status(401).json({ message: "Missing Authorization token" });

      const sb = createAuthedSupabaseClient(token);
      const { data: isAdmin, error: adminErr } = await sb.rpc("is_admin");
      if (adminErr) throw adminErr;
      if (!isAdmin) return res.status(403).json({ message: "Admin only" });

      const parts = String(req.params.id || "").split("::");
      if (parts.length !== 3) {
        return res.status(400).json({ message: "Invalid threshold id" });
      }
      const [material_type, material_id, warehouse_location] = parts;

      const { error } = await sb
        .from("inventory_thresholds")
        .delete()
        .eq("material_type", material_type)
        .eq("material_id", material_id)
        .eq("warehouse_location", warehouse_location);
      if (error) throw error;
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/stock-alerts", async (req, res) => {
    try {
      const token = getBearerTokenFromHeaders(req.headers as any);
      if (!token) return res.status(401).json({ message: "Missing Authorization token" });

      const sb = createAuthedSupabaseClient(token);

      const [{ data: thresholds, error: thErr }, { data: stock, error: stErr }, { data: rollMaster, error: rollErr }, { data: packMaster, error: packErr }] =
        await Promise.all([
          sb
            .from("inventory_thresholds")
            .select("material_type, material_id, warehouse_location, min_qty, reorder_level, max_qty"),
          sb
            .from("raw_material_stock")
            .select("material_type, roll_material_id, packaging_material_id, material_key, warehouse_location, available_qty"),
          sb.from("raw_material_roll_master").select("id, name"),
          sb.from("packaging_material_master").select("id, name"),
        ]);

      if (thErr) {
        const msg = String(thErr.message || "");
        if (msg.toLowerCase().includes("material_type") && msg.toLowerCase().includes("does not exist")) {
          return res.status(409).json({
            message:
              "inventory_thresholds schema mismatch: expected columns (material_type, material_id, warehouse_location). Run your latest SQL migration and refresh Supabase schema cache.",
          });
        }
        throw thErr;
      }
      if (stErr) throw stErr;
      if (rollErr) throw rollErr;
      if (packErr) throw packErr;

      const rollNameById = new Map((rollMaster || []).map((m: any) => [m.id, m.name]));
      const packNameById = new Map((packMaster || []).map((m: any) => [m.id, m.name]));

      const thresholdByKey = new Map<string, any>();
      for (const t of thresholds || []) {
        const k = `${t.material_type}::${t.material_id}::${t.warehouse_location}`;
        thresholdByKey.set(k, t);
      }

      const alerts = (stock || []).map((s: any) => {
        const material_id = (s.material_type === "PACKAGING" ? s.packaging_material_id : s.roll_material_id) || s.material_key;
        const t = thresholdByKey.get(`${s.material_type}::${material_id}::${s.warehouse_location}`) || null;

        const available_qty = Number(s.available_qty ?? 0);
        const min_qty = Number(t?.min_qty ?? 0);
        const reorder_level = Number(t?.reorder_level ?? 0);
        const max_qty = Number(t?.max_qty ?? 0);

        let status: "OK" | "REORDER" | "CRITICAL" = "OK";
        if (t) {
          if (available_qty <= min_qty) status = "CRITICAL";
          else if (available_qty <= reorder_level) status = "REORDER";
        }

        const material_name =
          s.material_type === "PACKAGING"
            ? packNameById.get(material_id) || "-"
            : rollNameById.get(material_id) || "-";

        return {
          threshold_id: t
            ? `${t.material_type}::${t.material_id}::${t.warehouse_location}`
            : null,
          material_type: s.material_type,
          material_id,
          material_name,
          warehouse_location: s.warehouse_location,
          available_qty,
          min_qty,
          reorder_level,
          max_qty,
          status,
        };
      });

      res.json(alerts);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Stock Adjustment
  app.get("/api/raw-materials", async (req, res) => {
    try {
      const token = getBearerTokenFromHeaders(req.headers as any);
      if (!token) return res.status(401).json({ message: "Missing Authorization token" });

      const sb = createAuthedSupabaseClient(token);
      const material_type = req.query.material_type ? String(req.query.material_type).toUpperCase() : null;

      if (material_type && material_type !== "ROLL" && material_type !== "PACKAGING") {
        return res.status(400).json({ message: "material_type must be ROLL or PACKAGING" });
      }

      if (material_type === "PACKAGING") {
        const { data, error } = await sb
          .from("packaging_material_master")
          .select("id, name")
          .order("name", { ascending: true });
        if (error) throw error;
        return res.json((data as any) || []);
      }

      // Default to ROLL
      const { data, error } = await sb
        .from("raw_material_roll_master")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return res.json((data as any) || []);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/raw-material-stock", async (req, res) => {
    try {
      const token = getBearerTokenFromHeaders(req.headers as any);
      if (!token) return res.status(401).json({ message: "Missing Authorization token" });

      const sb = createAuthedSupabaseClient(token);
      const material_id = req.query.material_id ? String(req.query.material_id) : null;
      const material_type = req.query.material_type ? String(req.query.material_type).toUpperCase() : null;
      const warehouse_location = String(req.query.warehouse_location || "").trim() || "MAIN";

      if (!material_id) return res.status(400).json({ message: "material_id is required" });

      if (material_type && material_type !== "ROLL" && material_type !== "PACKAGING") {
        return res.status(400).json({ message: "material_type must be ROLL or PACKAGING" });
      }

      // Preferred: material_key (newer schema)
      const readByMaterialKey = async () => {
        let q = sb
          .from("raw_material_stock")
          .select("available_qty")
          .eq("material_key", material_id)
          .eq("warehouse_location", warehouse_location);
        if (material_type) q = q.eq("material_type", material_type);
        return q.maybeSingle();
      };

      // Fallback: separate roll_material_id / packaging_material_id
      const readByTypedId = async () => {
        if (!material_type) {
          return { data: null as any, error: new Error("material_type is required when material_key is not available") } as any;
        }

        if (material_type === "PACKAGING") {
          return sb
            .from("raw_material_stock")
            .select("available_qty")
            .eq("material_type", "PACKAGING")
            .eq("packaging_material_id", material_id)
            .eq("warehouse_location", warehouse_location)
            .maybeSingle();
        }

        return sb
          .from("raw_material_stock")
          .select("available_qty")
          .eq("material_type", "ROLL")
          .eq("roll_material_id", material_id)
          .eq("warehouse_location", warehouse_location)
          .maybeSingle();
      };

      let data: any = null;
      let error: any = null;

      const r1 = await readByMaterialKey();
      data = r1.data;
      error = r1.error;

      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("material_key") && msg.includes("does not exist")) {
          const r2 = await readByTypedId();
          data = r2.data;
          error = r2.error;
        }
      }

      if (error) throw error;
      return res.json({ available_qty: Number(data?.available_qty ?? 0) });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/stock-adjustments", async (req, res) => {
    try {
      const token = getBearerTokenFromHeaders(req.headers as any);
      if (!token) return res.status(401).json({ message: "Missing Authorization token" });

      const sb = createAuthedSupabaseClient(token);
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);

      const [{ data: adjustments, error: adjErr }, { data: rollMaster, error: rollErr }, { data: packMaster, error: packErr }] =
        await Promise.all([
          sb
            .from("stock_adjustments")
            .select(
              "id, material_type, roll_material_id, packaging_material_id, adj_type, qty_change, reason, approved_by, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(limit),
          sb.from("raw_material_roll_master").select("id, name"),
          sb.from("packaging_material_master").select("id, name"),
        ]);

      if (adjErr) throw adjErr;
      if (rollErr) throw rollErr;
      if (packErr) throw packErr;

      const rollNameById = new Map((rollMaster || []).map((m: any) => [m.id, m.name]));
      const packNameById = new Map((packMaster || []).map((m: any) => [m.id, m.name]));

      const rows = ((adjustments as any) || []).map((r: any) => {
        const mt = String(r.material_type || "").toUpperCase();
        const material_id = (mt === "PACKAGING" ? r.packaging_material_id : r.roll_material_id) || null;
        const material_name =
          mt === "PACKAGING"
            ? packNameById.get(material_id) || "-"
            : rollNameById.get(material_id) || "-";

        return {
          ...r,
          material_id,
          material_name,
        };
      });

      return res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/stock-adjustments", async (req, res) => {
    try {
      const token = getBearerTokenFromHeaders(req.headers as any);
      if (!token) return res.status(401).json({ message: "Missing Authorization token" });

      const sb = createAuthedSupabaseClient(token);
      const user = await getUserFromAccessToken(token);

      const material_type = String(req.body.material_type || "").toUpperCase();
      const material_id = req.body.material_id ? String(req.body.material_id) : null;
      const adj_type = String(req.body.adj_type || "").toUpperCase();
      const qty = Number(req.body.quantity ?? req.body.qty ?? req.body.qty_change ?? 0);
      const reason = String(req.body.reason || "").trim();
      const warehouse_location = String(req.body.warehouse_location || "").trim() || "MAIN";

      if (!material_type || !["ROLL", "PACKAGING"].includes(material_type)) {
        return res.status(400).json({ message: "material_type must be ROLL or PACKAGING" });
      }
      if (!material_id) return res.status(400).json({ message: "material_id is required" });
      if (!adj_type || !["IN", "OUT"].includes(adj_type)) {
        return res.status(400).json({ message: "adj_type must be IN or OUT" });
      }
      if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ message: "Quantity must be > 0" });
      if (!reason) return res.status(400).json({ message: "Reason is required" });

      // Server-side safety: don't allow removing more than available.
      if (adj_type === "OUT") {
        const { data, error } = await sb
          .from("raw_material_stock")
          .select("available_qty")
          .eq("material_type", material_type)
          .eq("material_key", material_id)
          .eq("warehouse_location", warehouse_location)
          .maybeSingle();

        if (error) {
          const msg = String(error.message || "").toLowerCase();
          if (msg.includes("material_key") && msg.includes("does not exist")) {
            // fallback older schema
            const r2 =
              material_type === "PACKAGING"
                ? await sb
                    .from("raw_material_stock")
                    .select("available_qty")
                    .eq("material_type", "PACKAGING")
                    .eq("packaging_material_id", material_id)
                    .eq("warehouse_location", warehouse_location)
                    .maybeSingle()
                : await sb
                    .from("raw_material_stock")
                    .select("available_qty")
                    .eq("material_type", "ROLL")
                    .eq("roll_material_id", material_id)
                    .eq("warehouse_location", warehouse_location)
                    .maybeSingle();
            if (r2.error) throw r2.error;
            const available2 = Number(r2.data?.available_qty ?? 0);
            if (qty > available2) {
              return res.status(400).json({ message: "Cannot remove more stock than available." });
            }
          } else {
            throw error;
          }
        } else {
          const available = Number(data?.available_qty ?? 0);
          if (qty > available) {
            return res.status(400).json({ message: "Cannot remove more stock than available." });
          }
        }
      }

      const qty_change = adj_type === "IN" ? qty : -qty;

      const dbAdjType = adj_type === "IN" ? "ADD" : "REDUCE";

      const insertPayload: any = {
        material_type,
        adj_type: dbAdjType,
        qty_change,
        reason,
        approved_by: user.id,
      };

      if (material_type === "PACKAGING") insertPayload.packaging_material_id = material_id;
      else insertPayload.roll_material_id = material_id;

      const { data, error } = await sb
        .from("stock_adjustments")
        .insert([insertPayload])
        .select(
          "id, material_type, roll_material_id, packaging_material_id, adj_type, qty_change, reason, approved_by, created_at"
        )
        .single();

      if (error) throw error;
      res.status(201).json(data);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // Products
  app.get("/api/products", async (_req, res) => {
    const products = await storage.getAllProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    try {
      const validated = schema.insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validated);
      res.status(201).json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    await storage.deleteProduct(req.params.id);
    res.status(204).send();
  });

  // Stock Movements
  app.get("/api/stock-movements", async (_req, res) => {
    const stockMovements = await storage.getAllStockMovements();
    res.json(stockMovements);
  });

  app.get("/api/stock-movements/product/:productId", async (req, res) => {
    const stockMovements = await storage.getStockMovementsByProduct(req.params.productId);
    res.json(stockMovements);
  });

  app.post("/api/stock-movements", async (req, res) => {
    try {
      const validated = schema.insertStockMovementSchema.parse(req.body);
      const stockMovement = await storage.createStockMovement(validated);
      res.status(201).json(stockMovement);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== CUSTOMERS & SUPPLIERS ====================
  
  // Customers
  app.get("/api/customers", async (_req, res) => {
    const customers = await storage.getAllCustomers();
    res.json(customers);
  });

  app.get("/api/customers/:id", async (req, res) => {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.json(customer);
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validated = schema.insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validated);
      res.status(201).json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      res.json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    await storage.deleteCustomer(req.params.id);
    res.status(204).send();
  });

  // Suppliers
  app.get("/api/suppliers", async (_req, res) => {
    const suppliers = await storage.getAllSuppliers();
    res.json(suppliers);
  });

  app.get("/api/suppliers/:id", async (req, res) => {
    const supplier = await storage.getSupplier(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    res.json(supplier);
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const validated = schema.insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(validated);
      res.status(201).json(supplier);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/suppliers/:id", async (req, res) => {
    try {
      const supplier = await storage.updateSupplier(req.params.id, req.body);
      res.json(supplier);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    await storage.deleteSupplier(req.params.id);
    res.status(204).send();
  });

  // ==================== SALES ORDERS ====================
  
  app.get("/api/sales-orders", async (_req, res) => {
    const salesOrders = await storage.getAllSalesOrders();
    res.json(salesOrders);
  });

  app.get("/api/sales-orders/:id", async (req, res) => {
    const salesOrder = await storage.getSalesOrder(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }
    res.json(salesOrder);
  });

  app.post("/api/sales-orders", async (req, res) => {
    try {
      const validated = schema.insertSalesOrderSchema.parse(req.body);
      const salesOrder = await storage.createSalesOrder(validated);
      res.status(201).json(salesOrder);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/sales-orders/:id", async (req, res) => {
    try {
      const salesOrder = await storage.updateSalesOrder(req.params.id, req.body);
      res.json(salesOrder);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/sales-orders/:id/items", async (req, res) => {
    const items = await storage.getSalesOrderItems(req.params.id);
    res.json(items);
  });

  app.post("/api/sales-order-items", async (req, res) => {
    try {
      const validated = schema.insertSalesOrderItemSchema.parse(req.body);
      const item = await storage.createSalesOrderItem(validated);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== PURCHASE ORDERS ====================
  
  app.get("/api/purchase-orders", async (_req, res) => {
    const purchaseOrders = await storage.getAllPurchaseOrders();
    res.json(purchaseOrders);
  });

  app.get("/api/purchase-orders/:id", async (req, res) => {
    const purchaseOrder = await storage.getPurchaseOrder(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    res.json(purchaseOrder);
  });

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      const validated = schema.insertPurchaseOrderSchema.parse(req.body);
      const purchaseOrder = await storage.createPurchaseOrder(validated);
      res.status(201).json(purchaseOrder);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/purchase-orders/:id", async (req, res) => {
    try {
      const purchaseOrder = await storage.updatePurchaseOrder(req.params.id, req.body);
      res.json(purchaseOrder);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/purchase-orders/:id/items", async (req, res) => {
    const items = await storage.getPurchaseOrderItems(req.params.id);
    res.json(items);
  });

  app.post("/api/purchase-order-items", async (req, res) => {
    try {
      const validated = schema.insertPurchaseOrderItemSchema.parse(req.body);
      const item = await storage.createPurchaseOrderItem(validated);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== CRM ROUTES ====================
  
  // Leads
  app.get("/api/leads", async (_req, res) => {
    const leads = await storage.getAllLeads();
    res.json(leads);
  });

  app.get("/api/leads/:id", async (req, res) => {
    const lead = await storage.getLead(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json(lead);
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const validated = schema.insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(validated);
      res.status(201).json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const lead = await storage.updateLead(req.params.id, req.body);
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Opportunities
  app.get("/api/opportunities", async (_req, res) => {
    const opportunities = await storage.getAllOpportunities();
    res.json(opportunities);
  });

  app.get("/api/opportunities/:id", async (req, res) => {
    const opportunity = await storage.getOpportunity(req.params.id);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    res.json(opportunity);
  });

  app.post("/api/opportunities", async (req, res) => {
    try {
      const validated = schema.insertOpportunitySchema.parse(req.body);
      const opportunity = await storage.createOpportunity(validated);
      res.status(201).json(opportunity);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/opportunities/:id", async (req, res) => {
    try {
      const opportunity = await storage.updateOpportunity(req.params.id, req.body);
      res.json(opportunity);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== ACCOUNTING ROUTES ====================
  
  // Accounts
  app.get("/api/accounts", async (_req, res) => {
    const accounts = await storage.getAllAccounts();
    res.json(accounts);
  });

  app.get("/api/accounts/:id", async (req, res) => {
    const account = await storage.getAccount(req.params.id);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    res.json(account);
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const validated = schema.insertAccountSchema.parse(req.body);
      const account = await storage.createAccount(validated);
      res.status(201).json(account);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Transactions
  app.get("/api/transactions", async (_req, res) => {
    const transactions = await storage.getAllTransactions();
    res.json(transactions);
  });

  app.get("/api/transactions/account/:accountId", async (req, res) => {
    const transactions = await storage.getTransactionsByAccount(req.params.accountId);
    res.json(transactions);
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const validated = schema.insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validated);
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== LOGISTICS ROUTES ====================
  
  // Vehicles
  app.get("/api/vehicles", async (_req, res) => {
    const vehicles = await storage.getAllVehicles();
    res.json(vehicles);
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    const vehicle = await storage.getVehicle(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    res.json(vehicle);
  });

  app.post("/api/vehicles", async (req, res) => {
    try {
      const validated = schema.insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(validated);
      res.status(201).json(vehicle);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/vehicles/:id", async (req, res) => {
    try {
      const vehicle = await storage.updateVehicle(req.params.id, req.body);
      res.json(vehicle);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Trips
  app.get("/api/trips", async (_req, res) => {
    const trips = await storage.getAllTrips();
    res.json(trips);
  });

  app.get("/api/trips/:id", async (req, res) => {
    const trip = await storage.getTrip(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }
    res.json(trip);
  });

  app.post("/api/trips", async (req, res) => {
    try {
      const validated = schema.insertTripSchema.parse(req.body);
      const trip = await storage.createTrip(validated);
      res.status(201).json(trip);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/trips/:id", async (req, res) => {
    try {
      const trip = await storage.updateTrip(req.params.id, req.body);
      res.json(trip);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
