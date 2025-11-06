"use client";

import React, { useState } from "react";
import { Scale, Box } from "lucide-react";

interface ColumnMapperProps {
  columns: string[];
  onMap: (mapping: Record<string, number>, unit: "kg" | "m3") => void;
  csvPreview?: string[][];
  onCancel?: () => void;
  initialMapping?: Record<string, string>;
  initialUnit?: "kg" | "m3";
}

// Intelligent column detection based on common patterns
const detectColumn = (columns: string[], keywords: string[]): string => {
  const lowerColumns = columns.map((col) => col.toLowerCase());

  for (const keyword of keywords) {
    const index = lowerColumns.findIndex((col) => col.includes(keyword.toLowerCase()));
    if (index !== -1) {
      return `${columns[index]}:${index}`;
    }
  }

  return "";
};

const detectUnit = (columns: string[]): "kg" | "m3" => {
  const lowerColumns = columns.map((col) => col.toLowerCase());

  // Check for volume indicators
  const hasVolume = lowerColumns.some((col) =>
    col.includes("volumen") ||
    col.includes("volume") ||
    col.includes("m3") ||
    col.includes("m³") ||
    col.includes("grossvolume") ||
    col.includes("netvolume")
  );

  // Check for mass/weight indicators
  const hasMass = lowerColumns.some((col) =>
    col.includes("masse") ||
    col.includes("mass") ||
    col.includes("weight") ||
    col.includes("gewicht") ||
    col.includes("kg")
  );

  // If we have volume indicators and no mass indicators, default to m3
  if (hasVolume && !hasMass) {
    return "m3";
  }

  // Default to kg
  return "kg";
};

const getInitialMapping = (columns: string[], initialMapping?: Record<string, string>) => {
  if (initialMapping) {
    return initialMapping;
  }

  // Auto-detect columns based on common names
  return {
    element: detectColumn(columns, [
      "element", "bauteil", "component", "teil", "name (1)", "name(1)",
      "building element", "bauteile", "type name"
    ]),
    material: detectColumn(columns, [
      "material", "name (2)", "name(2)", "werkstoff", "baustoff",
      "construction material", "materialien"
    ]),
    quantity: detectColumn(columns, [
      "quantity", "menge", "amount", "mass", "masse", "volumen", "volume",
      "kg", "m3", "m³", "weight", "gewicht", "grossvolume", "netvolume"
    ]),
  };
};

export default function ColumnMapper({
  columns,
  onMap,
  csvPreview = [],
  onCancel,
  initialMapping,
  initialUnit = "kg",
}: ColumnMapperProps) {
  // Store column index along with name in the mapping
  const [mapping, setMapping] = useState<Record<string, string>>(
    getInitialMapping(columns, initialMapping)
  );

  // Auto-detect unit if not provided
  const detectedUnit = React.useMemo(() => {
    return initialUnit !== undefined ? initialUnit : detectUnit(columns);
  }, [columns, initialUnit]);

  const [unit, setUnit] = useState<"kg" | "m3">(detectedUnit);

  // Create display names for columns with duplicates
  const getDisplayName = (col: string, index: number) => {
    const count = columns.filter((c) => c === col).length;
    if (count > 1) {
      // Count how many times this column name appeared before this index
      const occurrenceNumber = columns.slice(0, index + 1).filter((c) => c === col).length;
      return `${col} (${occurrenceNumber})`;
    }
    return col;
  };

  return (
    <div className="space-y-6 bg-white dark:bg-[#1a1b26] p-6 rounded-lg shadow dark:shadow-[#24283b]">
      {/* Preview Table */}
      {csvPreview.length > 0 && (
        <div className="overflow-x-auto">
          <h3 className="font-medium text-gray-700 dark:text-[#a9b1d6] mb-2">
            Datenvorschau
          </h3>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-[#24283b]">
            <thead className="bg-gray-50 dark:bg-[#24283b]">
              <tr>
                {columns.map((header, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#a9b1d6] uppercase tracking-wider"
                  >
                    {getDisplayName(header, i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#1a1b26] divide-y divide-gray-200 dark:divide-[#24283b]">
              {csvPreview.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-gray-50 dark:hover:bg-[#292e42]"
                >
                  {columns.map((col, colIndex) => {
                    const currentIdentifier = `${col}:${colIndex}`;
                    return (
                      <td
                        key={colIndex}
                        className={`px-3 py-2 text-sm text-gray-900 dark:text-[#a9b1d6] ${mapping.element === currentIdentifier ||
                            mapping.material === currentIdentifier ||
                            mapping.quantity === currentIdentifier
                            ? "bg-blue-50 dark:bg-[#24283b]"
                            : ""
                          }`}
                      >
                        {row[colIndex]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Keep the index in the mapping - convert to numbers
          const cleanMapping = Object.fromEntries(
            Object.entries(mapping).map(([key, value]) => {
              const [colName, colIndex] = value.split(":");
              return [key, parseInt(colIndex)];
            })
          );
          onMap(cleanMapping, unit);
        }}
        className="space-y-6"
      >
        <div className="grid grid-cols-3 gap-4">
          {Object.keys(mapping).map((field) => {
            const labels = {
              element: "Bauteil",
              material: "Material",
              quantity: "Menge",
            };
            return (
              <div key={field} className="flex flex-col">
                <label
                  htmlFor={field}
                  className="mb-2 font-medium text-gray-700 dark:text-[#a9b1d6]"
                >
                  {labels[field as keyof typeof labels]}
                </label>
                <select
                  id={field}
                  value={mapping[field]}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                  className="p-2 border rounded bg-white dark:bg-[#1a1b26] text-gray-900 dark:text-[#a9b1d6] border-gray-300 dark:border-[#24283b]"
                  required
                >
                  <option value="">Spalte auswählen</option>
                  {columns.map((column, index) => (
                    <option
                      key={`${field}-${column}-${index}`}
                      value={`${column}:${index}`}
                    >
                      {getDisplayName(column, index)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <div className="bg-gray-50 dark:bg-[#24283b] p-4 rounded-lg">
          <label className="block mb-4 font-medium text-gray-700 dark:text-[#a9b1d6]">
            Einheit wählen
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setUnit("kg")}
              className={`flex items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${unit === "kg"
                  ? "border-[#7aa2f7] bg-[#7aa2f7]/10 text-[#7aa2f7]"
                  : "border-gray-200 dark:border-[#24283b] hover:border-gray-300 dark:hover:border-[#414868] text-gray-700 dark:text-[#a9b1d6]"
                }`}
            >
              <Scale
                className={
                  unit === "kg"
                    ? "text-[#7aa2f7]"
                    : "text-gray-400 dark:text-[#565f89]"
                }
              />
              <div className="text-left">
                <div className="font-medium">Masse</div>
                <div className="text-sm text-gray-500 dark:text-[#565f89]">
                  Kilogramm (kg)
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUnit("m3")}
              className={`flex items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${unit === "m3"
                  ? "border-[#7aa2f7] bg-[#7aa2f7]/10 text-[#7aa2f7]"
                  : "border-gray-200 dark:border-[#24283b] hover:border-gray-300 dark:hover:border-[#414868] text-gray-700 dark:text-[#a9b1d6]"
                }`}
            >
              <Box
                className={
                  unit === "m3"
                    ? "text-[#7aa2f7]"
                    : "text-gray-400 dark:text-[#565f89]"
                }
              />
              <div className="text-left">
                <div className="font-medium">Volumen</div>
                <div className="text-sm text-gray-500 dark:text-[#565f89]">
                  Kubikmeter (m³)
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 bg-[#7aa2f7] text-white px-4 py-3 rounded-lg hover:bg-[#7aa2f7]/90 transition-colors"
          >
            {initialMapping
              ? "Zuordnung aktualisieren"
              : "Spalten zuordnen und Daten verarbeiten"}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-3 rounded-lg border border-gray-300 dark:border-[#24283b] hover:bg-gray-50 dark:hover:bg-[#292e42] text-gray-700 dark:text-[#a9b1d6] transition-colors"
            >
              Abbrechen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
