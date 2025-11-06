import { NextResponse } from "next/server";
import Fuse from "fuse.js";

const LCA_API_URL = "https://www.lcadata.ch/api/kbob/materials?pageSize=all";
const LCADATA_API_KEY = process.env.LCADATA_API_KEY;

if (!LCADATA_API_KEY) {
  console.warn("Warning: LCADATA_API_KEY is not set in environment variables");
}

interface Material {
  uuid: string;
  nameDE: string;
  nameFR: string;
  density: string;
  unit: string;
  ubp21Total: number | null;
  gwpTotal: number | null;
  primaryEnergyNonRenewableTotal: number | null;
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Validate input data
    if (!Array.isArray(data)) {
      throw new Error("Invalid input: data must be an array");
    }

    // Clean and validate the data
    const cleanedData = data.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new Error(`Invalid item at index ${index}: must be an object`);
      }

      return {
        element: item.element || `Unknown Element ${index + 1}`,
        material: item.material || `Unknown Material ${index + 1}`,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit || "kg",
      };
    });

    const fetchLCAData = async (): Promise<Material[]> => {
      try {
        if (!LCADATA_API_KEY) {
          throw new Error("API key is not configured in environment variables");
        }

        try {
          console.log("Fetching LCA materials from:", LCA_API_URL);

          const response = await fetch(LCA_API_URL, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "x-api-key": LCADATA_API_KEY,
            },
            cache: "no-store",
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("API error:", response.status, errorText);
            throw new Error(`API error: ${response.status} ${errorText}`);
          }

          const result = await response.json();

          if (!result.materials || !Array.isArray(result.materials)) {
            console.error("Invalid API response format:", result);
            throw new Error("Invalid API response format");
          }

          return result.materials;
        } catch (networkError) {
          if (
            networkError instanceof TypeError &&
            networkError.message === "fetch failed"
          ) {
            console.error(
              "Network error - Unable to reach the API endpoint:",
              networkError
            );
            throw new Error(
              "Unable to connect to the LCA data service. Please check your internet connection and try again."
            );
          }
          throw networkError;
        }
      } catch (error) {
        console.error("Error fetching LCA data:", error);
        throw error;
      }
    };

    const lcaMaterials = await fetchLCAData();
    console.log("Total materials fetched:", lcaMaterials.length);

    const kgMaterials = lcaMaterials.filter(
      (material) => material.unit === "kg"
    );
    console.log("Total kg materials:", kgMaterials.length);

    const fuse = new Fuse(kgMaterials, {
      keys: ["nameDE", "nameFR"],
      threshold: 0.6,
      includeScore: true,
      minMatchCharLength: 3,
      ignoreLocation: true,
      shouldSort: true,
      findAllMatches: true,
    });

    const dataWithLCA = cleanedData.map((item) => {
      const searchTerm = item.material.toUpperCase();
      console.log(`Searching for material: ${searchTerm}`);

      const fuseResult = fuse.search(searchTerm);

      console.log(
        `Found ${fuseResult.length} potential matches:`,
        fuseResult.map((r) => ({
          name: r.item.nameDE,
          score: r.score,
        }))
      );

      const matchedMaterial = fuseResult.length > 0 ? fuseResult[0].item : null;
      const matchScore =
        fuseResult.length > 0 ? fuseResult[0].score ?? null : null;
      const isGoodMatch = typeof matchScore === "number" && matchScore < 0.4;

      // Calculate kg based on density if unit is m3
      let kg = item.quantity;
      if (item.unit === "m3" && matchedMaterial) {
        const density = parseFloat(matchedMaterial.density || "0");
        kg = item.quantity * density;
      }

      return {
        ...item,
        kg,
        density: matchedMaterial
          ? parseFloat(matchedMaterial.density || "0")
          : 0,
        co2:
          isGoodMatch && matchedMaterial
            ? (matchedMaterial.gwpTotal ?? 0) * kg
            : 0,
        ubp:
          isGoodMatch && matchedMaterial
            ? (matchedMaterial.ubp21Total ?? 0) * kg
            : 0,
        kwh:
          isGoodMatch && matchedMaterial
            ? (matchedMaterial.primaryEnergyNonRenewableTotal ?? 0) * kg
            : 0,
        matchedMaterial:
          isGoodMatch && matchedMaterial
            ? matchedMaterial.nameDE
            : `No match found for: ${item.material}`,
        matchScore,
        searchTerm,
        availableMaterials: kgMaterials.map((m) => ({
          id: m.uuid,
          name: m.nameDE,
          density: parseFloat(m.density || "0"),
          co2: m.gwpTotal ?? 0,
          ubp: m.ubp21Total ?? 0,
          kwh: m.primaryEnergyNonRenewableTotal ?? 0,
        })),
      };
    });

    return NextResponse.json(dataWithLCA);
  } catch (error) {
    console.error("Error processing request:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error stack:", errorStack);
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
