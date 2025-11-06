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
        const quantityValue = parseFloat(
          row[mapping.quantity]
        );

        return {
          element,
          material,
          quantity: isNaN(quantityValue) ? 0 : quantityValue,
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
        `Failed to fetch LCA data: ${
          error instanceof Error ? error.message : "Unknown error"
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
              ? {
                  element:
                    columns.findIndex(
                      (col, idx) =>
                        csvData[0][idx] === mappedData[0].element
                    ) !== -1
                      ? `${columns[columns.findIndex((col, idx) => csvData[0][idx] === mappedData[0].element)]}:${columns.findIndex((col, idx) => csvData[0][idx] === mappedData[0].element)}`
                      : "",
                  material:
                    columns.findIndex(
                      (col, idx) =>
                        csvData[0][idx] === mappedData[0].material
                    ) !== -1
                      ? `${columns[columns.findIndex((col, idx) => csvData[0][idx] === mappedData[0].material)]}:${columns.findIndex((col, idx) => csvData[0][idx] === mappedData[0].material)}`
                      : "",
                  quantity:
                    columns.findIndex(
                      (col, idx) =>
                        csvData[0][idx] === String(mappedData[0].quantity)
                    ) !== -1
                      ? `${columns[columns.findIndex((col, idx) => csvData[0][idx] === String(mappedData[0].quantity))]}:${columns.findIndex((col, idx) => csvData[0][idx] === String(mappedData[0].quantity))}`
                      : "",
                }
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
