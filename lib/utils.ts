import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Intelligently formats mass values, switching from kg to tons when >= 1000 kg
 * @param kg - Mass in kilograms
 * @returns Formatted string with appropriate unit (kg or t)
 */
export function formatMass(kg: number): string {
  if (kg === null || kg === undefined || isNaN(kg)) {
    return "N/A";
  }
  
  // Convert to tons if >= 1000 kg
  if (kg >= 1000) {
    const tons = kg / 1000;
    const rounded = Math.round(tons * 100) / 100;
    
    return `${rounded.toLocaleString("de-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} t`;
  }
  
  // Show as kg for values < 1000
  const rounded = Math.round(kg * 100) / 100;
  
  return `${rounded.toLocaleString("de-CH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
}

/**
 * Formats mass value and returns both the formatted string and the unit separately
 * Useful for cases where you need to display unit separately
 */
export function formatMassWithUnit(kg: number): { value: string; unit: string } {
  if (kg === null || kg === undefined || isNaN(kg)) {
    return { value: "N/A", unit: "" };
  }
  
  if (kg >= 1000) {
    const tons = kg / 1000;
    const rounded = Math.round(tons * 100) / 100;
    
    return {
      value: rounded.toLocaleString("de-CH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
      unit: "t",
    };
  }
  
  const rounded = Math.round(kg * 100) / 100;
  
  return {
    value: rounded.toLocaleString("de-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }),
    unit: "kg",
  };
}
