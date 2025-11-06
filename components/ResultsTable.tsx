"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type FilterFn,
  type SortingState,
  type PaginationState,
  type RowSelectionState,
  type GroupingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Download,
  Trash2,
  Filter,
  X,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import MaterialSelect from "./MaterialSelect";
import TotalsSummary from "./TotalsSummary";
import { cn, formatMass } from "@/lib/utils";

interface MaterialOption {
  id: string;
  name: string;
  co2: number;
  ubp: number;
  kwh: number;
  density?: number;
}

interface MaterialData {
  element: string;
  material: string;
  quantity: number;
  unit: "kg" | "m3";
  kg: number;
  co2: number;
  ubp: number;
  kwh: number;
  matchedMaterial: string;
  matchScore: number | null;
  availableMaterials: MaterialOption[];
  density?: number;
}

interface ResultsTableProps {
  data: MaterialData[];
  originalHeaders: string[];
  originalRowData: Record<string, string>[];
  onUpdateMaterial?: (indices: number[], material: MaterialOption) => void;
  onDeleteRows?: (indices: number[]) => void;
}

// Global filter function
const globalFilterFn: FilterFn<MaterialData> = (row, columnId, value) => {
  const search = value.toLowerCase();
  const element = row.original.element?.toLowerCase() || "";
  const material = row.original.material?.toLowerCase() || "";
  const matchedMaterial = row.original.matchedMaterial?.toLowerCase() || "";
  return (
    element.includes(search) ||
    material.includes(search) ||
    matchedMaterial.includes(search)
  );
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Format number with Swiss locale (apostrophes as thousands separator, smart decimal places)
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "N/A";
  }
  // Round to 2 decimal places
  const rounded = Math.round(value * 100) / 100;
  // Format with Swiss locale (de-CH) which uses apostrophes as thousands separator
  // Show decimals only when needed (not .00 for whole numbers)
  return rounded.toLocaleString("de-CH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// Component that only shows title if text is truncated
function TruncatedText({
  children,
  className = ""
}: {
  children: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const checkTruncation = () => {
      if (ref.current) {
        setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
      }
    };

    // Check after a small delay to ensure DOM is rendered
    const timeoutId = setTimeout(() => {
      checkTruncation();

      // Use ResizeObserver for more accurate detection
      if (ref.current && typeof ResizeObserver !== 'undefined') {
        observerRef.current = new ResizeObserver(checkTruncation);
        observerRef.current.observe(ref.current);
      }
    }, 0);

    // Check on resize
    window.addEventListener('resize', checkTruncation);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkTruncation);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [children]);

  return (
    <span
      ref={ref}
      className={className}
      title={isTruncated ? children : undefined}
    >
      {children}
    </span>
  );
}

export default function ResultsTable({
  data,
  originalHeaders,
  originalRowData,
  onUpdateMaterial,
  onDeleteRows,
}: ResultsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "element", desc: false },
    { id: "material", desc: false },
  ]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [grouping, setGrouping] = React.useState<GroupingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<
    Array<{ id: string; value: unknown }>
  >([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const debouncedGlobalFilter = useDebounce(globalFilter, 300);

  // Column definitions
  const columns = React.useMemo<ColumnDef<MaterialData>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-[#24283b] focus:ring-[#7aa2f7] dark:focus:ring-[#7aa2f7] dark:bg-[#1a1b26]"
          />
        ),
        cell: ({ row }) => {
          const isGrouped = row.getIsGrouped();

          if (isGrouped) {
            const groupRows = row.getLeafRows();
            const allSelected = groupRows.every((r) => r.getIsSelected());
            const someSelected = groupRows.some((r) => r.getIsSelected());

            return (
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = someSelected && !allSelected;
                  }
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  groupRows.forEach((r) => r.toggleSelected(e.target.checked));
                }}
                className="h-4 w-4 rounded border-gray-300 dark:border-[#24283b] focus:ring-[#7aa2f7] dark:focus:ring-[#7aa2f7] dark:bg-[#1a1b26]"
              />
            );
          }

          return (
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              onChange={(e) => row.toggleSelected(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-[#24283b] focus:ring-[#7aa2f7] dark:focus:ring-[#7aa2f7] dark:bg-[#1a1b26]"
            />
          );
        },
        enableGrouping: false,
        enableSorting: false,
        size: 50,
        minSize: 50,
        maxSize: 50,
      },
      {
        accessorKey: "element",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting()}
            className="h-auto p-0 font-medium hover:bg-transparent whitespace-normal leading-tight text-left"
          >
            <span className="inline-block">Element</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-1 h-4 w-4 shrink-0" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-1 h-4 w-4 shrink-0" />
            ) : (
              <ArrowUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        ),
        size: 120,
        minSize: 100,
        maxSize: 150,
        cell: ({ row, table }) => {
          const isGrouped = table.getState().grouping.length > 0;
          const isGroupedRow = row.getIsGrouped();

          if (isGroupedRow) {
            return (
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={row.getToggleExpandedHandler()}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-[#24283b] rounded shrink-0"
                >
                  {row.getIsExpanded() ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                <TruncatedText className="font-medium truncate">{row.getValue<string>("element")}</TruncatedText>
                <Badge variant="secondary" className="ml-2 shrink-0">
                  {row.subRows.length} {row.subRows.length === 1 ? "Zeile" : "Zeilen"}
                </Badge>
              </div>
            );
          }

          const value = row.getValue<string>("element");
          return <TruncatedText className="truncate block">{value}</TruncatedText>;
        },
        enableGrouping: true,
      },
      {
        accessorKey: "material",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting()}
            className="h-auto p-0 font-medium hover:bg-transparent whitespace-normal leading-tight text-left"
          >
            <span className="inline-block">Material</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-1 h-4 w-4 shrink-0" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-1 h-4 w-4 shrink-0" />
            ) : (
              <ArrowUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        ),
        size: 120,
        minSize: 100,
        maxSize: 150,
        cell: ({ row }) => {
          const isGrouped = row.getIsGrouped();
          if (isGrouped) {
            const value = row.getValue<string>("material");
            return <TruncatedText className="font-medium truncate">{value}</TruncatedText>;
          }
          const value = row.getValue<string>("material");
          return <TruncatedText className="truncate block">{value}</TruncatedText>;
        },
        enableGrouping: true,
      },
      {
        id: "matchedMaterial",
        accessorKey: "matchedMaterial",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting()}
            className="h-auto p-0 font-medium hover:bg-transparent whitespace-normal leading-tight text-left"
          >
            <span className="inline-block">Zugeordnetes Material</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-1 h-4 w-4 shrink-0" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-1 h-4 w-4 shrink-0" />
            ) : (
              <ArrowUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        ),
        size: 160,
        minSize: 130,
        maxSize: 200,
        cell: ({ row }) => {
          const isGrouped = row.getIsGrouped();
          if (isGrouped) {
            const value = row.getValue<string>("matchedMaterial");
            return <TruncatedText className="font-medium truncate">{value}</TruncatedText>;
          }

          const rowData = row.original;
          const rowIndex = parseInt(row.id);

          return (
            <div className="min-w-0">
              <MaterialSelect
                materials={rowData.availableMaterials}
                selectedMaterial={rowData.matchedMaterial}
                onSelect={(material) => {
                  const selectedRows = table
                    .getSelectedRowModel()
                    .rows.map((r) => parseInt(r.id));
                  const indices = selectedRows.includes(rowIndex)
                    ? selectedRows
                    : [rowIndex];
                  onUpdateMaterial?.(indices, material);
                }}
                showDensity={rowData.unit === "m3"}
              />
            </div>
          );
        },
        enableGrouping: true,
      },
      {
        accessorKey: "quantity",
        header: ({ column }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting()}
              className="h-auto p-0 font-medium hover:bg-transparent whitespace-normal leading-tight text-right justify-end"
            >
              <span className="inline-block">{data[0]?.unit === "m3" ? "Volumen (m³)" : "Masse (kg)"}</span>
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-1 h-4 w-4 shrink-0" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-1 h-4 w-4 shrink-0" />
              ) : (
                <ArrowUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          </div>
        ),
        size: 110,
        minSize: 90,
        maxSize: 130,
        cell: ({ row }) => {
          const isGrouped = row.getIsGrouped();
          const value = row.getValue<number>("quantity");
          if (isGrouped) {
            const leafRows = row.getLeafRows();
            const aggregated = leafRows.reduce((sum, r) => sum + (r.getValue<number>("quantity") || 0), 0);
            return (
              <div className="text-right font-medium">
                {formatNumber(aggregated)}
              </div>
            );
          }
          return <div className="text-right">{formatNumber(value)}</div>;
        },
        aggregationFn: (columnId, leafRows) => {
          return leafRows.reduce((sum, row) => {
            const value = row.getValue<number>(columnId);
            return sum + (typeof value === 'number' ? value : 0);
          }, 0);
        },
      },
      ...(data[0]?.unit === "m3"
        ? [
          {
            accessorKey: "density" as const,
            header: () => (
              <div className="text-right whitespace-normal leading-tight">Dichte (kg/m³)</div>
            ),
            cell: ({ row }: { row: any }) => {
              const value = row.original.density;
              return (
                <div className="text-right">
                  {formatNumber(value)}
                </div>
              );
            },
            enableGrouping: false,
            enableSorting: false,
            size: 120,
            minSize: 100,
            maxSize: 140,
          } as ColumnDef<MaterialData>,
          {
            accessorKey: "kg" as const,
            header: ({ column }) => (
              <div className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => column.toggleSorting()}
                  className="h-auto p-0 font-medium hover:bg-transparent whitespace-normal leading-tight text-right justify-end"
                >
                  <span className="inline-block">Masse (kg/t)</span>
                  {column.getIsSorted() === "asc" ? (
                    <ArrowUp className="ml-1 h-4 w-4 shrink-0" />
                  ) : column.getIsSorted() === "desc" ? (
                    <ArrowDown className="ml-1 h-4 w-4 shrink-0" />
                  ) : (
                    <ArrowUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                  )}
                </Button>
              </div>
            ),
            size: 120,
            minSize: 100,
            maxSize: 140,
            cell: ({ row }) => {
              const isGrouped = row.getIsGrouped();
              const value = row.getValue<number>("kg");
              if (isGrouped) {
                const leafRows = row.getLeafRows();
                const aggregated = leafRows.reduce((sum, r) => sum + (r.getValue<number>("kg") || 0), 0);
                return (
                  <div className="text-right font-medium">
                    {formatMass(aggregated)}
                  </div>
                );
              }
              return <div className="text-right">{formatMass(value)}</div>;
            },
            aggregationFn: (columnId, leafRows) => {
              return leafRows.reduce((sum, row) => {
                const value = row.getValue<number>(columnId);
                return sum + (typeof value === 'number' ? value : 0);
              }, 0);
            },
          } as ColumnDef<MaterialData>,
        ]
        : []),
      {
        accessorKey: "co2",
        header: ({ column }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting()}
              className="h-auto p-0 font-medium hover:bg-transparent whitespace-normal leading-tight text-right justify-end"
            >
              <span className="inline-block">CO₂-eq</span>
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-1 h-4 w-4 shrink-0" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-1 h-4 w-4 shrink-0" />
              ) : (
                <ArrowUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          </div>
        ),
        size: 110,
        minSize: 90,
        maxSize: 130,
        cell: ({ row }) => {
          const isGrouped = row.getIsGrouped();
          const value = row.getValue<number>("co2");
          if (isGrouped) {
            const leafRows = row.getLeafRows();
            const aggregated = leafRows.reduce((sum, r) => sum + (r.getValue<number>("co2") || 0), 0);
            return (
              <div className="text-right font-medium">
                {formatNumber(aggregated)}
              </div>
            );
          }
          return <div className="text-right">{formatNumber(value)}</div>;
        },
        aggregationFn: (columnId, leafRows) => {
          return leafRows.reduce((sum, row) => {
            const value = row.getValue<number>(columnId);
            return sum + (typeof value === 'number' ? value : 0);
          }, 0);
        },
      },
      {
        accessorKey: "ubp",
        header: ({ column }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting()}
              className="h-auto p-0 font-medium hover:bg-transparent whitespace-normal leading-tight text-right justify-end"
            >
              <span className="inline-block">UBP (Pkt)</span>
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-1 h-4 w-4 shrink-0" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-1 h-4 w-4 shrink-0" />
              ) : (
                <ArrowUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          </div>
        ),
        size: 110,
        minSize: 90,
        maxSize: 130,
        cell: ({ row }) => {
          const isGrouped = row.getIsGrouped();
          const value = row.getValue<number>("ubp");
          if (isGrouped) {
            const leafRows = row.getLeafRows();
            const aggregated = leafRows.reduce((sum, r) => sum + (r.getValue<number>("ubp") || 0), 0);
            return (
              <div className="text-right font-medium">
                {formatNumber(aggregated)}
              </div>
            );
          }
          return <div className="text-right">{formatNumber(value)}</div>;
        },
        aggregationFn: (columnId, leafRows) => {
          return leafRows.reduce((sum, row) => {
            const value = row.getValue<number>(columnId);
            return sum + (typeof value === 'number' ? value : 0);
          }, 0);
        },
      },
      {
        accessorKey: "kwh",
        header: ({ column }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting()}
              className="h-auto p-0 font-medium hover:bg-transparent whitespace-normal leading-tight text-right justify-end"
            >
              <span className="inline-block">PENR (kWh)</span>
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-1 h-4 w-4 shrink-0" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-1 h-4 w-4 shrink-0" />
              ) : (
                <ArrowUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          </div>
        ),
        size: 100,
        minSize: 85,
        maxSize: 120,
        cell: ({ row }) => {
          const isGrouped = row.getIsGrouped();
          const value = row.getValue<number>("kwh");
          if (isGrouped) {
            const leafRows = row.getLeafRows();
            const aggregated = leafRows.reduce((sum, r) => sum + (r.getValue<number>("kwh") || 0), 0);
            return (
              <div className="text-right font-medium">
                {formatNumber(aggregated)}
              </div>
            );
          }
          return <div className="text-right">{formatNumber(value)}</div>;
        },
        aggregationFn: (columnId, leafRows) => {
          return leafRows.reduce((sum, row) => {
            const value = row.getValue<number>(columnId);
            return sum + (typeof value === 'number' ? value : 0);
          }, 0);
        },
      },
    ],
    [data]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      grouping,
      globalFilter: debouncedGlobalFilter,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGroupingChange: setGrouping,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    globalFilterFn,
    enableRowSelection: true,
    enableGrouping: true,
    getRowId: (row, index) => `${index}`,
    initialState: {
      grouping: [],
    },
  });

  // Calculate totals from filtered data
  const totals = React.useMemo(() => {
    const filteredData = table.getFilteredRowModel().rows.map((row) => row.original);
    return {
      totalMass: filteredData.reduce((sum, row) => sum + row.kg, 0),
      totalCO2: filteredData.reduce((sum, row) => sum + row.co2, 0),
      totalUBP: filteredData.reduce((sum, row) => sum + row.ubp, 0),
      totalEnergy: filteredData.reduce((sum, row) => sum + row.kwh, 0),
      itemCount: filteredData.length,
    };
  }, [table, data, debouncedGlobalFilter, grouping, sorting, pagination]);

  // Virtual scrolling setup - only use when not grouped for simplicity
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();
  const isGrouped = grouping.length > 0;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 50,
    overscan: 10,
    enabled: !isGrouped && pagination.pageSize !== rows.length, // Disable when grouped or showing all
  });

  // Selected rows
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedIndices = selectedRows.map((row) => parseInt(row.id));

  // Available materials for bulk update
  const availableMaterials =
    data[0]?.availableMaterials || selectedRows[0]?.original.availableMaterials || [];

  // Handle bulk material update
  const handleBulkUpdate = (material: MaterialOption) => {
    if (selectedIndices.length > 0 && onUpdateMaterial) {
      onUpdateMaterial(selectedIndices, material);
      table.resetRowSelection();
    }
  };

  // Handle delete
  const handleDelete = React.useCallback(() => {
    if (selectedIndices.length === 0 || !onDeleteRows) return;

    const confirmMessage =
      selectedIndices.length === 1
        ? "Möchten Sie diese Zeile wirklich löschen?"
        : `Möchten Sie diese ${selectedIndices.length} Zeilen wirklich löschen?`;

    if (window.confirm(confirmMessage)) {
      onDeleteRows(selectedIndices);
      table.resetRowSelection();
    }
  }, [selectedIndices, onDeleteRows, table]);

  // Export CSV
  const handleExportCSV = () => {
    const escapeCSV = (value: string | number) => {
      const stringValue = String(value);
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("'")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rowsToExport =
      selectedIndices.length > 0
        ? selectedIndices
        : table.getFilteredRowModel().rows.map((row) => parseInt(row.id));

    const csvContent = [
      [
        ...originalHeaders,
        "Matched Material",
        "CO2 (kg CO2 eq)",
        "UBP (pts)",
        "Energy (kWh)",
      ]
        .map(escapeCSV)
        .join(","),
      ...rowsToExport.map((index) => {
        const originalData = originalHeaders.map((header) => {
          const value = originalRowData[index]?.[header] || "";
          return escapeCSV(value);
        });

        const resultData = [
          data[index].matchedMaterial,
          formatNumber(data[index].co2),
          formatNumber(data[index].ubp),
          formatNumber(data[index].kwh),
        ].map(escapeCSV);

        return [...originalData, ...resultData].join(",");
      }),
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const filename =
      selectedIndices.length > 0
        ? `lca-results-${selectedIndices.length}-selected-${new Date().toISOString().split("T")[0]
        }.csv`
        : `lca-results-all-${new Date().toISOString().split("T")[0]}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedIndices.length > 0) {
        handleDelete();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        table.toggleAllRowsSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndices.length, table, handleDelete]);

  return (
    <div className="w-full space-y-6">
      <TotalsSummary data={totals} />

      {/* Toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Global Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-[#565f89]" />
            <Input
              placeholder="Global suchen..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter("")}
                className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-[#a9b1d6]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Grouping Selector */}
          <Select
            value={grouping.length > 0 ? grouping[0] : "none"}
            onValueChange={(value) => {
              if (value === "none") {
                setGrouping([]);
              } else {
                setGrouping([value]);
              }
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Gruppierung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine Gruppierung</SelectItem>
              <SelectItem value="element">Nach Element</SelectItem>
              <SelectItem value="material">Nach Material</SelectItem>
              <SelectItem value="matchedMaterial">Nach Zugeordnetes Material</SelectItem>
            </SelectContent>
          </Select>

          {/* Selection info */}
          {selectedIndices.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedIndices.length} ausgewählt
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Bulk Material Update */}
          {selectedIndices.length > 0 && (
            <div className="w-[250px]">
              <MaterialSelect
                materials={availableMaterials}
                selectedMaterial=""
                onSelect={handleBulkUpdate}
                placeholder="Ausgewählte aktualisieren..."
              />
            </div>
          )}

          {/* Delete Button */}
          {selectedIndices.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Löschen ({selectedIndices.length})
            </Button>
          )}

          {/* Export Button */}
          <Button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            {selectedIndices.length > 0
              ? `${selectedIndices.length} Exportieren`
              : "Alle exportieren"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 dark:border-[#24283b] bg-white dark:bg-[#1a1b26] shadow-sm">
        <div
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ height: "600px" }}
        >
          <table className="border-collapse" style={{ minWidth: "max-content", width: "100%" }}>
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#24283b]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-3 text-left text-sm font-medium text-gray-500 dark:text-[#a9b1d6] border-b border-gray-200 dark:border-[#24283b]"
                      style={{
                        width: header.getSize(),
                        minWidth: header.column.columnDef.minSize,
                        maxWidth: header.column.columnDef.maxSize,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white dark:bg-[#1a1b26]">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-gray-500 dark:text-[#565f89]"
                  >
                    {debouncedGlobalFilter
                      ? "Keine Ergebnisse gefunden"
                      : "Keine Daten verfügbar"}
                  </td>
                </tr>
              ) : rowVirtualizer.getVirtualItems().length > 0 && !isGrouped ? (
                // Virtualized rendering for non-grouped tables
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-gray-200 dark:border-[#24283b]",
                        row.getIsSelected() &&
                        "bg-blue-50 dark:bg-[#24283b]",
                        "hover:bg-gray-50 dark:hover:bg-[#292e42]"
                      )}
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-3 py-2 text-sm text-gray-900 dark:text-[#a9b1d6]"
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.columnDef.minSize,
                            maxWidth: cell.column.columnDef.maxSize,
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                // Regular rendering for grouped tables or when virtualization is disabled
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-gray-200 dark:border-[#24283b]",
                      row.getIsSelected() &&
                      "bg-blue-50 dark:bg-[#24283b]",
                      "hover:bg-gray-50 dark:hover:bg-[#292e42]",
                      row.getIsGrouped() && "bg-gray-50 dark:bg-[#24283b]"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2 text-sm text-gray-900 dark:text-[#a9b1d6]"
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.columnDef.minSize,
                          maxWidth: cell.column.columnDef.maxSize,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-[#24283b]">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-[#a9b1d6]">
              Zeige{" "}
              {table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
                1}{" "}
              bis{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{" "}
              von {table.getFilteredRowModel().rows.length} Zeilen
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => {
                table.setPageSize(
                  value === "all" ? table.getFilteredRowModel().rows.length : Number(value)
                );
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 pro Seite</SelectItem>
                <SelectItem value="25">25 pro Seite</SelectItem>
                <SelectItem value="50">50 pro Seite</SelectItem>
                <SelectItem value="100">100 pro Seite</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronFirst className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  table.setPageIndex(table.getPageCount() - 1)
                }
                disabled={!table.getCanNextPage()}
              >
                <ChevronLast className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
