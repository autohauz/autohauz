import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * Table primitives — DESIGN.md §6. 44 px rows, sticky header, zebra hairlines,
 * numeric cells right-aligned and tabular. Wrap in <TableScroll> so wide tables
 * scroll inside their container instead of the page.
 */

function TableScroll({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-scroll"
      className={cn("relative w-full overflow-x-auto rounded-lg border border-border bg-card shadow-card", className)}
      {...props}
    />
  );
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table data-slot="table" className={cn("w-full caption-bottom text-sm tabular-nums", className)} {...props} />;
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("sticky top-0 z-10 bg-muted text-left text-xs font-semibold text-muted-foreground [&_th]:h-10 [&_th]:px-3", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("divide-y divide-border [&_tr:nth-child(even)]:bg-muted/50", className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("h-11 transition-colors duration-150 hover:bg-accent-soft/60 focus-within:bg-accent-soft/60 data-selected:bg-accent-soft", className)}
      {...props}
    />
  );
}

type CellProps = React.ComponentProps<"td"> & { numeric?: boolean };

function TableHead({ className, numeric, ...props }: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return <th data-slot="table-head" scope="col" className={cn("whitespace-nowrap font-semibold", numeric && "text-right", className)} {...props} />;
}

function TableCell({ className, numeric, ...props }: CellProps) {
  return <td data-slot="table-cell" className={cn("px-3 py-2 align-middle", numeric && "text-right", className)} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("py-3 text-sm text-muted-foreground", className)} {...props} />;
}

/** Full-width message row for empty / loading / error states. */
function TableMessage({ colSpan, children, className }: { colSpan: number; children: React.ReactNode; className?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn("px-4 py-12 text-center text-sm text-muted-foreground", className)}>
        {children}
      </td>
    </tr>
  );
}

export { TableScroll, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, TableMessage };
