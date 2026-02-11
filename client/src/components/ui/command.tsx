/**
 * Command Component Library
 * 
 * This file provides a set of reusable command palette components built on top of
 * the cmdk library and Radix UI primitives. These components are commonly used
 * for creating searchable command interfaces, dropdown menus, and autocomplete inputs.
 * 
 * Components included:
 * - Command: Main container component
 * - CommandDialog: Modal dialog wrapper for commands
 * - CommandInput: Search input with icon (bordered)
 * - CommandInputBorderless: Search input without borders
 * - CommandList: Scrollable list container
 * - CommandEmpty: Empty state component
 * - CommandGroup: Grouped items container
 * - CommandItem: Individual selectable items
 * - CommandSeparator: Visual separator between groups
 * - CommandShortcut: Keyboard shortcut display
 */

"use client"

import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

/**
 * Command - Main container component for command palette
 * 
 * This is the root component that wraps all command-related functionality.
 * It provides the base styling and structure for command interfaces.
 * 
 * @example
 * <Command>
 *   <CommandInput placeholder="Search..." />
 *   <CommandList>
 *     <CommandGroup heading="Suggestions">
 *       <CommandItem>Item 1</CommandItem>
 *       <CommandItem>Item 2</CommandItem>
 *     </CommandGroup>
 *   </CommandList>
 * </Command>
 */
const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

/**
 * CommandDialog - Modal dialog wrapper for command palette
 * 
 * Creates a modal dialog containing a command palette. Useful for global
 * command interfaces that overlay the entire application (like Cmd+K menus).
 * 
 * @param children - Command components to render inside the dialog
 * @param props - Standard dialog props (open, onOpenChange, etc.)
 * 
 * @example
 * <CommandDialog open={open} onOpenChange={setOpen}>
 *   <CommandInput placeholder="Type a command..." />
 *   <CommandList>
 *     <CommandGroup heading="Actions">
 *       <CommandItem>Create new file</CommandItem>
 *       <CommandItem>Open settings</CommandItem>
 *     </CommandGroup>
 *   </CommandList>
 * </CommandDialog>
 */
const CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

/**
 * CommandInput - Search input with border and search icon
 * 
 * Provides a styled search input with a search icon. This is the standard
 * input component for command palettes with visible borders and focus states.
 * 
 * @example
 * <CommandInput placeholder="Search commands..." />
 */
const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center h-9 m-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-within:outline-none focus-within:ring-1 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-full w-full bg-transparent text-sm outline-none border-none focus:ring-0 ring-0 shadow-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

/**
 * CommandInputBorderless - Search input without borders
 * 
 * A minimal search input variant without borders or focus rings.
 * Useful for inline search functionality or when you want a cleaner look.
 * 
 * @example
 * <CommandInputBorderless placeholder="Filter items..." />
 */
const CommandInputBorderless = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center h-9 w-full bg-transparent px-3 text-sm transition-colors focus-within:outline-none focus-within:ring-0 focus-within:border-none border-none ring-0 outline-none shadow-none !border-0 disabled:cursor-not-allowed disabled:opacity-50" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-full w-full bg-transparent text-sm outline-none border-none focus:ring-0 ring-0 shadow-none focus-visible:ring-0 focus-visible:outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 !border-0 !ring-0 !outline-none !shadow-none",
        className
      )}
      {...props}
    />
  </div>
))
CommandInputBorderless.displayName = "CommandInputBorderless"

/**
 * CommandList - Scrollable container for command items
 * 
 * Provides a scrollable container for command items with a maximum height.
 * Handles overflow and provides smooth scrolling for long lists of items.
 * 
 * @example
 * <CommandList>
 *   <CommandGroup>
 *     <CommandItem>Item 1</CommandItem>
 *     <CommandItem>Item 2</CommandItem>
 *   </CommandGroup>
 * </CommandList>
 */
const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
))

CommandList.displayName = CommandPrimitive.List.displayName

/**
 * CommandEmpty - Empty state component
 * 
 * Displays when no command items match the current search query.
 * Shows a centered message to indicate no results were found.
 * 
 * @example
 * <CommandEmpty>No results found.</CommandEmpty>
 */
const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm"
    {...props}
  />
))

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

/**
 * CommandGroup - Container for grouped command items
 * 
 * Groups related command items together with an optional heading.
 * Provides consistent spacing and styling for item groups.
 * 
 * @example
 * <CommandGroup heading="File Operations">
 *   <CommandItem>New File</CommandItem>
 *   <CommandItem>Open File</CommandItem>
 *   <CommandItem>Save File</CommandItem>
 * </CommandGroup>
 */
const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className
    )}
    {...props}
  />
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

/**
 * CommandSeparator - Visual separator between groups
 * 
 * Provides a horizontal line to visually separate different command groups.
 * Useful for creating clear divisions between different types of commands.
 * 
 * @example
 * <CommandGroup heading="File">
 *   <CommandItem>New</CommandItem>
 * </CommandGroup>
 * <CommandSeparator />
 * <CommandGroup heading="Edit">
 *   <CommandItem>Copy</CommandItem>
 * </CommandGroup>
 */
const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

/**
 * CommandItem - Individual selectable command item
 * 
 * Represents a single selectable item in the command palette.
 * Handles hover states, selection, and keyboard navigation automatically.
 * 
 * @example
 * <CommandItem onSelect={() => console.log('Selected!')}>
 *   <FileIcon className="mr-2 h-4 w-4" />
 *   <span>Create new file</span>
 *   <CommandShortcut>⌘N</CommandShortcut>
 * </CommandItem>
 */
const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className
    )}
    {...props}
  />
))

CommandItem.displayName = CommandPrimitive.Item.displayName

/**
 * CommandShortcut - Keyboard shortcut display component
 * 
 * Displays keyboard shortcuts aligned to the right side of command items.
 * Useful for showing users the keyboard shortcuts for various commands.
 * 
 * @example
 * <CommandItem>
 *   <span>Save File</span>
 *   <CommandShortcut>⌘S</CommandShortcut>
 * </CommandItem>
 */
const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = "CommandShortcut"

// Export all components for use throughout the application
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandInputBorderless,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
