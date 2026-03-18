import React from "react";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
    onClick: (e: React.MouseEvent) => void;
    label?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    className?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

interface TableActionButtonsProps {
    onView?: (e: React.MouseEvent) => void;
    onEdit?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    onDownload?: (e: React.MouseEvent) => void;
    customActions?: React.ReactNode;
    className?: string;
}

export function TableActionButtons({
    onView,
    onEdit,
    onDelete,
    onDownload,
    customActions,
    className
}: TableActionButtonsProps) {
    return (
        <div className={cn("flex justify-center gap-1", className)}>
            {onView && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-primary" 
                    onClick={onView}
                    title="View"
                >
                    <Eye className="h-4 w-4" />
                </Button>
            )}
            {onEdit && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-primary" 
                    onClick={onEdit}
                    title="Edit"
                >
                    <Edit className="h-4 w-4" />
                </Button>
            )}
            {onDownload && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-primary" 
                    onClick={onDownload}
                    title="Download"
                >
                    <Download className="h-4 w-4" />
                </Button>
            )}
            {onDelete && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive" 
                    onClick={onDelete}
                    title="Delete"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
            {customActions}
        </div>
    );
}
