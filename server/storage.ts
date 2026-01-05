// Database integration following blueprint:javascript_database
import { db } from "./db";
import { eq, desc, and, or, gte, lte, like } from "drizzle-orm";
import * as schema from "@shared/schema";

// ==================== STORAGE INTERFACE ====================
export interface IStorage {
  // Users
  getUser(id: string): Promise<schema.User | undefined>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  
  // Employees
  getAllEmployees(): Promise<schema.Employee[]>;
  getEmployee(id: string): Promise<schema.Employee | undefined>;
  createEmployee(employee: schema.InsertEmployee): Promise<schema.Employee>;
  updateEmployee(id: string, employee: Partial<schema.InsertEmployee>): Promise<schema.Employee>;
  deleteEmployee(id: string): Promise<void>;
  
  // Departments
  getAllDepartments(): Promise<schema.Department[]>;
  getDepartment(id: string): Promise<schema.Department | undefined>;
  createDepartment(department: schema.InsertDepartment): Promise<schema.Department>;
  updateDepartment(id: string, department: Partial<schema.InsertDepartment>): Promise<schema.Department>;
  deleteDepartment(id: string): Promise<void>;
  
  // Attendance
  getAllAttendance(): Promise<schema.Attendance[]>;
  getAttendanceByEmployee(employeeId: string): Promise<schema.Attendance[]>;
  createAttendance(attendance: schema.InsertAttendance): Promise<schema.Attendance>;
  
  // Leaves
  getAllLeaves(): Promise<schema.Leave[]>;
  getLeavesByEmployee(employeeId: string): Promise<schema.Leave[]>;
  createLeave(leave: schema.InsertLeave): Promise<schema.Leave>;
  updateLeaveStatus(id: string, status: string, approvedBy?: string): Promise<schema.Leave>;
  
  // Payroll
  getAllPayroll(): Promise<schema.Payroll[]>;
  getPayrollByEmployee(employeeId: string): Promise<schema.Payroll[]>;
  createPayroll(payroll: schema.InsertPayroll): Promise<schema.Payroll>;
  updatePayroll(id: string, payroll: Partial<schema.InsertPayroll>): Promise<schema.Payroll>;
  
  // Recruitment
  getAllJobPostings(): Promise<schema.JobPosting[]>;
  getJobPosting(id: string): Promise<schema.JobPosting | undefined>;
  createJobPosting(jobPosting: schema.InsertJobPosting): Promise<schema.JobPosting>;
  updateJobPosting(id: string, jobPosting: Partial<schema.InsertJobPosting>): Promise<schema.JobPosting>;
  
  getAllApplications(): Promise<schema.Application[]>;
  getApplicationsByJob(jobPostingId: string): Promise<schema.Application[]>;
  createApplication(application: schema.InsertApplication): Promise<schema.Application>;
  updateApplicationStatus(id: string, status: string): Promise<schema.Application>;
  
  // Products
  getAllProducts(): Promise<schema.Product[]>;
  getProduct(id: string): Promise<schema.Product | undefined>;
  createProduct(product: schema.InsertProduct): Promise<schema.Product>;
  updateProduct(id: string, product: Partial<schema.InsertProduct>): Promise<schema.Product>;
  deleteProduct(id: string): Promise<void>;
  
  // Stock Movements
  getAllStockMovements(): Promise<schema.StockMovement[]>;
  getStockMovementsByProduct(productId: string): Promise<schema.StockMovement[]>;
  createStockMovement(stockMovement: schema.InsertStockMovement): Promise<schema.StockMovement>;
  
  // Customers
  getAllCustomers(): Promise<schema.Customer[]>;
  getCustomer(id: string): Promise<schema.Customer | undefined>;
  createCustomer(customer: schema.InsertCustomer): Promise<schema.Customer>;
  updateCustomer(id: string, customer: Partial<schema.InsertCustomer>): Promise<schema.Customer>;
  deleteCustomer(id: string): Promise<void>;
  
  // Suppliers
  getAllSuppliers(): Promise<schema.Supplier[]>;
  getSupplier(id: string): Promise<schema.Supplier | undefined>;
  createSupplier(supplier: schema.InsertSupplier): Promise<schema.Supplier>;
  updateSupplier(id: string, supplier: Partial<schema.InsertSupplier>): Promise<schema.Supplier>;
  deleteSupplier(id: string): Promise<void>;
  
  // Sales Orders
  getAllSalesOrders(): Promise<schema.SalesOrder[]>;
  getSalesOrder(id: string): Promise<schema.SalesOrder | undefined>;
  createSalesOrder(salesOrder: schema.InsertSalesOrder): Promise<schema.SalesOrder>;
  updateSalesOrder(id: string, salesOrder: Partial<schema.InsertSalesOrder>): Promise<schema.SalesOrder>;
  
  getSalesOrderItems(salesOrderId: string): Promise<schema.SalesOrderItem[]>;
  createSalesOrderItem(item: schema.InsertSalesOrderItem): Promise<schema.SalesOrderItem>;
  
  // Purchase Orders
  getAllPurchaseOrders(): Promise<schema.PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<schema.PurchaseOrder | undefined>;
  createPurchaseOrder(purchaseOrder: schema.InsertPurchaseOrder): Promise<schema.PurchaseOrder>;
  updatePurchaseOrder(id: string, purchaseOrder: Partial<schema.InsertPurchaseOrder>): Promise<schema.PurchaseOrder>;
  
  getPurchaseOrderItems(purchaseOrderId: string): Promise<schema.PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: schema.InsertPurchaseOrderItem): Promise<schema.PurchaseOrderItem>;
  
  // CRM
  getAllLeads(): Promise<schema.Lead[]>;
  getLead(id: string): Promise<schema.Lead | undefined>;
  createLead(lead: schema.InsertLead): Promise<schema.Lead>;
  updateLead(id: string, lead: Partial<schema.InsertLead>): Promise<schema.Lead>;
  
  getAllOpportunities(): Promise<schema.Opportunity[]>;
  getOpportunity(id: string): Promise<schema.Opportunity | undefined>;
  createOpportunity(opportunity: schema.InsertOpportunity): Promise<schema.Opportunity>;
  updateOpportunity(id: string, opportunity: Partial<schema.InsertOpportunity>): Promise<schema.Opportunity>;
  
  // Accounting
  getAllAccounts(): Promise<schema.Account[]>;
  getAccount(id: string): Promise<schema.Account | undefined>;
  createAccount(account: schema.InsertAccount): Promise<schema.Account>;
  
  getAllTransactions(): Promise<schema.Transaction[]>;
  getTransactionsByAccount(accountId: string): Promise<schema.Transaction[]>;
  createTransaction(transaction: schema.InsertTransaction): Promise<schema.Transaction>;
  
  // Logistics
  getAllVehicles(): Promise<schema.Vehicle[]>;
  getVehicle(id: string): Promise<schema.Vehicle | undefined>;
  createVehicle(vehicle: schema.InsertVehicle): Promise<schema.Vehicle>;
  updateVehicle(id: string, vehicle: Partial<schema.InsertVehicle>): Promise<schema.Vehicle>;
  
  getAllTrips(): Promise<schema.Trip[]>;
  getTrip(id: string): Promise<schema.Trip | undefined>;
  createTrip(trip: schema.InsertTrip): Promise<schema.Trip>;
  updateTrip(id: string, trip: Partial<schema.InsertTrip>): Promise<schema.Trip>;
}

// ==================== DATABASE STORAGE IMPLEMENTATION ====================
export class DatabaseStorage implements IStorage {
  // ========== Users ==========
  async getUser(id: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: schema.InsertUser): Promise<schema.User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  // ========== Employees ==========
  async getAllEmployees(): Promise<schema.Employee[]> {
    return await db.select().from(schema.employees).orderBy(desc(schema.employees.createdAt));
  }

  async getEmployee(id: string): Promise<schema.Employee | undefined> {
    const [employee] = await db.select().from(schema.employees).where(eq(schema.employees.id, id));
    return employee || undefined;
  }

  async createEmployee(employee: schema.InsertEmployee): Promise<schema.Employee> {
    const [newEmployee] = await db.insert(schema.employees).values(employee).returning();
    return newEmployee;
  }

  async updateEmployee(id: string, employee: Partial<schema.InsertEmployee>): Promise<schema.Employee> {
    const [updated] = await db.update(schema.employees).set(employee).where(eq(schema.employees.id, id)).returning();
    return updated;
  }

  async deleteEmployee(id: string): Promise<void> {
    await db.delete(schema.employees).where(eq(schema.employees.id, id));
  }

  // ========== Departments ==========
  async getAllDepartments(): Promise<schema.Department[]> {
    return await db.select().from(schema.departments).orderBy(schema.departments.name);
  }

  async getDepartment(id: string): Promise<schema.Department | undefined> {
    const [department] = await db.select().from(schema.departments).where(eq(schema.departments.id, id));
    return department || undefined;
  }

  async createDepartment(department: schema.InsertDepartment): Promise<schema.Department> {
    const [newDepartment] = await db.insert(schema.departments).values(department).returning();
    return newDepartment;
  }

  async updateDepartment(id: string, department: Partial<schema.InsertDepartment>): Promise<schema.Department> {
    const [updated] = await db.update(schema.departments).set(department).where(eq(schema.departments.id, id)).returning();
    return updated;
  }

  async deleteDepartment(id: string): Promise<void> {
    await db.delete(schema.departments).where(eq(schema.departments.id, id));
  }

  // ========== Attendance ==========
  async getAllAttendance(): Promise<schema.Attendance[]> {
    return await db.select().from(schema.attendance).orderBy(desc(schema.attendance.date));
  }

  async getAttendanceByEmployee(employeeId: string): Promise<schema.Attendance[]> {
    return await db.select().from(schema.attendance)
      .where(eq(schema.attendance.employeeId, employeeId))
      .orderBy(desc(schema.attendance.date));
  }

  async createAttendance(attendance: schema.InsertAttendance): Promise<schema.Attendance> {
    const [newAttendance] = await db.insert(schema.attendance).values(attendance).returning();
    return newAttendance;
  }

  // ========== Leaves ==========
  async getAllLeaves(): Promise<schema.Leave[]> {
    return await db.select().from(schema.leaves).orderBy(desc(schema.leaves.createdAt));
  }

  async getLeavesByEmployee(employeeId: string): Promise<schema.Leave[]> {
    return await db.select().from(schema.leaves)
      .where(eq(schema.leaves.employeeId, employeeId))
      .orderBy(desc(schema.leaves.createdAt));
  }

  async createLeave(leave: schema.InsertLeave): Promise<schema.Leave> {
    const [newLeave] = await db.insert(schema.leaves).values(leave).returning();
    return newLeave;
  }

  async updateLeaveStatus(id: string, status: string, approvedBy?: string): Promise<schema.Leave> {
    const updateData: any = { status };
    if (approvedBy) {
      updateData.approvedBy = approvedBy;
      updateData.approvedAt = new Date();
    }
    const [updated] = await db.update(schema.leaves).set(updateData).where(eq(schema.leaves.id, id)).returning();
    return updated;
  }

  // ========== Payroll ==========
  async getAllPayroll(): Promise<schema.Payroll[]> {
    return await db.select().from(schema.payroll).orderBy(desc(schema.payroll.year), desc(schema.payroll.month));
  }

  async getPayrollByEmployee(employeeId: string): Promise<schema.Payroll[]> {
    return await db.select().from(schema.payroll)
      .where(eq(schema.payroll.employeeId, employeeId))
      .orderBy(desc(schema.payroll.year), desc(schema.payroll.month));
  }

  async createPayroll(payroll: schema.InsertPayroll): Promise<schema.Payroll> {
    const [newPayroll] = await db.insert(schema.payroll).values(payroll).returning();
    return newPayroll;
  }

  async updatePayroll(id: string, payroll: Partial<schema.InsertPayroll>): Promise<schema.Payroll> {
    const [updated] = await db.update(schema.payroll).set(payroll).where(eq(schema.payroll.id, id)).returning();
    return updated;
  }

  // ========== Job Postings ==========
  async getAllJobPostings(): Promise<schema.JobPosting[]> {
    return await db.select().from(schema.jobPostings).orderBy(desc(schema.jobPostings.createdAt));
  }

  async getJobPosting(id: string): Promise<schema.JobPosting | undefined> {
    const [jobPosting] = await db.select().from(schema.jobPostings).where(eq(schema.jobPostings.id, id));
    return jobPosting || undefined;
  }

  async createJobPosting(jobPosting: schema.InsertJobPosting): Promise<schema.JobPosting> {
    const [newJobPosting] = await db.insert(schema.jobPostings).values(jobPosting).returning();
    return newJobPosting;
  }

  async updateJobPosting(id: string, jobPosting: Partial<schema.InsertJobPosting>): Promise<schema.JobPosting> {
    const [updated] = await db.update(schema.jobPostings).set(jobPosting).where(eq(schema.jobPostings.id, id)).returning();
    return updated;
  }

  // ========== Applications ==========
  async getAllApplications(): Promise<schema.Application[]> {
    return await db.select().from(schema.applications).orderBy(desc(schema.applications.createdAt));
  }

  async getApplicationsByJob(jobPostingId: string): Promise<schema.Application[]> {
    return await db.select().from(schema.applications)
      .where(eq(schema.applications.jobPostingId, jobPostingId))
      .orderBy(desc(schema.applications.createdAt));
  }

  async createApplication(application: schema.InsertApplication): Promise<schema.Application> {
    const [newApplication] = await db.insert(schema.applications).values(application).returning();
    return newApplication;
  }

  async updateApplicationStatus(id: string, status: string): Promise<schema.Application> {
    const [updated] = await db.update(schema.applications).set({ status }).where(eq(schema.applications.id, id)).returning();
    return updated;
  }

  // ========== Products ==========
  async getAllProducts(): Promise<schema.Product[]> {
    return await db.select().from(schema.products).orderBy(schema.products.name);
  }

  async getProduct(id: string): Promise<schema.Product | undefined> {
    const [product] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    return product || undefined;
  }

  async createProduct(product: schema.InsertProduct): Promise<schema.Product> {
    const [newProduct] = await db.insert(schema.products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<schema.InsertProduct>): Promise<schema.Product> {
    const [updated] = await db.update(schema.products).set(product).where(eq(schema.products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(schema.products).where(eq(schema.products.id, id));
  }

  // ========== Stock Movements ==========
  async getAllStockMovements(): Promise<schema.StockMovement[]> {
    return await db.select().from(schema.stockMovements).orderBy(desc(schema.stockMovements.createdAt));
  }

  async getStockMovementsByProduct(productId: string): Promise<schema.StockMovement[]> {
    return await db.select().from(schema.stockMovements)
      .where(eq(schema.stockMovements.productId, productId))
      .orderBy(desc(schema.stockMovements.createdAt));
  }

  async createStockMovement(stockMovement: schema.InsertStockMovement): Promise<schema.StockMovement> {
    const [newStockMovement] = await db.insert(schema.stockMovements).values(stockMovement).returning();
    return newStockMovement;
  }

  // ========== Customers ==========
  async getAllCustomers(): Promise<schema.Customer[]> {
    return await db.select().from(schema.customers).orderBy(schema.customers.name);
  }

  async getCustomer(id: string): Promise<schema.Customer | undefined> {
    const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
    return customer || undefined;
  }

  async createCustomer(customer: schema.InsertCustomer): Promise<schema.Customer> {
    const [newCustomer] = await db.insert(schema.customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: string, customer: Partial<schema.InsertCustomer>): Promise<schema.Customer> {
    const [updated] = await db.update(schema.customers).set(customer).where(eq(schema.customers.id, id)).returning();
    return updated;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(schema.customers).where(eq(schema.customers.id, id));
  }

  // ========== Suppliers ==========
  async getAllSuppliers(): Promise<schema.Supplier[]> {
    return await db.select().from(schema.suppliers).orderBy(schema.suppliers.name);
  }

  async getSupplier(id: string): Promise<schema.Supplier | undefined> {
    const [supplier] = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id));
    return supplier || undefined;
  }

  async createSupplier(supplier: schema.InsertSupplier): Promise<schema.Supplier> {
    const [newSupplier] = await db.insert(schema.suppliers).values(supplier).returning();
    return newSupplier;
  }

  async updateSupplier(id: string, supplier: Partial<schema.InsertSupplier>): Promise<schema.Supplier> {
    const [updated] = await db.update(schema.suppliers).set(supplier).where(eq(schema.suppliers.id, id)).returning();
    return updated;
  }

  async deleteSupplier(id: string): Promise<void> {
    await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id));
  }

  // ========== Sales Orders ==========
  async getAllSalesOrders(): Promise<schema.SalesOrder[]> {
    return await db.select().from(schema.salesOrders).orderBy(desc(schema.salesOrders.createdAt));
  }

  async getSalesOrder(id: string): Promise<schema.SalesOrder | undefined> {
    const [salesOrder] = await db.select().from(schema.salesOrders).where(eq(schema.salesOrders.id, id));
    return salesOrder || undefined;
  }

  async createSalesOrder(salesOrder: schema.InsertSalesOrder): Promise<schema.SalesOrder> {
    const [newSalesOrder] = await db.insert(schema.salesOrders).values(salesOrder).returning();
    return newSalesOrder;
  }

  async updateSalesOrder(id: string, salesOrder: Partial<schema.InsertSalesOrder>): Promise<schema.SalesOrder> {
    const [updated] = await db.update(schema.salesOrders).set(salesOrder).where(eq(schema.salesOrders.id, id)).returning();
    return updated;
  }

  async getSalesOrderItems(salesOrderId: string): Promise<schema.SalesOrderItem[]> {
    return await db.select().from(schema.salesOrderItems)
      .where(eq(schema.salesOrderItems.salesOrderId, salesOrderId));
  }

  async createSalesOrderItem(item: schema.InsertSalesOrderItem): Promise<schema.SalesOrderItem> {
    const [newItem] = await db.insert(schema.salesOrderItems).values(item).returning();
    return newItem;
  }

  // ========== Purchase Orders ==========
  async getAllPurchaseOrders(): Promise<schema.PurchaseOrder[]> {
    return await db.select().from(schema.purchaseOrders).orderBy(desc(schema.purchaseOrders.createdAt));
  }

  async getPurchaseOrder(id: string): Promise<schema.PurchaseOrder | undefined> {
    const [purchaseOrder] = await db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, id));
    return purchaseOrder || undefined;
  }

  async createPurchaseOrder(purchaseOrder: schema.InsertPurchaseOrder): Promise<schema.PurchaseOrder> {
    const [newPurchaseOrder] = await db.insert(schema.purchaseOrders).values(purchaseOrder).returning();
    return newPurchaseOrder;
  }

  async updatePurchaseOrder(id: string, purchaseOrder: Partial<schema.InsertPurchaseOrder>): Promise<schema.PurchaseOrder> {
    const [updated] = await db.update(schema.purchaseOrders).set(purchaseOrder).where(eq(schema.purchaseOrders.id, id)).returning();
    return updated;
  }

  async getPurchaseOrderItems(purchaseOrderId: string): Promise<schema.PurchaseOrderItem[]> {
    return await db.select().from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async createPurchaseOrderItem(item: schema.InsertPurchaseOrderItem): Promise<schema.PurchaseOrderItem> {
    const [newItem] = await db.insert(schema.purchaseOrderItems).values(item).returning();
    return newItem;
  }

  // ========== CRM - Leads ==========
  async getAllLeads(): Promise<schema.Lead[]> {
    return await db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt));
  }

  async getLead(id: string): Promise<schema.Lead | undefined> {
    const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, id));
    return lead || undefined;
  }

  async createLead(lead: schema.InsertLead): Promise<schema.Lead> {
    const [newLead] = await db.insert(schema.leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: string, lead: Partial<schema.InsertLead>): Promise<schema.Lead> {
    const [updated] = await db.update(schema.leads).set(lead).where(eq(schema.leads.id, id)).returning();
    return updated;
  }

  // ========== CRM - Opportunities ==========
  async getAllOpportunities(): Promise<schema.Opportunity[]> {
    return await db.select().from(schema.opportunities).orderBy(desc(schema.opportunities.createdAt));
  }

  async getOpportunity(id: string): Promise<schema.Opportunity | undefined> {
    const [opportunity] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id));
    return opportunity || undefined;
  }

  async createOpportunity(opportunity: schema.InsertOpportunity): Promise<schema.Opportunity> {
    const [newOpportunity] = await db.insert(schema.opportunities).values(opportunity).returning();
    return newOpportunity;
  }

  async updateOpportunity(id: string, opportunity: Partial<schema.InsertOpportunity>): Promise<schema.Opportunity> {
    const [updated] = await db.update(schema.opportunities).set(opportunity).where(eq(schema.opportunities.id, id)).returning();
    return updated;
  }

  // ========== Accounting - Accounts ==========
  async getAllAccounts(): Promise<schema.Account[]> {
    return await db.select().from(schema.accounts).orderBy(schema.accounts.accountCode);
  }

  async getAccount(id: string): Promise<schema.Account | undefined> {
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, id));
    return account || undefined;
  }

  async createAccount(account: schema.InsertAccount): Promise<schema.Account> {
    const [newAccount] = await db.insert(schema.accounts).values(account).returning();
    return newAccount;
  }

  // ========== Accounting - Transactions ==========
  async getAllTransactions(): Promise<schema.Transaction[]> {
    return await db.select().from(schema.transactions).orderBy(desc(schema.transactions.createdAt));
  }

  async getTransactionsByAccount(accountId: string): Promise<schema.Transaction[]> {
    return await db.select().from(schema.transactions)
      .where(eq(schema.transactions.accountId, accountId))
      .orderBy(desc(schema.transactions.transactionDate));
  }

  async createTransaction(transaction: schema.InsertTransaction): Promise<schema.Transaction> {
    const [newTransaction] = await db.insert(schema.transactions).values(transaction).returning();
    return newTransaction;
  }

  // ========== Logistics - Vehicles ==========
  async getAllVehicles(): Promise<schema.Vehicle[]> {
    return await db.select().from(schema.vehicles).orderBy(schema.vehicles.vehicleNumber);
  }

  async getVehicle(id: string): Promise<schema.Vehicle | undefined> {
    const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, id));
    return vehicle || undefined;
  }

  async createVehicle(vehicle: schema.InsertVehicle): Promise<schema.Vehicle> {
    const [newVehicle] = await db.insert(schema.vehicles).values(vehicle).returning();
    return newVehicle;
  }

  async updateVehicle(id: string, vehicle: Partial<schema.InsertVehicle>): Promise<schema.Vehicle> {
    const [updated] = await db.update(schema.vehicles).set(vehicle).where(eq(schema.vehicles.id, id)).returning();
    return updated;
  }

  // ========== Logistics - Trips ==========
  async getAllTrips(): Promise<schema.Trip[]> {
    return await db.select().from(schema.trips).orderBy(desc(schema.trips.createdAt));
  }

  async getTrip(id: string): Promise<schema.Trip | undefined> {
    const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, id));
    return trip || undefined;
  }

  async createTrip(trip: schema.InsertTrip): Promise<schema.Trip> {
    const [newTrip] = await db.insert(schema.trips).values(trip).returning();
    return newTrip;
  }

  async updateTrip(id: string, trip: Partial<schema.InsertTrip>): Promise<schema.Trip> {
    const [updated] = await db.update(schema.trips).set(trip).where(eq(schema.trips.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
