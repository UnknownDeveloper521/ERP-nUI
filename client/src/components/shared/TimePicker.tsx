import React, { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

interface TimePickerProps {
    value?: string; // "HH:mm" format
    onChange?: (value: string) => void;
    className?: string;
    disabled?: boolean;
}

import { Input } from "@/components/ui/input";

export function TimePicker({ value = "", onChange, className, disabled }: TimePickerProps) {
    const [open, setOpen] = useState(false);
    
    // Internal state for hours/minutes
    const initialHours = value?.includes(":") ? value.split(":")[0] : "";
    const initialMinutes = value?.includes(":") ? value.split(":")[1] : "";
    
    const [selectedHour, setSelectedHour] = useState(initialHours);
    const [selectedMinute, setSelectedMinute] = useState(initialMinutes);

    // Rescale values when props change
    useEffect(() => {
        const h = value?.includes(":") ? value.split(":")[0] : "";
        const m = value?.includes(":") ? value.split(":")[1] : "";
        setSelectedHour(h);
        setSelectedMinute(m);
    }, [value]);

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

    const handleSelect = (h: string, m: string) => {
        if (h && m) {
            onChange?.(`${h}:${m}`);
            setOpen(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9]/g, "");
        if (val.length > 4) val = val.substring(0, 4);
        
        // Auto-format as HH:mm
        let formatted = val;
        if (val.length >= 3) {
            formatted = val.substring(0, 2) + ":" + val.substring(2);
        } else if (val.length > 0 && e.target.value.includes(":") && val.length <= 2) {
            // Keep the colon if user manually typed it or is deleting around it
            formatted = val + ":";
        }
        
        onChange?.(formatted);
    };

    const handleBlur = () => {
        if (!value) return;
        const parts = value.split(":");
        let h = parts[0] || "00";
        let m = parts[1] || "00";

        // Basic boundary validation
        if (parseInt(h) > 23) h = "23";
        if (parseInt(m) > 59) m = "59";
        
        // Padding
        h = h.padStart(2, "0");
        m = m.padStart(2, "0");
        
        onChange?.(`${h}:${m}`);
    };

    return (
        <div className={cn("relative flex items-center w-full", className)}>
            <Input
                value={value}
                onChange={handleInputChange}
                onBlur={handleBlur}
                disabled={disabled}
                placeholder="--:--"
                className="pr-7 h-full font-medium"
            />
            <div className="absolute right-1.5 flex items-center justify-center">
                <Popover open={open} onOpenChange={setOpen} modal={false}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            className="h-8 w-8 hover:bg-transparent"
                        >
                            <Clock className="h-4 w-4 opacity-50 hover:opacity-100 transition-opacity" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverPrimitive.Content 
                        className={cn(
                            "z-[9999] w-auto rounded-md border bg-popover p-0 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                        )}
                        align="end"
                        sideOffset={4}
                        onWheel={(e) => e.stopPropagation()}
                    >
                <div className="flex h-64 border rounded-md bg-popover shadow-xl">
                    {/* Hours Column */}
                    <ScrollArea className="w-16">
                        <div className="flex flex-col p-1">
                            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground text-center border-b mb-1">HH</div>
                            {hours.map((h) => (
                                <Button
                                    key={h}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-8 w-full justify-center font-medium text-[13px]",
                                        selectedHour === h && "bg-primary text-primary-foreground hover:bg-primary/90"
                                    )}
                                    onClick={() => {
                                        setSelectedHour(h);
                                        if (selectedMinute) handleSelect(h, selectedMinute);
                                    }}
                                >
                                    {h}
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                    {/* Minutes Column */}
                    <ScrollArea className="w-16">
                        <div className="flex flex-col p-1">
                            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground text-center border-b mb-1">MM</div>
                            {minutes.map((m) => (
                                <Button
                                    key={m}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-8 w-full justify-center font-medium text-[13px]",
                                        selectedMinute === m && "bg-primary text-primary-foreground hover:bg-primary/90"
                                    )}
                                    onClick={() => {
                                        setSelectedMinute(m);
                                        if (selectedHour) handleSelect(selectedHour, m);
                                    }}
                                >
                                    {m}
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                    </PopoverPrimitive.Content>
                </Popover>
      </div>
    </div>
    );
}
