const AUTH_USER_KEY = "auth_user";

/**
 * List fetch guard: use `useCallback` deps on filter primitives only.
 * For permissions, use a boolean (`canView(module)`) in the callback body — never
 * `canView` / `isMenuVisible` from `useHasPermission` in the dependency array.
 */
export type AssignedDropdownScope = "workcenter" | "warehouse" | "operation" | "location";

const ASSIGNED_ID_KEYS: Record<AssignedDropdownScope, string[]> = {
  workcenter: [
    "assignedWorkcenterIds",
    "assigned_workcenter_ids",
    "assigned_work_center_ids",
    "assignedWorkCenters",
    "assigned_work_centers",
  ],
  warehouse: [
    "assignedWarehouseIds",
    "assigned_warehouse_ids",
    "assignedWarehouses",
    "assigned_warehouses",
  ],
  operation: [
    "assignedOperationIds",
    "assigned_operation_ids",
    "assignedOperations",
    "assigned_operations",
  ],
  location: [
    "assignedLocationIds",
    "assigned_location_ids",
    "assignedLocations",
    "assigned_locations",
  ],
};

const toIdStrings = (raw: unknown): string[] => {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (entry == null) return "";
      if (typeof entry === "object") {
        const obj = entry as {
          id?: string | number;
          value?: string | number;
          operation_id?: string | number;
          work_center_id?: string | number;
          warehouse_id?: string | number;
          location_id?: string | number;
        };
        if (obj.operation_id != null) return String(obj.operation_id);
        if (obj.work_center_id != null) return String(obj.work_center_id);
        if (obj.warehouse_id != null) return String(obj.warehouse_id);
        if (obj.location_id != null) return String(obj.location_id);
        if (obj.id != null) return String(obj.id);
        if (obj.value != null) return String(obj.value);
        return "";
      }
      return String(entry);
    })
    .filter((id) => id.length > 0);
};

const LEGACY_ASSIGNMENT_ARRAY_KEYS: Record<AssignedDropdownScope, string[]> = {
  workcenter: ["workcenter", "work_centers"],
  warehouse: ["warehouse", "warehouses"],
  operation: ["operation", "operations"],
  location: ["location", "locations"],
};

const readLegacyAssignmentIds = (
  user: Record<string, unknown>,
  scope: AssignedDropdownScope
): string[] => {
  for (const key of LEGACY_ASSIGNMENT_ARRAY_KEYS[scope]) {
    const ids = toIdStrings(user[key]);
    if (ids.length > 0) return ids;
  }
  const single = user[LEGACY_ASSIGNMENT_ARRAY_KEYS[scope][0]];
  if (single && typeof single === "object" && !Array.isArray(single)) {
    const ids = toIdStrings([single]);
    if (ids.length > 0) return ids;
  }
  return [];
};

const readAuthUser = (): Record<string, unknown> | null => {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** Read assigned IDs for a scope from auth_user in localStorage. */
export const getAssignedIds = (scope: AssignedDropdownScope): string[] => {
  const user = readAuthUser();
  if (!user) return [];

  for (const key of ASSIGNED_ID_KEYS[scope]) {
    const ids = toIdStrings(user[key]);
    if (ids.length > 0) return ids;
  }

  return readLegacyAssignmentIds(user, scope);
};

/**
 * Reorder items so assigned IDs appear first (in assigned order), then all others unchanged.
 * Does not remove or hide any items.
 */
export const prioritizeByAssigned = <T>(
  items: T[],
  assignedIds: string[],
  getItemId: (item: T) => string | number
): T[] => {
  if (!assignedIds.length || !items.length) return items;

  const order = new Map<string, number>();
  assignedIds.forEach((id, index) => {
    const key = String(id);
    if (!order.has(key)) order.set(key, index);
  });

  const assigned: T[] = [];
  const rest: T[] = [];

  for (const item of items) {
    const id = String(getItemId(item));
    if (order.has(id)) assigned.push(item);
    else rest.push(item);
  }

  assigned.sort(
    (a, b) =>
      (order.get(String(getItemId(a))) ?? 0) - (order.get(String(getItemId(b))) ?? 0)
  );

  return [...assigned, ...rest];
};

/** First assigned ID that exists in the available option IDs (assigned order preserved). */
export const getFirstAssignedMatch = (
  assignedIds: string[],
  availableIds: Array<string | number>
): string | undefined => {
  if (!assignedIds.length || !availableIds.length) return undefined;

  const available = new Set(availableIds.map((id) => String(id)));
  for (const id of assignedIds) {
    const key = String(id);
    if (available.has(key)) return key;
  }

  return undefined;
};

/** Convenience: first assigned value to use as default selection. */
export const getFirstAssignedValue = (
  scope: AssignedDropdownScope,
  availableIds: Array<string | number>
): string | undefined => {
  return getFirstAssignedMatch(getAssignedIds(scope), availableIds);
};
