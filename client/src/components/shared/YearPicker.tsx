import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

interface YearPickerProps {
    selectedYear: number | undefined;
    onYearSelect: (year: number | undefined) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    showClear?: boolean;
    availableYears?: number[];
}

export function YearPicker({
    selectedYear,
    onYearSelect,
    placeholder = "Select Year",
    className,
    disabled = false,
    showClear,
    availableYears
}: YearPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [navYear, setNavYear] = useState(selectedYear || new Date().getFullYear());

    const startYear = Math.floor(navYear / 12) * 12;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);

    const handleYearClick = (year: number) => {
        onYearSelect(year);
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div className="relative group w-full">
                    <Button
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                            "w-full justify-start text-left font-normal flex h-10 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:bg-white bg-background pr-8",
                            !selectedYear && "text-muted-foreground",
                            className
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                            {selectedYear ? selectedYear : placeholder}
                        </span>
                    </Button>
                    {(showClear !== undefined ? showClear : !!selectedYear) && !disabled && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onYearSelect(undefined);
                                setIsOpen(false);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 shadow-lg border rounded-lg z-[9999] bg-background" align="start" side="bottom" sideOffset={4}>
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setNavYear(navYear - 12)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{startYear} - {startYear + 11}</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setNavYear(navYear + 12)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {years.map((year) => {
                        const isAvailable = availableYears ? availableYears.includes(year) : true;
                        return (
                            <Button
                                key={year}
                                variant="ghost"
                                disabled={!isAvailable}
                                className={cn(
                                    "h-10 text-sm font-normal",
                                    year === selectedYear && "bg-primary text-primary-foreground font-semibold",
                                    !isAvailable && "opacity-30 cursor-not-allowed"
                                )}
                                onClick={() => isAvailable && handleYearClick(year)}
                            >
                                {year}
                            </Button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
