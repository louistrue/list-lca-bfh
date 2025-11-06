"use client";

import { useState } from "react";
import CSVUploader from "./CSVUploader";
import ColumnMapper from "./ColumnMapper";
import ResultsTable from "./ResultsTable";
import { Settings } from "lucide-react";

interface MaterialOption {
  id: string;
  name: string;
  co2: number;
  ubp: number;
  kwh: number;
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

interface LCADataInput {
  element: string;
  material: string;
  quantity: number;
  unit: "kg" | "m3";
}

export default function ConstructionLCACalculator() {
  const [csvData, setCSVData] = useState<string[][]>([]);
  const [mappedData, setMappedData] = useState<MaterialData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [originalRowData, setOriginalRowData] = useState<
    Record<string, string>[]
  >([]);
  const [showColumnMapper, setShowColumnMapper] = useState(false);

  const handleCSVUpload = (data: string[][], headers: string[]) => {
    setCSVData(data);
    setColumns(headers);
    // Store complete original row data
    const rowData = data.map((row) => {
      const rowObj: Record<string, string> = {};
      headers.forEach((header, index) => {
        rowObj[header] = row[index];
      });
      return rowObj;
    });
    setOriginalRowData(rowData);
  };

  const handleUpdateMaterial = (
    indices: number[],
    material: MaterialOption
  ) => {
    setMappedData((prevData) => {
      const newData = [...prevData];

      indices.forEach((index) => {
        const row = newData[index];
        const totalKg = row.kg;

        newData[index] = {
          ...row,
          matchedMaterial: material.name,
          co2: material.co2 * totalKg,
          ubp: material.ubp * totalKg,
          kwh: material.kwh * totalKg,
          matchScore: 0, // Perfect match since manually selected
        };
      });

      return newData;
    });
  };

  // Helper function to normalize CSV cell value to a number
  // Handles thousand separators (apostrophes, commas, dots, spaces), locale decimal separators, etc.
  const normalizeCSVNumber = (value: string): number => {
    if (!value || value.trim() === "") return 0;

    let normalized = value.trim();

    // Remove various apostrophe/quote characters (Swiss thousands separator)
    // Handle regular apostrophe ', right single quotation mark ', left single quotation mark ', 
    // and other Unicode quote variants
    normalized = normalized.replace(/['''\u2018\u2019\u201A\u201B\u2032\u2035]/g, "");

    // Remove ALL whitespace characters (spaces, non-breaking spaces, tabs, etc.)
    // This handles formats like "12 345" or "1 234 567"
    normalized = normalized.replace(/\s+/g, "");

    // Count dots and commas after removing apostrophes and spaces
    const dotCount = (normalized.match(/\./g) || []).length;
    const commaCount = (normalized.match(/,/g) || []).length;

    // Handle different number formats:
    // Swiss: "37'184.090" (apostrophe = thousands, dot = decimal)
    // US: "37,184.090" (comma = thousands, dot = decimal)
    // European: "37.184,090" (dot = thousands, comma = decimal)
    // European (dots only): "1.234.567" (all dots = thousands)
    // Space-separated: "12 345" (space = thousands)

    if (dotCount > 0 && commaCount > 0) {
      // Both dots and commas present - determine format by last separator
      const lastDotIndex = normalized.lastIndexOf(".");
      const lastCommaIndex = normalized.lastIndexOf(",");

      if (lastCommaIndex > lastDotIndex) {
        // European format: comma is decimal (e.g., "37.184,090")
        normalized = normalized.replace(/\./g, ""); // Remove dots (thousands)
        normalized = normalized.replace(/,/g, "."); // Replace comma with dot (decimal)
      } else {
        // US format: dot is decimal (e.g., "37,184.090")
        normalized = normalized.replace(/,/g, ""); // Remove commas (thousands)
        // Dot already in place as decimal
      }
    } else if (commaCount > 1) {
      // Multiple commas = thousands separators
      normalized = normalized.replace(/,/g, "");
    } else if (commaCount === 1 && dotCount === 0) {
      // Single comma, no dots - could be decimal or thousands
      // Check characters after comma: if 3 or fewer, likely decimal; otherwise thousands
      const commaIndex = normalized.indexOf(",");
      const charsAfter = normalized.length - commaIndex - 1;
      // If 3 or fewer chars after comma, treat as decimal separator
      if (charsAfter <= 3 && charsAfter > 0) {
        normalized = normalized.replace(/,/g, ".");
      } else {
        normalized = normalized.replace(/,/g, "");
      }
    } else if (dotCount > 1 && commaCount === 0) {
      // Multiple dots with no commas -> treat ALL as thousands separators (European format)
      // e.g., "1.234.567" -> "1234567"
      normalized = normalized.replace(/\./g, "");
    } else if (dotCount === 1 && commaCount === 0) {
      // Single dot, no commas - could be decimal or thousands
      // Check characters after dot: if 3 or fewer, likely decimal; otherwise thousands
      const dotIndex = normalized.indexOf(".");
      const charsAfter = normalized.length - dotIndex - 1;
      // If 3 or fewer chars after dot, treat as decimal separator; otherwise thousands
      if (charsAfter <= 3 && charsAfter > 0) {
        // Keep as decimal
      } else {
        // Treat as thousands separator, remove it
        normalized = normalized.replace(/\./g, "");
      }
    }
    // If no dots or commas, number is already clean

    const parsed = parseFloat(normalized);

    // Debug logging for suspicious values
    if ((value.includes("'") || value.includes(" ") || dotCount > 1) && parsed < 1000 && value.length > 5) {
      console.warn(`Possible parsing issue: "${value}" -> ${parsed}`);
    }

    return isNaN(parsed) ? 0 : parsed;
  };

  const handleColumnMapping = async (
    mapping: Record<string, number>,
    unit: "kg" | "m3"
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const mappedData = csvData.map((row, index) => {
        const element =
          row[mapping.element] ||
          `Unknown Element ${index + 1}`;
        const material =
          row[mapping.material] ||
          `Unknown Material ${index + 1}`;
        const rawQuantity = row[mapping.quantity] || "";
        const quantityValue = normalizeCSVNumber(rawQuantity);

        // Debug logging for first few rows
        if (index < 3) {
          console.log(`Row ${index}: rawQuantity="${rawQuantity}", normalized=${quantityValue}`);
        }

        return {
          element,
          material,
          quantity: quantityValue,
          unit,
          kg: 0,
        };
      });

      const dataWithLCA = await fetchLCAData(mappedData);
      setMappedData(dataWithLCA);
      setShowColumnMapper(false);
      setError(null);
    } catch (error) {
      console.error("Error mapping columns:", error);
      setError(
        "An error occurred while processing the data. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLCAData = async (
    data: LCADataInput[]
  ): Promise<MaterialData[]> => {
    try {
      const response = await fetch("/api/lca-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      console.error("Error fetching LCA data:", error);
      setError(
        `Failed to fetch LCA data: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return data.map(
        (item: LCADataInput): MaterialData => ({
          ...item,
          co2: 0,
          ubp: 0,
          kwh: 0,
          kg: item.quantity,
          matchedMaterial: "Error fetching data",
          matchScore: null,
          availableMaterials: [],
        })
      );
    }
  };

  const handleDeleteRows = (indices: number[]) => {
    // Sort indices in descending order to avoid index shifting issues
    const sortedIndices = [...indices].sort((a, b) => b - a);

    setMappedData((prevData) => {
      const newData = [...prevData];
      sortedIndices.forEach((index) => {
        newData.splice(index, 1);
      });
      return newData;
    });

    // Also update original data
    setOriginalRowData((prevData) => {
      const newData = [...prevData];
      sortedIndices.forEach((index) => {
        newData.splice(index, 1);
      });
      return newData;
    });
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!columns.length && <CSVUploader onUpload={handleCSVUpload} />}

      {(columns.length > 0 && !mappedData.length) || showColumnMapper ? (
        <ColumnMapper
          columns={columns}
          onMap={handleColumnMapping}
          csvPreview={csvData.slice(0, 3)} // Show first 3 rows as preview
          onCancel={() => setShowColumnMapper(false)}
          initialMapping={
            mappedData.length > 0
              ? (() => {
                // Compute column indices once and cache them
                const elementIdx = csvData[0]?.findIndex(
                  (cell, idx) => cell === mappedData[0].element
                ) ?? -1;
                const materialIdx = csvData[0]?.findIndex(
                  (cell, idx) => cell === mappedData[0].material
                ) ?? -1;

                // For quantity, normalize CSV values before comparing
                const quantityIdx = csvData[0]?.findIndex((cell) => {
                  const normalizedCSV = normalizeCSVNumber(cell);
                  const normalizedMapped = mappedData[0].quantity;
                  // Compare with small epsilon to handle floating point precision
                  return Math.abs(normalizedCSV - normalizedMapped) < 0.001;
                }) ?? -1;

                return {
                  element:
                    elementIdx !== -1
                      ? `${columns[elementIdx]}:${elementIdx}`
                      : "",
                  material:
                    materialIdx !== -1
                      ? `${columns[materialIdx]}:${materialIdx}`
                      : "",
                  quantity:
                    quantityIdx !== -1
                      ? `${columns[quantityIdx]}:${quantityIdx}`
                      : "",
                };
              })()
              : undefined
          }
          initialUnit={mappedData[0]?.unit as "kg" | "m3" | undefined}
        />
      ) : null}

      {isLoading && (
        <div className="text-center">
          <p>Processing data...</p>
        </div>
      )}

      {mappedData.length > 0 && !showColumnMapper && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowColumnMapper(true)}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Adjust Column Mapping
            </button>
          </div>
          <ResultsTable
            data={mappedData}
            originalHeaders={columns}
            originalRowData={originalRowData}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteRows={handleDeleteRows}
          />
        </>
      )}
    </div>
  );
}
