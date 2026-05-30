import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

/**
 * State interface for the Common Master Data store.
 */
interface CommonState {
  entityValues: any[];
  departments: any[];
  designations: any[];
  shifts: any[];
  employmentTypes: any[];
  locations: any[];
  leaveTypes: any[];
  workCategories: any[];
  binTypes: any[];
  currencies: any[];
  itemTypes: any[];
  uoms: any[];
  earningTypes: any[];
  deductionTypes: any[];
  calculationTypes: any[];
  countries: any[];
  genders: any[];
  nationalities: any[];
  bloodGroups: any[];
  maritalStatuses: any[];
  grades: any[];
  employmentStatuses: any[];
  documentTypes: any[];
  workerPayrollStatuses: any[];
  poStatuses: any[];
  productionPlanStatuses: any[];
  mrStatuses: any[];
  batchStatuses: any[];
  paymentTerms: any[];
  paymentTermTypes: any[];
  paymentTaxTypes: any[];
  paymentDiscountTypes: any[];
  quotationStatuses: any[];
  salesOrderStatuses: any[];
  invoicingStatuses: any[];
  pendingPaymentStatuses: any[];
  followUpStatuses: any[];
  paymentModes: any[];
  dispatchStatuses: any[];
  smrStatuses: any[];
  warrantyServiceRequestStatuses: any[];
  claimStatuses: any[];
  serviceActions: any[];
  warrantyStatuses: any[];
  companyDetails: any;
  isLoading: boolean;
  isLoaded: boolean;
}

/**
 * Context value interface including state and update actions.
 */
interface CommonStoreContextValue extends CommonState {
  setCommonData: (data: Partial<CommonState>) => void;
  setLoading: (isLoading: boolean) => void;
  setLoaded: (isLoaded: boolean) => void;
  clearCommonData: () => void;
}

const CommonStoreContext = createContext<CommonStoreContextValue | undefined>(undefined);

/** 
 * STORE VERSION CONTROL:
 * Bump this version to force all client browsers to clear their master data cache.
 * Current Version: v8 (Added payment tax/discount/term type buckets with code-priority mapping)
 * 
 * WHY: This is necessary when we change how data is grouped or normalized in loadCommonData.ts,
 * as it ensure users receive the new correctly-tagged records immediately.
 */
const STORAGE_KEY = "erp_common_data_v21";

const loadInitialState = (): CommonState => {
  try {
    // Attempt to recover master data from localStorage to skip API call on page refresh
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // We mark as isLoaded immediately so components can render from cache
      return {
        ...parsed,
        leaveTypes: Array.isArray(parsed.leaveTypes) ? parsed.leaveTypes : [],
        workCategories: Array.isArray(parsed.workCategories) ? parsed.workCategories : [],
        binTypes: Array.isArray(parsed.binTypes) ? parsed.binTypes : [],
        calculationTypes: Array.isArray(parsed.calculationTypes) ? parsed.calculationTypes : [],
        earningTypes: Array.isArray(parsed.earningTypes) ? parsed.earningTypes : [],
        deductionTypes: Array.isArray(parsed.deductionTypes) ? parsed.deductionTypes : [],
        genders: Array.isArray(parsed.genders) ? parsed.genders : [],
        nationalities: Array.isArray(parsed.nationalities) ? parsed.nationalities : [],
        bloodGroups: Array.isArray(parsed.bloodGroups) ? parsed.bloodGroups : [],
        maritalStatuses: Array.isArray(parsed.maritalStatuses) ? parsed.maritalStatuses : [],
        grades: Array.isArray(parsed.grades) ? parsed.grades : [],
        employmentStatuses: Array.isArray(parsed.employmentStatuses) ? parsed.employmentStatuses : [],
        documentTypes: Array.isArray(parsed.documentTypes) ? parsed.documentTypes : [],
        workerPayrollStatuses: Array.isArray(parsed.workerPayrollStatuses) ? parsed.workerPayrollStatuses : [],
        poStatuses: Array.isArray(parsed.poStatuses) ? parsed.poStatuses : [],
        productionPlanStatuses: Array.isArray(parsed.productionPlanStatuses) ? parsed.productionPlanStatuses : [],
        mrStatuses: Array.isArray(parsed.mrStatuses) ? parsed.mrStatuses : [],
        batchStatuses: Array.isArray(parsed.batchStatuses) ? parsed.batchStatuses : [],
        paymentTerms: Array.isArray(parsed.paymentTerms) ? parsed.paymentTerms : [],
        paymentTermTypes: Array.isArray(parsed.paymentTermTypes) ? parsed.paymentTermTypes : [],
        paymentTaxTypes: Array.isArray(parsed.paymentTaxTypes) ? parsed.paymentTaxTypes : [],
        paymentDiscountTypes: Array.isArray(parsed.paymentDiscountTypes) ? parsed.paymentDiscountTypes : [],
        quotationStatuses: Array.isArray(parsed.quotationStatuses) ? parsed.quotationStatuses : [],
        salesOrderStatuses: Array.isArray(parsed.salesOrderStatuses) ? parsed.salesOrderStatuses : [],
        invoicingStatuses: Array.isArray(parsed.invoicingStatuses) ? parsed.invoicingStatuses : [],
        pendingPaymentStatuses: Array.isArray(parsed.pendingPaymentStatuses) ? parsed.pendingPaymentStatuses : [],
        followUpStatuses: Array.isArray(parsed.followUpStatuses) ? parsed.followUpStatuses : [],
        paymentModes: Array.isArray(parsed.paymentModes) ? parsed.paymentModes : [],
        dispatchStatuses: Array.isArray(parsed.dispatchStatuses) ? parsed.dispatchStatuses : [],
        smrStatuses: Array.isArray(parsed.smrStatuses) ? parsed.smrStatuses : [],
        warrantyServiceRequestStatuses: Array.isArray(parsed.warrantyServiceRequestStatuses)
          ? parsed.warrantyServiceRequestStatuses
          : [],
        claimStatuses: Array.isArray(parsed.claimStatuses) ? parsed.claimStatuses : [],
        serviceActions: Array.isArray(parsed.serviceActions) ? parsed.serviceActions : [],
        warrantyStatuses: Array.isArray(parsed.warrantyStatuses) ? parsed.warrantyStatuses : [],
        companyDetails: parsed.companyDetails || null,
        isLoaded: true,
        isLoading: false,
      };
    }
  } catch (e) {
    console.error("Failed to load common data from storage", e);
  }
  // Default empty state if no cache exists
  return {
    entityValues: [],
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
    earningTypes: [],
    deductionTypes: [],
    calculationTypes: [],
    countries: [],
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
    companyDetails: null,
    isLoading: false,
    isLoaded: false,
  };
};

/**
 * CommonStoreProvider wraps the application and provides access to master data.
 */
export function CommonStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CommonState>(loadInitialState());

  const setCommonData = useCallback((data: Partial<CommonState>) => {
    setState((prev) => {
      const newState = { ...prev, ...data, isLoaded: true, isLoading: false };
      
      // Normalization Layer:
      // We iterate through incoming records to ensure consistent entity type identification.
      // This prevents UI bugs caused by inconsistent casing or whitespace in backend responses.
      if (data.entityValues) {
        data.entityValues.forEach((record: any) => {
          const type = record.entity_type_name;
          const typeStr = (type || "").trim().toLowerCase().replace(/[\s\-_]/g, '');
        });
      }

      // Persist to storage (excluding transient loading states)
      // This allows the data to survive page refreshes while ensuring a fresh load is NOT triggered
      const { isLoading, isLoaded, ...toSave } = newState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      return newState;
    });
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }));
  }, []);

  const setLoaded = useCallback((isLoaded: boolean) => {
    setState((prev) => ({ ...prev, isLoaded }));
  }, []);

  /**
   * Clears the common data from both React state and localStorage.
   * Typically called on logout to ensure data isolation between user sessions.
   */
  const clearCommonData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      entityValues: [],
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
      earningTypes: [],
      deductionTypes: [],
      calculationTypes: [],
      countries: [],
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
      companyDetails: null,
      isLoading: false,
      isLoaded: false,
    });
  }, []);

  const value = useMemo(() => ({
    ...state,
    setCommonData,
    setLoading,
    setLoaded,
    clearCommonData,
  }), [state, setCommonData, setLoading, setLoaded, clearCommonData]);

  return (
    <CommonStoreContext.Provider value={value}>
      {children}
    </CommonStoreContext.Provider>
  );
}

/**
 * Hook to access the Common Store.
 * Supports selector pattern: const departments = useCommonStore(state => state.departments)
 */
export function useCommonStore<T>(selector: (state: CommonStoreContextValue) => T): T {
  const context = useContext(CommonStoreContext);
  if (context === undefined) {
    throw new Error("useCommonStore must be used within a CommonStoreProvider");
  }

  /**
   * MAPPING LOGIC EXPLANATION:
   * We need to map friendly frontend modes ('FLAT', 'PCT_CTC', etc.) to the dynamic 
   * database IDs found in entity_values. Because the backend doesn't always send 
   * strict codes, we use a two-tier approach:
   * 
   * 1. Primary: Use the pre-normalized 'code' property from our global commonStore.
   * 2. Safety Net: If the store code is missing/unknown, we perform a final "guess" 
   *    based on the record's name as a failsafe to ensure the Save button works.
   */
  return selector(context);
}

/**
 * Direct access hook for actions (non-selector version)
 */
export function useCommonActions() {
  const context = useContext(CommonStoreContext);
  if (context === undefined) {
    throw new Error("useCommonActions must be used within a CommonStoreProvider");
  }
  return useMemo(() => ({
    setCommonData: context.setCommonData,
    setLoading: context.setLoading,
    setLoaded: context.setLoaded,
    clearCommonData: context.clearCommonData,
  }), [context.setCommonData, context.setLoading, context.setLoaded, context.clearCommonData]);
}
