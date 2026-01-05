import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as schema from "@shared/schema";

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
