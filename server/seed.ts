import { db } from "./db";
import * as schema from "@shared/schema";

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // Seed Departments
    const [hrDept, salesDept, techDept] = await db.insert(schema.departments).values([
      { name: "Human Resources", code: "HR", description: "HR Department", status: "active" },
      { name: "Sales", code: "SALES", description: "Sales Department", status: "active" },
      { name: "Technology", code: "TECH", description: "Technology Department", status: "active" },
    ]).returning();
    console.log("✅ Departments created");

    // Seed Employees
    await db.insert(schema.employees).values([
      {
        employeeId: "EMP001",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@company.com",
        phone: "+1234567890",
        dateOfBirth: "1990-05-15",
        dateOfJoining: "2020-01-10",
        departmentId: hrDept.id,
        designation: "HR Manager",
        employmentType: "Full-time",
        status: "active",
        address: "123 Main St",
        city: "New York",
        state: "NY",
        country: "USA",
        postalCode: "10001",
      },
      {
        employeeId: "EMP002",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@company.com",
        phone: "+1234567891",
        dateOfBirth: "1988-08-20",
        dateOfJoining: "2019-03-15",
        departmentId: salesDept.id,
        designation: "Sales Manager",
        employmentType: "Full-time",
        status: "active",
        address: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        country: "USA",
        postalCode: "90001",
      },
      {
        employeeId: "EMP003",
        firstName: "Mike",
        lastName: "Johnson",
        email: "mike.johnson@company.com",
        phone: "+1234567892",
        dateOfBirth: "1992-03-10",
        dateOfJoining: "2021-06-01",
        departmentId: techDept.id,
        designation: "Software Engineer",
        employmentType: "Full-time",
        status: "active",
        address: "789 Pine St",
        city: "San Francisco",
        state: "CA",
        country: "USA",
        postalCode: "94102",
      },
    ]);
    console.log("✅ Employees created");

    // Seed Job Postings
    await db.insert(schema.jobPostings).values([
      {
        title: "Senior Software Engineer",
        departmentId: techDept.id,
        description: "We are looking for a senior software engineer to join our team",
        requirements: "5+ years of experience in software development",
        location: "San Francisco, CA",
        employmentType: "Full-time",
        salaryRange: "$120,000 - $180,000",
        status: "open",
        openings: 2,
        closingDate: "2025-03-31",
      },
      {
        title: "Sales Representative",
        departmentId: salesDept.id,
        description: "Join our sales team to drive business growth",
        requirements: "2+ years of sales experience",
        location: "New York, NY",
        employmentType: "Full-time",
        salaryRange: "$60,000 - $90,000",
        status: "open",
        openings: 3,
        closingDate: "2025-02-28",
      },
    ]);
    console.log("✅ Job postings created");

    // Seed Products
    await db.insert(schema.products).values([
      {
        sku: "PRD001",
        name: "Laptop",
        description: "High-performance laptop",
        category: "Electronics",
        unit: "piece",
        purchasePrice: "800.00",
        sellingPrice: "1200.00",
        currentStock: 50,
        minStock: 10,
        maxStock: 100,
        status: "active",
      },
      {
        sku: "PRD002",
        name: "Office Chair",
        description: "Ergonomic office chair",
        category: "Furniture",
        unit: "piece",
        purchasePrice: "150.00",
        sellingPrice: "250.00",
        currentStock: 30,
        minStock: 5,
        maxStock: 50,
        status: "active",
      },
      {
        sku: "PRD003",
        name: "Desk",
        description: "Standing desk",
        category: "Furniture",
        unit: "piece",
        purchasePrice: "300.00",
        sellingPrice: "500.00",
        currentStock: 20,
        minStock: 5,
        maxStock: 40,
        status: "active",
      },
    ]);
    console.log("✅ Products created");

    // Seed Customers
    await db.insert(schema.customers).values([
      {
        name: "Acme Corporation",
        email: "contact@acme.com",
        phone: "+1555123456",
        company: "Acme Corp",
        address: "100 Business Blvd",
        city: "Chicago",
        state: "IL",
        country: "USA",
        postalCode: "60601",
        status: "active",
      },
      {
        name: "Tech Solutions Inc",
        email: "info@techsolutions.com",
        phone: "+1555234567",
        company: "Tech Solutions",
        address: "200 Innovation Dr",
        city: "Austin",
        state: "TX",
        country: "USA",
        postalCode: "73301",
        status: "active",
      },
    ]);
    console.log("✅ Customers created");

    // Seed Suppliers
    await db.insert(schema.suppliers).values([
      {
        name: "Electronics Wholesale",
        email: "sales@electronics.com",
        phone: "+1555345678",
        company: "Electronics Wholesale Inc",
        address: "300 Supplier St",
        city: "Seattle",
        state: "WA",
        country: "USA",
        postalCode: "98101",
        status: "active",
      },
      {
        name: "Furniture Direct",
        email: "orders@furniture.com",
        phone: "+1555456789",
        company: "Furniture Direct LLC",
        address: "400 Warehouse Ave",
        city: "Portland",
        state: "OR",
        country: "USA",
        postalCode: "97201",
        status: "active",
      },
    ]);
    console.log("✅ Suppliers created");

    // Seed CRM Leads
    await db.insert(schema.leads).values([
      {
        name: "Sarah Williams",
        email: "sarah@example.com",
        phone: "+1555567890",
        company: "StartupXYZ",
        source: "Website",
        status: "new",
        notes: "Interested in bulk purchase",
      },
      {
        name: "David Brown",
        email: "david@example.com",
        phone: "+1555678901",
        company: "Enterprise Co",
        source: "Referral",
        status: "contacted",
        notes: "Following up on proposal",
      },
    ]);
    console.log("✅ Leads created");

    // Seed Vehicles
    await db.insert(schema.vehicles).values([
      {
        vehicleNumber: "VEH001",
        vehicleType: "Truck",
        capacity: "5000.00",
        status: "available",
      },
      {
        vehicleNumber: "VEH002",
        vehicleType: "Van",
        capacity: "2000.00",
        status: "available",
      },
    ]);
    console.log("✅ Vehicles created");

    // Seed Accounting Accounts
    await db.insert(schema.accounts).values([
      {
        accountCode: "1000",
        accountName: "Cash",
        accountType: "Asset",
        balance: "100000.00",
        status: "active",
      },
      {
        accountCode: "2000",
        accountName: "Accounts Payable",
        accountType: "Liability",
        balance: "50000.00",
        status: "active",
      },
      {
        accountCode: "3000",
        accountName: "Revenue",
        accountType: "Income",
        balance: "200000.00",
        status: "active",
      },
      {
        accountCode: "4000",
        accountName: "Expenses",
        accountType: "Expense",
        balance: "75000.00",
        status: "active",
      },
    ]);
    console.log("✅ Accounts created");

    console.log("🎉 Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

seed().then(() => {
  console.log("✨ Seed completed");
  process.exit(0);
}).catch((error) => {
  console.error("Failed to seed:", error);
  process.exit(1);
});
