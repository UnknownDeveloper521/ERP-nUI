import { Link, useLocation } from "wouter";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface TabItem {
  name: string;
  path: string;
}

interface ModuleTabsProps {
  tabs: TabItem[];
}

export default function ModuleTabs({ tabs }: ModuleTabsProps) {
  const [location] = useLocation();

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex border-b border-border">
        {tabs.map((tab) => {
          const isActive = location === tab.path;
          return (
            <Link
              key={tab.path}
              href={tab.path}
              data-testid={`tab-${tab.name.toLowerCase().replace(/\s+/g, '-')}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
