import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  value: string;
}

export interface SearchableSelectProps {
  label?: string;
  value?: string;
  options: (string | SelectOption)[];
  onChange: (val: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
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
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  // Normalize options to always be SelectOption[]
  const normalizedOptions: SelectOption[] = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  const trigger = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn("w-full justify-between h-10 font-normal border-input", className)}
      disabled={disabled}
    >
      <span className={cn(!value && "text-muted-foreground", "truncate mr-2")}>
        {selectedOption ? selectedOption.label : (placeholder || (label ? `Select ${label}` : "Select option"))}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  return (
    <div className="space-y-2 w-full">
      {label && (
        <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {trigger}
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command className="border-none shadow-none">
            <CommandInputBorderless placeholder={placeholder || `Search ${label?.toLowerCase() || 'options'}...`} className="h-9" />
            <CommandList className="max-h-[132px] overflow-y-auto border-t">
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {normalizedOptions.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.label} // Allow searching by label
                    onSelect={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
