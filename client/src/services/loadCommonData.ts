import { commonApi } from "@/api/commonApi";

/** LEAVE_TYPE rows from getentityvalues (same source as /common/getleavetype). */
export function isLeaveTypeEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (s === "leave type" || s === "leave types") return true;
  return s.includes("leave") && s.includes("type");
}

/** Worker/work category rows in entity_values (same source as /common/getworkcategory). */
export function isWorkCategoryEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (s === "worker category" || s === "work category" || s === "worker categories" || s === "work categories") {
    return true;
  }
  return s.includes("worker") && s.includes("categor");
}

/**
 * BIN_TYPE rows in entity_values (same source as /common/getbintypes).
 * Backend uses entity_types.code = 'BIN_TYPE'; getentityvalues sends entity_types.name as entity_type_name.
 * Match common name variants without backend changes.
 */
export function isBinTypeEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const raw = name.trim();
  if (!raw) return false;
  const s = raw.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (s === "bin type" || s === "bin types") return true;
  // "BIN_TYPE", "BinType", "bin-type" after normalize
  const compact = raw.replace(/[\s_-]/g, "").toLowerCase();
  if (compact === "bintype" || compact === "bintypes") return true;
  // Human labels: "Storage Bin Type", etc.
  if (s.includes("bin") && s.includes("type")) return true;
  return false;
}

/** EARNING_TYPE rows from getentityvalues. */
export function isEarningTypeEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (s === "earning type" || s === "earning types") return true;
  return s.includes("earning") && s.includes("type");
}

/** DEDUCTION_TYPE rows from getentityvalues. */
export function isDeductionTypeEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (s === "deduction type" || s === "deduction types") return true;
  return s.includes("deduction") && s.includes("type");
}

/** CALCULATION_TYPE rows from getentityvalues. */
export function isCalculationTypeEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  // Matches "Calculation Type", "CALCULATION_TYPE", "CalculationTypes", etc.
  if (s === "calculation type" || s === "calculation types" || s === "calculationtype" || s === "calculationtypes") return true;
  return s.includes("calculation") && s.includes("type");
}

/** WORKER_PAYROLL_STATUS rows from getentityvalues. */
export function isWorkerPayrollStatusEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  // Matches "Worker Payroll Status", "Worker Wage Status", "WORKER_PAYROLL_STATUS", etc.
  if (s === "worker payroll status" || s === "worker payroll statuses" || s === "worker wage status" || s === "worker wage statuses") return true;
  return (s.includes("worker") || s.includes("wage")) && s.includes("status");
}

/** PO_STATUS rows from getentityvalues. */
export function isPOStatusEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (s === "po status" || s === "po statuses" || s === "purchase order status") return true;
  return (s.includes("po") || s.includes("purchase")) && s.includes("status");
}
/** PRODUCTION_PLAN_STATUS rows from getentityvalues. */
export function isProductionPlanStatusEntityName(name: string | null | undefined, code?: string | null): boolean {
  if (code === "PRODUCTION_PLAN_STATUS") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "production plan status" || s === "production plan statuses";
}
/** PRODUCTION_MR_STATUS rows from getentityvalues. */
export function isMRStatusEntityName(name: string | null | undefined, code?: string | null): boolean {
  // Canonical match by code (ID 60 in your database)
  if (code === "PRODUCTION_MR_STATUS") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  // Match the exact name from your database: "Production Material Request Status"
  return s === "production material request status" || s === "production mr status";
}
/** PRODUCTION_BATCH_STATUS rows from getentityvalues. */
export function isBatchStatusEntityName(name: string | null | undefined, code?: string | null): boolean {
  if (code === "PRODUCTION_BATCH_STATUS") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "production batch status" || s === "production batch statuses";
}

/** Quotation_status rows from getentityvalues. */
export function isQuotationStatusEntityName(name: string | null | undefined, code?: string | null): boolean {
  if (code === "Quotation_status" || code === "QUOTATION_STATUS") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "quotation status" || s === "quotation statuses" || s === "quotation_status";
}

/** SALE_ORDER_STATUS rows from getentityvalues. */
export function isSalesOrderStatusEntityName(name: string | null | undefined, code?: string | null): boolean {
  if (code === "SALE_ORDER_STATUS" || code === "SALES_ORDER_STATUS") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "sale order status" || s === "sale order statuses" || s === "sales order status" || s === "sales order statuses";
}

/** INVOICING_STATUS_ID rows from getentityvalues. */
export function isInvoicingStatusEntityName(name: string | null | undefined, code?: string | null, entityTypeId?: number | string | null): boolean {
  if (code === "INVOICING_STATUS_ID" || String(entityTypeId) === "68") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  // Match variants including the typo "stauts" seen in the database
  return s === "invoicing status" || s === "invoicing statuses" || s === "invoicing_status_id" || s.includes("invoicing stauts");
}

/**
 * PRODUCTION_MATERIAL_RELEASE_STATUS (entity_types.id = 61 in a typical DB).
 * Values: e.g. ISSUED_TO_WAREHOUSE (209), RECEIVED_BY_WAREHOUSE (210). Not the same as PRODUCTION_MR_STATUS.
 */
export function isMaterialReleaseStatusEntityName(
  name: string | null | undefined,
  code?: string | null,
  entityTypeId?: number | null
): boolean {
  if (code === "PRODUCTION_MATERIAL_RELEASE_STATUS") return true;
  if (entityTypeId != null && Number(entityTypeId) === 61) return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "material release status" || s === "material release statuses";
}

/** PAYMENT_TERM rows from getentityvalues. */
export function isPaymentTermEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (s === "payment term" || s === "payment terms") return true;
  return false;
}

export function isPaymentModeEntityName(name: string | null | undefined, code?: string | null, entityTypeId?: number | string | null): boolean {
  if (code === "PAYMENT_MODE" || code === "PAYMENT_METHOD" || code === "PAYMENT_MODE_ID" || String(entityTypeId) === "70") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "payment mode" || s === "payment modes" || s === "payment method" || s === "payment methods";
}

/** CURRENCY rows from getentityvalues. */
export function isCurrencyEntityName(name: string | null | undefined, code?: string | null): boolean {
  if (code === "CURRENCY") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "currency" || s === "currencies";
}

/** PAYMENT_TERM_TYPE rows from getentityvalues. */
export function isPaymentTermTypeEntityName(name: string | null | undefined, code?: string | null, entityTypeId?: number | string | null): boolean {
  if (code === "PAYMENT_TERM_TYPE" || String(entityTypeId) === "63") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "payment term type" || s === "payment term types";
}

/** PAYMENT_TAX_TYPE rows from getentityvalues. */
export function isPaymentTaxTypeEntityName(name: string | null | undefined, code?: string | null): boolean {
  if (code === "PAYMENT_TAX_TYPE") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "payment tax type" || s === "payment tax types";
}

/** PAYMENT_DISCOUNT_TYPE rows from getentityvalues. */
export function isPaymentDiscountTypeEntityName(name: string | null | undefined, code?: string | null): boolean {
  if (code === "PAYMENT_DISCOUNT_TYPE") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "payment discount type" || s === "payment discount types";
}

/** PEENDING_PAYMENT_STATUS rows from getentityvalues. */
export function isPendingPaymentStatusEntityName(name: string | null | undefined, code?: string | null, entityTypeId?: number | string | null): boolean {
  if (code === "PEENDING_PAYMENT_STATUS" || String(entityTypeId) === "71") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "pending payment status" || s === "pending payment statuses" || s === "peending payment status";
}

export function isFollowUpStatusEntityName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  const n = name.trim().toLowerCase();
  return n === 'follow_status_id' || n === 'follow status id' || n === 'follow_stauts_id' || n === 'follow stauts id';
}

export function isDispatchStatusEntityName(name: string | null | undefined, code?: string | null): boolean {
  if (code === "DISPATCH_STATUS") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "dispatch status" || s === "dispatch statuses";
}

export function isSMRStatusEntityName(name: string | null | undefined, code?: string | null): boolean {
  if (code === "SMR_STATUS" || code === "SERVICE_MATERIAL_REQUEST_STATUS" || code === "MATERIAL_REQUISITION_STATUS") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/[\s\-_]/g, " ");
  return (
    s === "smr status" || 
    s === "smr statuses" || 
    s === "service material request status" || 
    s === "service material request statuses" ||
    s === "material requisition status" ||
    s === "material requisition statuses" ||
    s === "material requisition"
  );
}

/** WARRANTY_SERVICE_REQUEST rows from getentityvalues (entity_types.id = 73). */
export function isWarrantyServiceRequestStatusEntityName(
  name: string | null | undefined,
  code?: string | null,
  entityTypeId?: number | string | null
): boolean {
  if (code === "WARRANTY_SERVICE_REQUEST") return true;
  if (entityTypeId != null && String(entityTypeId) === "73") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "warranty service request" || s === "warranty service request status" || s === "warranty service requests";
}

/** CLAIM rows from getentityvalues (entity_types.id = 75, code CLAIM). */
export function isClaimEntityName(
  name: string | null | undefined,
  code?: string | null,
  entityTypeId?: number | string | null
): boolean {
  if (code === "CLAIM") return true;
  if (entityTypeId != null && String(entityTypeId) === "75") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "claim" || s === "claims";
}

/** WARRANTY_STATUS rows from getentityvalues (entity_types.id = 74, code WARRANTY_STATUS). */
export function isWarrantyStatusEntityName(
  name: string | null | undefined,
  code?: string | null,
  entityTypeId?: number | string | null
): boolean {
  if (code === "WARRANTY_STATUS") return true;
  if (entityTypeId != null && String(entityTypeId) === "74") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "warranty status" || s === "warranty statuses";
}

/** SELECT_ACTION rows from getentityvalues (entity_types.id = 76, code SELECT_ACTION). */
export function isSelectActionEntityName(
  name: string | null | undefined,
  code?: string | null,
  entityTypeId?: number | string | null
): boolean {
  if (code === "SELECT_ACTION") return true;
  if (entityTypeId != null && String(entityTypeId) === "76") return true;
  if (name == null || typeof name !== "string") return false;
  const s = name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return s === "select action" || s === "select_action" || s === "select actions";
}

/** 
 * Helper to normalize calculation type codes based on value_code or value_name patterns.
 * 
 * WHY THIS IS NEEDED:
 * The backend API (getentityvalues) currently does not return the 'entity_value' column,
 * which contains the canonical codes like 'FLAT' or 'PCT_CTC'. To avoid hardcoding
 * IDs (which vary by database) or breaking when labels change, we "guess" the intended
 * calculation mode by scanning common text patterns in the name and raw codes.
 * 
 * Ensures consistent 'FLAT', 'PCT_CTC', 'PCT_BASIC', 'REMAINING' codes across the app.
 */
export function normalizeCalculationTypeCode(record: any): string | undefined {
  if (!record) return undefined;
  
  // 1. If backend already provides entity_value, use it as priority
  if (record.entity_value) return String(record.entity_value).toUpperCase();
  
  // 2. Otherwise, guess from value_code or value_name
  const raw = (record.value_code || record.value_name || "").toUpperCase().replace(/[\s-_]/g, '');
  
  if (raw.includes("FLAT") || raw.includes("FIXED")) return "FLAT";
  if (raw.includes("PCTCTC") || raw.includes("PERCENTAGEOFCTC") || (raw.includes("CTC") && raw.includes("PCT"))) return "PCT_CTC";
  if (raw.includes("PCTBASIC") || raw.includes("PERCENTAGEOFBASIC") || (raw.includes("BASIC") && raw.includes("PCT"))) return "PCT_BASIC";
  if (raw.includes("REMAIN")) return "REMAINING";
  
  // Return original value_code if no match, to avoid data loss
  return record.value_code;
}

/**
 * Interface for the state required by loadCommonData.
 * Using a minimal interface to avoid circular dependencies if possible.
 */
interface StoreRef {
  isLoaded: boolean;
  isLoading: boolean;
  companyId?: number | string;
  setCommonData: (data: any) => void;
  setLoading: (isLoading: boolean) => void;
}

/**
 * Service to orchestrate loading of all common master data.
 * Features:
 * 1. early return if data is already loaded or being loaded (unless force=true).
 * 2. Parallel loading of entity values and company-specific details.
 * 3. Centralized error handling.
 */
export async function loadCommonData(store: StoreRef, force = false) {
  // Always return if a load is already in progress to prevent overlapping calls
  if (store.isLoading) {
    return;
  }

  // If not forcing, skip if data already exists
  if (!force && store.isLoaded) {
    return;
  }

  store.setLoading(true);
  // console.log("📦 Initializing Master Data Load...");
  
  try {
    // 1. Prepare parallel requests
    const requests: Promise<any>[] = [
      commonApi.getEntityValues({ status: 1 })
    ];

    // 2. Add company details fetch if ID is available
    if (store.companyId) {
      // console.log(`🏢 Fetching details for Company ID: ${store.companyId}`);
      requests.push(commonApi.getCompanyDetails(store.companyId));
    }

    const [entityRes, companyRes] = await Promise.all(requests);

    if (entityRes.isSuccessful) {
      const records = entityRes.data?.records || [];
      const companyDetails = (companyRes?.isSuccessful) ? companyRes.data : null;
      
      // Group records by entity_type_name
      const groupedData: any = {
        entityValues: records,
        companyDetails,
        departments: [],
        designations: [],
        shifts: [],
        employmentTypes: [],
        locations: [],
        leaveTypes: [],
        workCategories: [],
        binTypes: [],
        currencies: [],
        itemTypes: [],
        uoms: [],
        calculationTypes: [],
        earningTypes: [],
        deductionTypes: [],
        genders: [],
        nationalities: [],
        bloodGroups: [],
        maritalStatuses: [],
        grades: [],
        employmentStatuses: [],
        documentTypes: [],
        workerPayrollStatuses: [],
        poStatuses: [],
        productionPlanStatuses: [],
        mrStatuses: [],
        batchStatuses: [],
        paymentTerms: [],
        paymentTermTypes: [],
        paymentTaxTypes: [],
        paymentDiscountTypes: [],
        quotationStatuses: [],
        salesOrderStatuses: [],
        invoicingStatuses: [],
        pendingPaymentStatuses: [],
        followUpStatuses: [],
        paymentModes: [],
        dispatchStatuses: [],
        smrStatuses: [],
        warrantyServiceRequestStatuses: [],
        claimStatuses: [],
        serviceActions: [],
        warrantyStatuses: [],
      };

      records.forEach((record: any) => {
        const type = record.entity_type_name;
        const typeStr = (type || "").trim().toLowerCase().replace(/[\s\-_]/g, '');
        const isCalcType = isCalculationTypeEntityName(type) || typeStr === 'calculationtype';

        const normalizedRecord = {
          ...record,
          id: record.id || record.status_id || record.entity_id || record.value_id,
          name: record.value_name || record.status_name || record.name || record.earning_type_name || record.deduction_type_name || record.value_code || record.code || "Unknown",
          value_name: record.value_name || record.status_name || record.name || record.earning_type_name || record.deduction_type_name || record.value_code || record.code || "Unknown",
          code: isCalcType
            ? normalizeCalculationTypeCode(record)
            : (record.entity_value || record.value_code || record.status_id || record.code || record.id),
        };

        switch (typeStr) {
          case 'designation':
            groupedData.designations.push(normalizedRecord);
            break;
          case 'grade':
            groupedData.grades.push(normalizedRecord);
            break;
          case 'employmentstatus':
            groupedData.employmentStatuses.push(normalizedRecord);
            break;
          case 'documenttype':
            groupedData.documentTypes.push(normalizedRecord);
            break;
          case 'department':
            groupedData.departments.push(normalizedRecord);
            break;
          case 'shift':
            groupedData.shifts.push(normalizedRecord);
            break;
          case 'employmenttype':
            groupedData.employmentTypes.push(normalizedRecord);
            break;
          case 'location':
            groupedData.locations.push(normalizedRecord);
            break;
          case 'leavetype':
            groupedData.leaveTypes.push({
              ...normalizedRecord,
              leave_type_name: normalizedRecord.name,
            });
            break;
          case 'workercategory':
          case 'workcategory':
            groupedData.workCategories.push(normalizedRecord);
            break;
          case 'bintype':
            groupedData.binTypes.push({
              ...normalizedRecord,
              bin_type_name: normalizedRecord.name,
            });
            break;
          case 'currency':
            groupedData.currencies.push(normalizedRecord);
            break;
          case 'paymenttermtype':
            groupedData.paymentTermTypes.push(normalizedRecord);
            break;
          case 'paymenttaxtype':
            groupedData.paymentTaxTypes.push(normalizedRecord);
            break;
          case 'paymentdiscounttype':
            groupedData.paymentDiscountTypes.push(normalizedRecord);
            break;
          case 'itemtype':
            groupedData.itemTypes.push(normalizedRecord);
            break;
          case 'unitofmeasure':
          case 'uom':
            groupedData.uoms.push(normalizedRecord);
            break;
          case 'calculationtype':
            groupedData.calculationTypes.push(normalizedRecord);
            break;
          case 'maritalstatus':
            groupedData.maritalStatuses.push(normalizedRecord);
            break;
          case 'gender':
            groupedData.genders.push(normalizedRecord);
            break;
          case 'nationality':
            groupedData.nationalities.push(normalizedRecord);
            break;
          case 'bloodgroup':
            groupedData.bloodGroups.push(normalizedRecord);
            break;
          case 'quotationstatus':
            groupedData.quotationStatuses.push(normalizedRecord);
            break;
          case 'claim':
            groupedData.claimStatuses.push(normalizedRecord);
            break;
          case 'warrantyservicerequest':
            groupedData.warrantyServiceRequestStatuses.push(normalizedRecord);
            break;
          case 'selectaction':
            groupedData.serviceActions.push(normalizedRecord);
            break;
          case 'warrantystatus':
            groupedData.warrantyStatuses.push(normalizedRecord);
            break;
          case 'saleorderstatus':
          case 'salesorderstatus':
            groupedData.salesOrderStatuses.push(normalizedRecord);
            // Cross-map specific Sales Order statuses to Dispatch bucket as requested
            const sName = normalizedRecord.name.toLowerCase();
            if (sName.includes("dispatch pending") || sName === "dispatched") {
              groupedData.dispatchStatuses.push(normalizedRecord);
            }
            break;
          default:
            // Fallback for HR types using robust helpers if exact switch match fails
            if (isEarningTypeEntityName(type)) {
              groupedData.earningTypes.push(normalizedRecord);
            } else if (isDeductionTypeEntityName(type)) {
              groupedData.deductionTypes.push(normalizedRecord);
            } else if (isCalculationTypeEntityName(type)) {
              groupedData.calculationTypes.push(normalizedRecord);
            } else if (isWorkerPayrollStatusEntityName(type)) {
              groupedData.workerPayrollStatuses.push(normalizedRecord);
            } else if (isPOStatusEntityName(type)) {
              groupedData.poStatuses.push(normalizedRecord);
            } else if (isProductionPlanStatusEntityName(type, record.entity_type_code)) {
              groupedData.productionPlanStatuses.push(normalizedRecord);
            } else if (isMRStatusEntityName(type, record.entity_type_code)) {
              groupedData.mrStatuses.push(normalizedRecord);
            } else if (isBatchStatusEntityName(type, record.entity_type_code)) {
              groupedData.batchStatuses.push(normalizedRecord);
            } else if (isPaymentTermTypeEntityName(type, record.entity_type_code, record.entity_type_id)) {
              groupedData.paymentTermTypes.push(normalizedRecord);
            } else if (isPaymentTermEntityName(type)) {
              groupedData.paymentTerms.push(normalizedRecord);
            } else if (isPaymentTaxTypeEntityName(type, record.entity_type_code)) {
              groupedData.paymentTaxTypes.push(normalizedRecord);
            } else if (isPaymentDiscountTypeEntityName(type, record.entity_type_code)) {
              groupedData.paymentDiscountTypes.push(normalizedRecord);
            } else if (isCurrencyEntityName(type, record.entity_type_code)) {
              groupedData.currencies.push(normalizedRecord);
            } else if (isQuotationStatusEntityName(type, record.entity_type_code)) {
              groupedData.quotationStatuses.push(normalizedRecord);
            } else if (isSalesOrderStatusEntityName(type, record.entity_type_code)) {
              groupedData.salesOrderStatuses.push(normalizedRecord);
            } else if (isInvoicingStatusEntityName(type, record.entity_type_code, record.entity_type_id)) {
              groupedData.invoicingStatuses.push(normalizedRecord);
            } else if (isPendingPaymentStatusEntityName(type, record.entity_type_code, record.entity_type_id) || typeStr === 'peendingpaymentstatus') {
              groupedData.pendingPaymentStatuses.push(normalizedRecord);
            } else if (isFollowUpStatusEntityName(type) || typeStr === 'followstatusid' || typeStr === 'followstautsid') {
              groupedData.followUpStatuses.push(normalizedRecord);
            } else if (isPaymentModeEntityName(type, record.entity_type_code, record.entity_type_id) || typeStr === 'paymentmode' || typeStr === 'paymentmethod') {
              groupedData.paymentModes.push(normalizedRecord);
            } else if (isDispatchStatusEntityName(type, record.entity_type_code) || typeStr === 'dispatchstatus') {
              groupedData.dispatchStatuses.push(normalizedRecord);
            } else if (isSMRStatusEntityName(type, record.entity_type_code) || 
                       typeStr === 'smrstatus' || 
                       typeStr === 'servicematerialrequeststatus' || 
                       typeStr === 'materialrequisitionstatus' || 
                       typeStr === 'materialrequisition') {
              groupedData.smrStatuses.push(normalizedRecord);
            } else if (isClaimEntityName(type, record.entity_type_code, record.entity_type_id)) {
              groupedData.claimStatuses.push(normalizedRecord);
            } else if (isWarrantyServiceRequestStatusEntityName(type, record.entity_type_code, record.entity_type_id)) {
              groupedData.warrantyServiceRequestStatuses.push(normalizedRecord);
            } else if (isSelectActionEntityName(type, record.entity_type_code, record.entity_type_id)) {
              groupedData.serviceActions.push(normalizedRecord);
            } else if (isWarrantyStatusEntityName(type, record.entity_type_code, record.entity_type_id)) {
              groupedData.warrantyStatuses.push(normalizedRecord);
            }
            break;
        }
      });

      // Sort ALL master data arrays logically by sort_order (and ID as fallback)
      const sortLogically = (a: any, b: any) => {
        if (a.sort_order !== b.sort_order) {
          return (a.sort_order || 0) - (b.sort_order || 0);
        }
        return (a.id || 0) - (b.id || 0);
      };

      Object.keys(groupedData).forEach(key => {
        const value = (groupedData as any)[key];
        if (Array.isArray(value)) {
          value.sort(sortLogically);
        }
      });

      store.setCommonData(groupedData);
    } else {
      console.warn("Failed to load entity values:", entityRes.message);
    }

  } catch (error) {
    console.error("Critical error loading common master data:", error);
  } finally {
    store.setLoading(false);
  }
}
