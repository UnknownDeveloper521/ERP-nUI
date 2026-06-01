import { mockCustomers } from "@/lib/masterMockData";
import { GSV7_ITEMS, getGsv7ItemIdByCode } from "@/lib/gsv7OperationsMockData";
import type { InvoiceData } from "@/lib/mockInvoices";
import type { QuotationData, QuotationStatus } from "@/lib/mockQuotations";
import type { SOData } from "@/lib/mockSalesOrders";

export const MOCK_FG_ITEM_ID = getGsv7ItemIdByCode(GSV7_ITEMS.FG_GSV7.code);
export const MOCK_SKU_12V_ID = 910001;
export const MOCK_SKU_EXP_ID = 910002;
export const MOCK_CURRENCY_UGX_ID = 301;

const QUOTATION_STATUS_ID: Record<QuotationStatus, number> = {
  "Draft Quote": 1,
  "Submitted Quote": 2,
  "Expired Quotations": 3,
  "Converted to SO": 4,
};

const CUSTOMER_ID_BY_STRING_ID: Record<string, number> = {
  "cust-1": 1,
  "cust-2": 2,
  "cust-3": 3,
  "cust-4": 4,
  "cust-5": 5,
};

export function customerIdFromName(customerName: string): number {
  const match = mockCustomers.find((c) => c.name === customerName);
  if (!match) return 1;
  return CUSTOMER_ID_BY_STRING_ID[match.id] ?? 1;
}

export function customerRecordById(customerId: number) {
  const customer = mockCustomers[customerId - 1];
  if (!customer) return null;
  return {
    customer_id: customerId,
    customer_name: customer.name,
    contact_person_name: customer.contactPerson,
    mobile_no: customer.mobileNo,
    billing_address: customer.billingAddress,
    shipping_address: customer.shippingAddress,
    email: "",
    customer: { customer_id: customerId, customer_name: customer.name },
  };
}

export function buildCustomerWithDetailsRecords() {
  return mockCustomers.map((customer, index) => {
    const customer_id = index + 1;
    return {
      customer_id,
      customer_name: customer.name,
      contact_person_name: customer.contactPerson,
      mobile_no: customer.mobileNo,
      billing_address: customer.billingAddress,
      shipping_address: customer.shippingAddress,
      email: "",
      customer: { customer_id, customer_name: customer.name },
    };
  });
}

export function resolveItemId(itemCode: string | number | undefined): number {
  const numeric = Number(itemCode);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const code = String(itemCode ?? "").trim().toUpperCase();
  if (!code || code.includes("GSV7") || code.startsWith("FG")) {
    return MOCK_FG_ITEM_ID;
  }
  return MOCK_FG_ITEM_ID;
}

export function resolveSkuId(skuCode?: string): number | undefined {
  if (skuCode === "SKU-GSV7-12V") return MOCK_SKU_12V_ID;
  if (skuCode === "SKU-GSV7-EXP") return MOCK_SKU_EXP_ID;
  return undefined;
}

function mapPaymentTermsForApi(
  terms: Array<{
    id: number;
    value?: number;
    percentage?: number;
    terms?: string;
    termType?: string;
    days?: number | string;
    date?: string;
    note?: string;
  }>,
) {
  return terms.map((term) => {
    const termName = String(term.terms ?? term.termType ?? "Advance");
    return {
      id: term.id,
      percentage: Number(term.value ?? term.percentage ?? 0),
      term_type_name: termName === "Days" ? "Days" : termName,
      term_type_code: termName.toUpperCase().replace(/\s+/g, "_"),
      days: term.days != null ? Number(term.days) : undefined,
      date: term.date ?? "",
      note: term.note ?? "",
    };
  });
}

function mapLineItemsForApi(
  items: Array<{
    id: number;
    itemCode?: string;
    item?: string;
    itemName?: string;
    qty?: number | string;
    orderedQty?: number;
    rate?: number | string;
    amount?: number;
    price?: number;
    skuCode?: string;
    skuName?: string;
    skuId?: number | string;
    uom?: string;
  }>,
) {
  return items.map((item) => {
    const qty = Number(item.qty ?? item.orderedQty ?? 0);
    const unitPrice = Number(item.rate ?? 0);
    const lineTotal = Number(item.amount ?? item.price ?? qty * unitPrice);
    const item_id = resolveItemId(item.itemCode);
    const sku_id =
      item.skuId != null && item.skuId !== ""
        ? Number(item.skuId)
        : resolveSkuId(item.skuCode);

    return {
      id: item.id,
      item_id,
      item_code: GSV7_ITEMS.FG_GSV7.code,
      item_name: String(item.item ?? item.itemName ?? GSV7_ITEMS.FG_GSV7.name),
      quantity: qty,
      unit_price: unitPrice,
      price_per_item: lineTotal,
      sku_id: Number.isFinite(sku_id) ? sku_id : undefined,
      sku_code: item.skuCode ?? "",
      sku_name: item.skuName ?? "",
      uom_name: item.uom ?? "NOS",
    };
  });
}

export function mapQuotationToApiDetail(q: QuotationData) {
  const customer_id = customerIdFromName(q.customerName);
  const discountIsPercent = q.discountType !== "Amount";

  return {
    id: q.id,
    quotation_id: q.id,
    quotation_code: q.quotationNo,
    quotation_date: q.quotationDate,
    customer_id,
    customer_name: q.customerName,
    customer_details: {
      name: q.customerName,
      customer_name: q.customerName,
      contact_person_name: q.contactPersonName,
      contact_number: q.contactNumber,
      billing_address: q.billingAddress,
      shipping_address: q.shippingAddress,
    },
    contact_person_name: q.contactPersonName,
    contact_number: q.contactNumber,
    billing_address: q.billingAddress,
    shipping_address: q.shippingAddress,
    currency_id: MOCK_CURRENCY_UGX_ID,
    currency_name: q.currency,
    expected_delivery_date: q.deliveryTime,
    quotation_validity: q.quotationValidity,
    remarks: q.remarks,
    status_id: q.statusId ?? QUOTATION_STATUS_ID[q.status] ?? 1,
    status_name: q.status,
    status_code: (q.statusId ?? QUOTATION_STATUS_ID[q.status] ?? 1).toString(),
    discount_type_name: q.discountType ?? "%",
    discount_percent: discountIsPercent ? Number(q.discountValue ?? 0) : 0,
    discount_amount: Number(q.discountAmount ?? (discountIsPercent ? 0 : q.discountValue ?? 0)),
    tax_type_name: q.taxType ?? "%",
    tax_rate: q.taxType !== "Amount" ? Number(q.taxValue ?? q.taxPercentage ?? 0) : 0,
    tax_amount: Number(q.taxAmount ?? 0),
    subtotal: Number(q.subtotal ?? 0),
    total_amount: Number(q.total ?? 0),
    payment_terms: mapPaymentTermsForApi(q.paymentTerms),
    items: mapLineItemsForApi(q.items),
  };
}

export function mapSalesOrderToApiDetail(so: SOData) {
  const customer_id = customerIdFromName(so.customerName);
  const discountIsPercent = so.discountType !== "Amount";
  const taxIsPercent = so.taxType !== "Amount";

  return {
    id: so.id,
    sales_order_code: so.soNumber,
    order_date: so.soDate,
    quotation_code: so.quotationRef ?? "",
    quotation_id: undefined,
    customer_id,
    customer_name: so.customerName,
    customer_details: {
      name: so.customerName,
      customer_name: so.customerName,
      contact_person_name: so.contactPerson,
      contact_number: so.mobileNo ?? "",
      billing_address: so.billingAddress,
      shipping_address: so.shippingAddress,
    },
    contact_person_name: so.contactPerson,
    mobile_no: so.mobileNo,
    billing_address: so.billingAddress,
    shipping_address: so.shippingAddress,
    currency_id: MOCK_CURRENCY_UGX_ID,
    currency_name: so.currency,
    currency_code: so.currency,
    expected_delivery_date: so.deliveryDate,
    delivery_date: so.deliveryDate,
    remarks: so.remarks,
    status_name: so.status,
    discount_type_name: so.discountType ?? "%",
    discount_percent: discountIsPercent ? Number(so.discountValue ?? 0) : 0,
    discount_amount: discountIsPercent ? 0 : Number(so.discountValue ?? 0),
    discount: {
      type_name: so.discountType ?? "%",
      discount_rate: discountIsPercent ? Number(so.discountValue ?? 0) : 0,
      discount_percent: discountIsPercent ? Number(so.discountValue ?? 0) : 0,
      amount: discountIsPercent ? 0 : Number(so.discountValue ?? 0),
    },
    tax_type_name: so.taxType ?? "%",
    tax_rate: taxIsPercent ? Number(so.taxValue ?? so.taxPercentage ?? 0) : 0,
    tax_amount: 0,
    tax: {
      type_name: so.taxType ?? "%",
      tax_rate: taxIsPercent ? Number(so.taxValue ?? so.taxPercentage ?? 0) : 0,
    },
    payment_terms: mapPaymentTermsForApi(
      so.terms.map((t) => ({
        id: t.id,
        value: t.value,
        percentage: t.percentage,
        terms: t.termType,
        days: t.days,
        date: t.date,
        note: t.note,
      })),
    ),
    items: mapLineItemsForApi(
      so.items.map((item) => ({
        id: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        orderedQty: item.orderedQty,
        rate: item.rate,
        price: item.price,
        skuCode: item.skuCode,
        skuName: item.skuName,
        skuId: item.skuId,
        uom: item.uom,
      })),
    ),
    order_items: undefined,
  };
}

export function mapInvoiceToApiDetail(inv: InvoiceData) {
  return {
    invoice_id: inv.id,
    invoice_code: inv.invoiceNumber,
    invoice_date: inv.invoiceDate,
    due_date: inv.dueDate,
    so_code: inv.soNumber,
    order_date: inv.soDate,
    delivery_date: inv.deliveryDate,
    customer_name: inv.customerName,
    contact_person: inv.contactPerson,
    mobile_no: inv.mobileNo,
    billing_address: inv.billingAddress,
    shipping_address: inv.shippingAddress,
    currency_name: inv.currency || "UGX",
    status_name: inv.status,
    company_name: "GSV7 Manufacturing Ltd",
    company_address: "Jinja Industrial Park, Uganda",
    items: inv.items.map((item, idx) => ({
      item_id: resolveItemId(item.itemCode),
      item_code: item.itemCode || GSV7_ITEMS.FG_GSV7.code,
      item_name: item.itemName,
      sku_id: resolveSkuId(item.skuCode),
      sku_code: item.skuCode ?? "",
      sku_name: item.skuName ?? "",
      uom_name: item.uom ?? "NOS",
      ordered_qty: Number(item.orderedQty ?? 0),
      quantity: Number(item.orderedQty ?? 0),
      unit_price: Number(item.rate ?? 0),
      price_per_item: Number(item.price ?? 0),
      id: item.id ?? idx + 1,
    })),
    terms: inv.terms.map((term) => ({
      term_id: term.id,
      term_type_name: term.termType,
      percentage: term.percentage ?? term.value ?? 0,
      days: term.days,
    })),
    summary: {
      subtotal: inv.subtotal,
      discount_percent: inv.discountType === "%" ? inv.discountValue ?? 0 : 0,
      discount_amount: inv.discountAmount ?? 0,
      tax_percent: inv.taxPercentage ?? inv.taxValue ?? 0,
      tax_amount: inv.tax,
      grand_total: inv.grandTotal,
    },
  };
}
