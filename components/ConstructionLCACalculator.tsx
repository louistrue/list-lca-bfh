"use client";

import { Check, ChevronDown, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CSVUploader from "./CSVUploader";
import ColumnMapper from "./ColumnMapper";
import ResultsTable from "./ResultsTable";
import StepIndicator from "./StepIndicator";

interface MaterialOption {
  id: string;
  name: string;
  co2: number;
  ubp: number;
  kwh: number;
  density?: number;
  densityMin?: number;
  densityMax?: number;
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
  densityMin?: number;
  densityMax?: number;
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

  // New state for UX improvements
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [collapsedSections, setCollapsedSections] = useState({
    upload: false,
    mapper: false,
  });
  const [fileName, setFileName] = useState<string>("");
  const [mappingSummary, setMappingSummary] = useState<{
    element: string;
    material: string;
    quantity: string;
    unit: "kg" | "m3";
  } | null>(null);
  const [shouldScrollToMapper, setShouldScrollToMapper] = useState(false);
  const [shouldScrollToResults, setShouldScrollToResults] = useState(false);
  const [highlightMapper, setHighlightMapper] = useState(false);
  const [highlightResults, setHighlightResults] = useState(false);

  // Refs for auto-scrolling
  const mapperRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleCSVUpload = (data: string[][], headers: string[], file: string) => {
    setCSVData(data);
    setColumns(headers);
    setFileName(file);
    // Store complete original row data
    const rowData = data.map((row) => {
      const rowObj: Record<string, string> = {};
      headers.forEach((header, index) => {
        rowObj[header] = row[index];
      });
      return rowObj;
    });
    setOriginalRowData(rowData);
    // Collapse upload section and move to step 2
    setCollapsedSections((prev) => ({ ...prev, upload: true }));
    setCurrentStep(2);
    setShouldScrollToMapper(true);
  };

  const handleUpdateMaterial = (
    indices: number[],
    material: MaterialOption
  ) => {
    setMappedData((prevData) => {
      const newData = [...prevData];

      indices.forEach((index) => {
        const row = newData[index];

        // Recalculate kg if unit is m3 and density changed
        let kg = row.kg;
        if (row.unit === "m3" && material.density) {
          kg = row.quantity * material.density;
        }

        newData[index] = {
          ...row,
          kg,
          density: material.density,
          densityMin: material.densityMin,
          densityMax: material.densityMax,
          matchedMaterial: material.name,
          co2: material.co2 * kg,
          ubp: material.ubp * kg,
          kwh: material.kwh * kg,
          matchScore: 0, // Perfect match since manually selected
        };
      });

      return newData;
    });
  };

  const handleUpdateDensity = (index: number, newDensity: number) => {
    setMappedData((prevData) => {
      const newData = [...prevData];
      const row = newData[index];

      // Strict validation: ONLY allow changes within the valid range
      if (row.densityMin !== undefined && row.densityMax !== undefined) {
        // Clamp to range
        newDensity = Math.max(row.densityMin, Math.min(row.densityMax, newDensity));

        // If no range exists (min === max), don't allow changes
        if (row.densityMin === row.densityMax) {
          console.warn("Density is fixed, cannot be changed");
          return prevData; // Don't update
        }
      } else {
        // No range information, don't allow changes
        console.warn("No density range information available");
        return prevData;
      }

      // Recalculate mass and environmental impacts
      const kg = row.unit === "m3" ? row.quantity * newDensity : row.kg;
      const material = row.availableMaterials.find(m => m.name === row.matchedMaterial);

      newData[index] = {
        ...row,
        density: newDensity,
        kg,
        co2: material ? material.co2 * kg : 0,
        ubp: material ? material.ubp * kg : 0,
        kwh: material ? material.kwh * kg : 0,
      };

      return newData;
    });
  };

  // Helper function to normalize CSV cell value to a number
  // SIMPLE: Remove thousands separators, treat dot/comma as decimal
  const normalizeCSVNumber = (value: string): number => {
    if (!value || value.trim() === "") return 0;

    let normalized = value.trim();

    // Remove thousands separators: apostrophes, spaces
    normalized = normalized.replace(/['''\u2018\u2019\u201A\u201B\u2032\u2035]/g, "");
    normalized = normalized.replace(/\s+/g, "");

    // Count dots and commas
    const dotCount = (normalized.match(/\./g) || []).length;
    const commaCount = (normalized.match(/,/g) || []).length;

    // SIMPLE RULES:
    // 1. If both dots and commas: the last one is decimal separator
    // 2. If only dots: treat as decimal separator (standard CSV format)
    // 3. If only commas: treat as decimal separator
    // 4. Multiple of same type: all but last are thousands separators

    if (dotCount > 0 && commaCount > 0) {
      // Both present - last one is decimal
      const lastDotIndex = normalized.lastIndexOf(".");
      const lastCommaIndex = normalized.lastIndexOf(",");
      if (lastCommaIndex > lastDotIndex) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
      } else {
        normalized = normalized.replace(/,/g, "");
      }
    } else if (commaCount > 1) {
      // Multiple commas: all but last are thousands
      const parts = normalized.split(",");
      normalized = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
    } else if (commaCount === 1) {
      // Single comma: decimal separator
      normalized = normalized.replace(",", ".");
    } else if (dotCount > 1) {
      // Multiple dots: all but last are thousands
      const parts = normalized.split(".");
      normalized = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
    }
    // Single dot or no separators: keep as-is (standard decimal format)

    const parsed = parseFloat(normalized);
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

      // Store mapping summary for collapsed view
      setMappingSummary({
        element: columns[mapping.element] || "",
        material: columns[mapping.material] || "",
        quantity: columns[mapping.quantity] || "",
        unit,
      });

      const dataWithLCA = await fetchLCAData(mappedData);
      setMappedData(dataWithLCA);
      setShowColumnMapper(false);
      // Collapse mapper section and move to step 3
      setCollapsedSections((prev) => ({ ...prev, mapper: true }));
      setCurrentStep(3);
      setShouldScrollToResults(true);
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

  // Auto-scroll effects
  useEffect(() => {
    if (shouldScrollToMapper && mapperRef.current) {
      setTimeout(() => {
        mapperRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setHighlightMapper(true);
        setTimeout(() => setHighlightMapper(false), 2000);
      }, 100);
      setShouldScrollToMapper(false);
    }
  }, [shouldScrollToMapper]);

  useEffect(() => {
    if (shouldScrollToResults && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setHighlightResults(true);
        setTimeout(() => setHighlightResults(false), 2000);
      }, 100);
      setShouldScrollToResults(false);
    }
  }, [shouldScrollToResults]);

  const toggleSection = (section: "upload" | "mapper") => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
    if (section === "upload" && !collapsedSections.upload) {
      setCurrentStep(1);
    } else if (section === "mapper" && !collapsedSections.mapper) {
      setShowColumnMapper(true);
      setCurrentStep(2);
    }
  };

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Upload Section - Collapsible */}
      {collapsedSections.upload ? (
        <div className="bg-white dark:bg-[#1a1b26] border border-gray-200 dark:border-[#24283b] rounded-lg p-4 shadow-sm">
          <button
            onClick={() => toggleSection("upload")}
            className="w-full flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-[#24283b] rounded p-2 -m-2 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-[#a9b1d6]">
                  CSV hochgeladen
                </div>
                <div className="text-sm text-gray-500 dark:text-[#565f89]">
                  {fileName} • {csvData.length} Zeilen
                </div>
              </div>
            </div>
            <ChevronDown className="w-5 h-5 text-gray-400 dark:text-[#565f89]" />
          </button>
        </div>
      ) : (
        <div>
          <CSVUploader onUpload={handleCSVUpload} />
        </div>
      )}

      {/* Column Mapper Section - Collapsible */}
      {columns.length > 0 && (
        <div ref={mapperRef}>
          {collapsedSections.mapper && !showColumnMapper ? (
            <div
              className={`bg-white dark:bg-[#1a1b26] border-2 rounded-lg p-4 shadow-sm transition-all ${highlightMapper
                ? "border-[#7aa2f7] shadow-lg shadow-[#7aa2f7]/20 animate-pulse"
                : "border-gray-200 dark:border-[#24283b]"
                }`}
            >
              <button
                onClick={() => toggleSection("mapper")}
                className="w-full flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-[#24283b] rounded p-2 -m-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-[#a9b1d6]">
                      Spalten zugeordnet
                    </div>
                    <div className="text-sm text-gray-500 dark:text-[#565f89]">
                      {mappingSummary
                        ? `${mappingSummary.element}, ${mappingSummary.material}, ${mappingSummary.quantity} • ${mappingSummary.unit === "kg" ? "Masse" : "Volumen"}`
                        : "Zuordnung abgeschlossen"}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 dark:text-[#565f89]" />
              </button>
            </div>
          ) : (
            <div
              className={`transition-all ${highlightMapper
                ? "border-2 border-[#7aa2f7] rounded-lg shadow-lg shadow-[#7aa2f7]/20 animate-pulse p-1 -m-1"
                : ""
                }`}
            >
              <ColumnMapper
                columns={columns}
                onMap={handleColumnMapping}
                csvPreview={csvData.slice(0, 3)} // Show first 3 rows as preview
                onCancel={() => {
                  setShowColumnMapper(false);
                  if (mappedData.length > 0) {
                    setCollapsedSections((prev) => ({ ...prev, mapper: true }));
                  }
                }}
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
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="text-center">
          <p>Processing data...</p>
        </div>
      )}

      {/* Results Section */}
      {mappedData.length > 0 && !showColumnMapper && (
        <div
          ref={resultsRef}
          className={`transition-all ${highlightResults
            ? "border-2 border-[#7aa2f7] rounded-lg shadow-lg shadow-[#7aa2f7]/20 animate-pulse p-1 -m-1"
            : ""
            }`}
        >
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                setShowColumnMapper(true);
                setCollapsedSections((prev) => ({ ...prev, mapper: false }));
                setCurrentStep(2);
              }}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Spaltenzuordnung anpassen
            </button>
          </div>
          <ResultsTable
            data={mappedData}
            originalHeaders={columns}
            originalRowData={originalRowData}
            onUpdateMaterial={handleUpdateMaterial}
            onUpdateDensity={handleUpdateDensity}
            onDeleteRows={handleDeleteRows}
          />
        </div>
      )}
    </div>
  );
}
