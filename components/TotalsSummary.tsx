"use client";

import { Scale, Leaf, Zap, Building2 } from "lucide-react";

interface TotalsSummaryProps {
  data: {
    totalMass: number;
    totalCO2: number;
    totalUBP: number;
    totalEnergy: number;
    itemCount: number;
  };
}

export default function TotalsSummary({ data }: TotalsSummaryProps) {
  const metrics = [
    {
      label: "Total Mass",
      value: `${data.totalMass.toLocaleString("de-CH", {
        maximumFractionDigits: 0,
      })} kg`,
      icon: Scale,
      description: `From ${data.itemCount} items`,
    },
    {
      label: "CO₂ Emissions",
      value: `${data.totalCO2.toLocaleString("de-CH", {
        maximumFractionDigits: 0,
      })} kg CO₂-eq`,
      icon: Leaf,
      description: "Global Warming Potential",
    },
    {
      label: "Environmental Impact",
      value: `${(data.totalUBP / 1000).toLocaleString("de-CH", {
        maximumFractionDigits: 0,
      })}k pts`,
      icon: Building2,
      description: "UBP 2021",
    },
    {
      label: "Energy Consumption",
      value: `${data.totalEnergy.toLocaleString("de-CH", {
        maximumFractionDigits: 0,
      })} kWh`,
      icon: Zap,
      description: "Non-renewable Primary Energy",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="bg-white dark:bg-[#1a1b26] rounded-lg p-6 shadow-sm border border-gray-100 dark:border-[#24283b] hover:border-gray-200 dark:hover:border-[#414868] transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-[#a9b1d6]">
                {metric.label}
              </p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-[#c0caf5]">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-[#565f89]">
                {metric.description}
              </p>
            </div>
            <metric.icon className="w-5 h-5 text-gray-400 dark:text-[#7aa2f7]" />
          </div>
        </div>
      ))}
    </div>
  );
}
