import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, truncateMiddle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInputBorderless,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  /** Optional stacked selected display: name on line 1, code on line 2 */
  primaryText?: string;
  secondaryText?: string;
}

export interface SearchableSelectProps {
  label?: string;
  value?: string | number;
  options: (string | number | SelectOption)[];
  onChange: (val: any) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  error?: string;
  /** How to truncate long selected labels. Default: middle ellipsis */
  selectedTruncate?: "middle" | "end";
  /** When primaryText/secondaryText are set, controls selected trigger layout. Default: stacked */
  selectedLayout?: "stacked" | "inline";
  /** Optional boundary to keep the dropdown panel inside a modal/container */
  popoverCollisionBoundary?: Element | null;
  popoverCollisionPadding?: number | Partial<{ top: number; bottom: number; left: number; right: number }>;
  /** Override dropdown list max-height (e.g. taller lists in modals) */
  listClassName?: string;
  /** Show native title tooltip on selected value (e.g. long production plan codes) */
  showSelectedTitle?: boolean;
  /** Stacked selected: allow up to 2 lines for primary text (e.g. long operation names) */
  selectedPrimaryLineClamp?: 1 | 2;
  /** Stacked selected: compact two-line trigger (name + code), subtle padding between lines */
  compactStackedSelected?: boolean;
  /** Slightly lighter/smaller selected text for long values (e.g. production plan codes) */
  lightSelectedText?: boolean;
}

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  className,
  error,
  selectedTruncate = "middle",
  selectedLayout = "stacked",
  popoverCollisionBoundary,
  popoverCollisionPadding,
  listClassName,
  showSelectedTitle = false,
  selectedPrimaryLineClamp = 1,
  compactStackedSelected = false,
  lightSelectedText = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === "string" || typeof opt === "number"
      ? { label: String(opt), value: opt }
      : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const useStackedSelected =
    selectedLayout === "stacked" &&
    Boolean(selectedOption?.primaryText && selectedOption?.secondaryText);

  const hasStackedOptions = normalizedOptions.some(
    (opt) => Boolean(opt.primaryText && opt.secondaryText)
  );

  // Single-line items: ~4 rows visible before scroll. Stacked (name + code): keep existing height.
  const defaultListMaxHeight = hasStackedOptions ? "max-h-[145px]" : "max-h-40";
  const modalListMaxHeight = hasStackedOptions
    ? "max-h-[min(240px,calc(var(--radix-popover-content-available-height)-2.5rem))]"
    : "max-h-[min(10rem,calc(var(--radix-popover-content-available-height)-2.5rem))]";

  const selectedLabel = selectedOption
    ? selectedTruncate === "end"
      ? selectedOption.label
      : truncateMiddle(selectedOption.label, 15, 10)
    : placeholder || (label ? `Select ${label}` : "Select option");

  const selectedTitle = showSelectedTitle
    ? useStackedSelected
      ? `${selectedOption!.primaryText}\n${selectedOption!.secondaryText}`
      : selectedOption?.label
    : undefined;

  const trigger = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "h-10 w-full items-center justify-between! gap-2 px-3 py-0 text-left font-normal border-input",
        useStackedSelected &&
          !compactStackedSelected &&
          selectedPrimaryLineClamp === 2 &&
          "h-auto min-h-10 items-start! py-2",
        className,
        compactStackedSelected && "h-auto! min-h-10 items-center! py-1"
      )}
      disabled={disabled}
    >
      {useStackedSelected ? (
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 overflow-hidden text-left leading-none"
          )}
          title={selectedTitle}
        >
          <span
            className={cn(
              "w-full text-left font-medium",
              compactStackedSelected
                ? "truncate text-xs font-normal leading-snug text-foreground/90"
                : selectedPrimaryLineClamp === 2
                  ? "line-clamp-2 wrap-break-word text-sm leading-snug whitespace-normal max-sm:line-clamp-1"
                  : "truncate text-sm leading-tight"
            )}
          >
            {selectedOption!.primaryText}
          </span>
          <span
            className={cn(
              "w-full truncate text-left font-mono text-[10px] font-normal",
              compactStackedSelected
                ? "leading-snug text-muted-foreground/60"
                : "leading-tight text-muted-foreground"
            )}
          >
            {selectedOption!.secondaryText}
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "min-w-0 flex-1 overflow-hidden text-left whitespace-nowrap",
            lightSelectedText ? "text-xs font-normal text-foreground/90" : "text-sm",
            selectedTruncate === "end"
              ? "max-sm:truncate max-sm:text-ellipsis sm:text-clip"
              : "truncate",
            !value && "text-muted-foreground"
          )}
          title={selectedTitle}
        >
          {selectedLabel}
        </span>
      )}
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  return (
    <div className="w-full space-y-2">
      {label && (
        <Label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          className={cn(
            "max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) overflow-hidden p-0",
            popoverCollisionBoundary && "flex max-h-(--radix-popover-content-available-height) flex-col"
          )}
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions
          sticky="partial"
          collisionBoundary={popoverCollisionBoundary ?? undefined}
          collisionPadding={popoverCollisionPadding}
          onWheel={(e) => e.stopPropagation()}
        >
          <Command
            className="border-none shadow-none"
            shouldFilter={true}
            filter={(value, search) => {
              const searchLower = search.toLowerCase();
              const searchable = value.split("|").slice(0, 3).join(" ").toLowerCase();
              return searchable.includes(searchLower) ? 1 : 0;
            }}
          >
            <CommandInputBorderless
              placeholder={placeholder || `Search ${label?.toLowerCase() || "options"}...`}
              className="h-9"
            />
            <CommandList
              className={cn(
                "min-h-0 overflow-y-auto border-t custom-scrollbar",
                listClassName ?? (popoverCollisionBoundary ? modalListMaxHeight : defaultListMaxHeight),
                popoverCollisionBoundary && "flex-1"
              )}
              onWheel={(e) => e.stopPropagation()}
            >
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {normalizedOptions.map((item) => (
                  <CommandItem
                    key={`${item.value}|${item.label}`}
                    value={`${item.label}|${item.primaryText ?? ""}|${item.secondaryText ?? ""}|${item.value}`}
                    onSelect={() => {
                      if (!item.disabled) {
                        onChange(item.value);
                        setOpen(false);
                      }
                    }}
                    disabled={item.disabled}
                    className={cn(
                      "cursor-pointer",
                      item.primaryText && item.secondaryText && "items-start gap-2.5 py-3",
                      item.disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        item.primaryText && item.secondaryText ? "mt-0.5" : "",
                        value === item.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {item.primaryText && item.secondaryText ? (
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-2">
                        <span className="text-sm font-medium leading-snug wrap-break-word whitespace-normal">
                          {item.primaryText}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground break-all">
                          {item.secondaryText}
                        </span>
                      </div>
                    ) : (
                      item.label
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
