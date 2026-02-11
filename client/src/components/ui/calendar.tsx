"use client"

import * as React from "react"
import {
    ChevronsDown,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react"
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"


export function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    captionLayout = "label",
    buttonVariant = "ghost",
    formatters,
    components,
    ...props
}: React.ComponentProps<typeof DayPicker> & {
    buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
    const defaultClassNames = getDefaultClassNames()

    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn(
                "bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent overflow-visible",
                String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
                String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
                className
            )}
            captionLayout={captionLayout}
            formatters={{
                formatMonthDropdown: (date) =>
                    date.toLocaleString("default", { month: "long" }),
                ...formatters,
            }}
            classNames={{
                root: cn("w-fit font-sans", defaultClassNames.root),
                months: cn(
                    "relative flex flex-col sm:flex-row gap-4",
                    defaultClassNames.months
                ),
                month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
                nav: cn(
                    "absolute inset-x-0 top-0 flex w-full items-center justify-between px-1 z-10",
                    defaultClassNames.nav
                ),
                button_previous: cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                    defaultClassNames.button_previous
                ),
                button_next: cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                    defaultClassNames.button_next
                ),
                month_caption: cn(
                    "flex h-9 w-full items-center justify-center relative",
                    defaultClassNames.month_caption
                ),
                caption_label: cn(
                    "text-sm font-medium",
                    defaultClassNames.caption_label
                ),
                dropdowns: cn(
                    "flex w-full items-center justify-center gap-1 relative z-30",
                    defaultClassNames.dropdowns
                ),
                table: "w-full border-collapse space-y-1",
                weekdays: cn("flex pb-2", defaultClassNames.weekdays),
                weekday: cn(
                    "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
                    defaultClassNames.weekday
                ),
                week: cn("flex w-full mt-2", defaultClassNames.week),
                week_number_header: cn(
                    "w-[--cell-size] select-none",
                    defaultClassNames.week_number_header
                ),
                week_number: cn(
                    "text-muted-foreground select-none text-[0.8rem]",
                    defaultClassNames.week_number
                ),
                day: cn(
                    "group/day relative aspect-square h-8 w-8 p-0 text-center text-sm focus-within:relative focus-within:z-20 aria-selected:opacity-100",
                    defaultClassNames.day
                ),
                range_start: cn(
                    "bg-accent rounded-l-md",
                    defaultClassNames.range_start
                ),
                range_middle: cn("rounded-none", defaultClassNames.range_middle),
                range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
                today: cn(
                    "bg-indigo-600 text-white rounded-md font-bold",
                    defaultClassNames.today
                ),
                outside: cn(
                    "text-muted-foreground opacity-50",
                    defaultClassNames.outside
                ),
                disabled: cn(
                    "text-muted-foreground opacity-50",
                    defaultClassNames.disabled
                ),
                hidden: cn("invisible", defaultClassNames.hidden),
                ...classNames,
            }}
            components={{
                Dropdown: ({ value, onChange, children, ...props }: any) => {
                    const options = React.Children.toArray(children) as React.ReactElement<React.HTMLProps<HTMLOptionElement>>[]
                    const selected = options.find((child) => child.props.value?.toString() === value?.toString())

                    const handleChange = (newValue: string) => {
                        const changeEvent = {
                            target: { value: newValue },
                        } as React.ChangeEvent<HTMLSelectElement>
                        onChange?.(changeEvent)
                    }

                    return (
                        <Select
                            value={value?.toString()}
                            onValueChange={handleChange}
                        >
                            <SelectTrigger className="pr-1.5 focus:ring-0 font-bold text-sm h-7 border-none shadow-none hover:bg-accent/50 w-auto min-w-[50px] flex gap-1 justify-center rounded-md">
                                <SelectValue>
                                    {selected?.props?.label || selected?.props?.children || value}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent position="popper" className="max-h-[200px] bg-popover text-popover-foreground z-[9999] min-w-[120px] border shadow-lg date-picker-dropdown">
                                <ScrollArea className="h-full max-h-[200px]">
                                    {options.map((option, id) => (
                                        <SelectItem key={`${option.props.value}-${id}`} value={option.props.value?.toString() ?? ""}>
                                            {option.props.label || option.props.children}
                                        </SelectItem>
                                    ))}
                                </ScrollArea>
                            </SelectContent>
                        </Select>
                    )
                },
                Root: ({ className, rootRef, ...props }) => {
                    return (
                        <div
                            data-slot="calendar"
                            ref={rootRef}
                            className={cn(className)}
                            {...props}
                        />
                    )
                },
                Chevron: ({ className, orientation, ...props }) => {
                    if (orientation === "left") {
                        return (
                            <ChevronsLeft className={cn("size-4", className)} {...props} />
                        )
                    }

                    if (orientation === "right") {
                        return (
                            <ChevronsRight
                                className={cn("size-4", className)}
                                {...props}
                            />
                        )
                    }

                    return (
                        <ChevronsDown className={cn("size-4", className)} {...props} />
                    )
                },
                DayButton: CalendarDayButton,
                WeekNumber: ({ children, ...props }) => {
                    return (
                        <td {...props}>
                            <div className="flex size-[--cell-size] items-center justify-center text-center">
                                {children}
                            </div>
                        </td>
                    )
                },
                ...components,
            }}
            {...props}
        />
    )
}




export function CalendarDayButton({
    className,
    day,
    modifiers,
    ...props
}: React.ComponentProps<typeof DayButton>) {
    const defaultClassNames = getDefaultClassNames()

    const ref = React.useRef<HTMLButtonElement>(null)
    React.useEffect(() => {
        if (modifiers.focused) ref.current?.focus()
    }, [modifiers.focused])

    return (
        <Button
            ref={ref}
            variant="ghost"
            size="icon"
            data-day={day.date.toLocaleDateString()}
            data-selected-single={
                modifiers.selected &&
                !modifiers.range_start &&
                !modifiers.range_end &&
                !modifiers.range_middle
            }
            data-range-start={modifiers.range_start}
            data-range-end={modifiers.range_end}
            data-range-middle={modifiers.range_middle}
            className={cn(
                "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-[--cell-size] flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
                defaultClassNames.day,
                className
            )}
            {...props}
        />
    )
}


