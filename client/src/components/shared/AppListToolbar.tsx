import React from "react";
import { Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "./SearchableSelect";
import { DatePicker } from "./DatePicker";
import { YearPicker } from "./YearPicker";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface FilterOption {
  label: string;
  value: string | number;
}

export type FilterField = 
  | { type: 'select'; label: string; value: string | number; options: (string | number | { label: string; value: string | number })[]; onChange: (val: any) => void; placeholder?: string; required?: boolean; searchable?: boolean }
  | { type: 'date'; label: string; value: string | Date | undefined; onChange: (val: Date | undefined) => void; placeholder?: string; required?: boolean; showClear?: boolean; minDate?: Date; maxDate?: Date }
  | { type: 'year'; label: string; value: number | undefined; onChange: (val: number | undefined) => void; placeholder?: string; required?: boolean; showClear?: boolean; availableYears?: number[] }
  | { type: 'text'; label: string; value: string; onChange: (val: string) => void; placeholder?: string; required?: boolean };

export interface ToolbarAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  disabled?: boolean;
}

export interface AppListToolbarProps {
  search?: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  };
  filters?: FilterField[];
  actions?: ToolbarAction[];
  className?: string;
}

/**
 * Standardized Toolbar for Listing Pages
 * 
 * Supports:
 * - One search field (left)
 * - Up to 4 filter fields (middle)
 * - Multiple action buttons (right)
 */
export function AppListToolbar({
  search,
  filters = [],
  actions = [],
  className,
}: AppListToolbarProps) {
  // Enforce required rendering order:
  // 1. Normal filters (Department, Location, etc.)
  // 2. Date filters (Date, From Date, To Date, etc.)
  // 3. Status filter
  
  const normalFilters = filters.filter(f => 
    f.type !== 'date' && 
    f.type !== 'year' && 
    !f.label.toLowerCase().includes('date') && 
    !f.label.toLowerCase().includes('status')
  );
  
  const dateFilters = filters.filter(f => 
    f.type === 'date' || 
    f.type === 'year' || 
    f.label.toLowerCase().includes('date') || 
    f.label.toLowerCase().includes('year') || 
    f.label.toLowerCase().includes('month')
  );
  
  const statusFilters = filters.filter(f => 
    f.type !== 'date' && 
    f.label.toLowerCase().includes('status')
  );

  const sortedFilters = [...normalFilters, ...dateFilters, ...statusFilters];

  return (
    <div className={cn(
      "flex flex-wrap items-end gap-4 p-4 mb-4 bg-card rounded-lg border shadow-sm",
      className
    )}>
      {/* Search Field */}
      {search && (
        <div className="flex-1 min-w-[200px] max-w-[300px] space-y-1.5">
          <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder || "Search employees..."}
              className="pl-9 h-10 border-input bg-background toolbar-search-input"
            />
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="flex flex-wrap items-end gap-3 flex-grow">
        {sortedFilters.map((filter, index) => {
          const processedOptions = filter.type === 'select' ? filter.options.filter(opt => opt != null).map((opt) => {
            let label = typeof opt === 'string' || typeof opt === 'number' ? String(opt) : (opt.label || '');
            const value = typeof opt === 'string' || typeof opt === 'number' ? String(opt) : (opt.value || '');
            
            // If it's the generic "all" string, make it descriptive
            const optValue = typeof opt === 'object' ? String(opt.value || '') : String(opt || '');
            const optLabel = typeof opt === 'object' ? String(opt.label || '') : String(opt || '');

            if (optValue.toLowerCase() === 'all' && (optLabel.toLowerCase() === 'all' || optLabel.toLowerCase().startsWith('all '))) {
              label = `All ${filter.label}`;
            }
            
            return { label, value };
          }) : [];

          return (
            <div key={`${filter.label}-${index}`} className="min-w-[180px] space-y-1.5 flex-1 max-w-[250px]">
              {filter.type === 'select' ? (
                filter.searchable ? (
                  <SearchableSelect
                    label={filter.label}
                    value={filter.value}
                    options={processedOptions}
                    onChange={filter.onChange}
                    placeholder={filter.placeholder}
                    required={filter.required}
                  />
                ) : (
                  <>
                    <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {filter.label} {filter.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Select value={filter.value !== undefined && filter.value !== null ? String(filter.value) : undefined} onValueChange={filter.onChange}>
                      <SelectTrigger className="h-10 border-input bg-background">
                        <SelectValue placeholder={filter.placeholder || `Select ${filter.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {processedOptions.map((opt) => (
                          <SelectItem key={String(opt.value)} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )
              ) : filter.type === 'date' ? (
              <>
                <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  {filter.label} {filter.required && <span className="text-red-500">*</span>}
                </Label>
                <DatePicker
                  date={typeof filter.value === 'string' ? (filter.value ? new Date(filter.value) : undefined) : filter.value}
                  setDate={filter.onChange}
                  placeholder={filter.placeholder}
                  showClear={filter.showClear}
                  minDate={filter.minDate}
                  maxDate={filter.maxDate}
                />
              </>
            ) : filter.type === 'year' ? (
              <>
                <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  {filter.label} {filter.required && <span className="text-red-500">*</span>}
                </Label>
                <YearPicker
                  selectedYear={filter.value}
                  onYearSelect={filter.onChange}
                  placeholder={filter.placeholder}
                  showClear={filter.showClear}
                  availableYears={filter.availableYears}
                />
              </>
            ) : (
              <>
                <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  {filter.label} {filter.required && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  value={filter.value}
                  onChange={(e) => filter.onChange(e.target.value)}
                  placeholder={filter.placeholder}
                  className="h-10 border-input bg-background"
                />
              </>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions Section */}
      <div className="flex gap-2 ml-auto shrink-0">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || "default"}
            onClick={action.onClick}
            disabled={action.disabled}
            className="h-10 px-4 flex items-center gap-2 whitespace-nowrap"
          >
            {action.icon}
            <span>{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
