"use client";

import { Upload, Settings, Table } from "lucide-react";
import { Check } from "lucide-react";

interface StepIndicatorProps {
    currentStep: 1 | 2 | 3;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
    const steps = [
        {
            number: 1,
            label: "CSV hochladen",
            icon: Upload,
        },
        {
            number: 2,
            label: "Spalten zuordnen",
            icon: Settings,
        },
        {
            number: 3,
            label: "Ergebnisse anzeigen",
            icon: Table,
        },
    ];

    return (
        <div className="flex items-center justify-center gap-4 mb-8">
            {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = currentStep > step.number;
                const isCurrent = currentStep === step.number;
                const isUpcoming = currentStep < step.number;

                return (
                    <div key={step.number} className="flex items-center">
                        <div className="flex flex-col items-center">
                            <div
                                className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${isCompleted
                                        ? "bg-green-500 border-green-500 text-white"
                                        : isCurrent
                                            ? "bg-[#7aa2f7] border-[#7aa2f7] text-white shadow-lg scale-110"
                                            : "bg-gray-100 dark:bg-[#24283b] border-gray-300 dark:border-[#414868] text-gray-400 dark:text-[#565f89]"
                                    }`}
                            >
                                {isCompleted ? (
                                    <Check className="w-6 h-6" />
                                ) : (
                                    <Icon className="w-6 h-6" />
                                )}
                            </div>
                            <span
                                className={`mt-2 text-sm font-medium ${isCurrent
                                        ? "text-[#7aa2f7] dark:text-[#7aa2f7]"
                                        : isCompleted
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-gray-400 dark:text-[#565f89]"
                                    }`}
                            >
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div
                                className={`h-0.5 w-16 mx-4 transition-all ${isCompleted
                                        ? "bg-green-500"
                                        : "bg-gray-300 dark:bg-[#414868]"
                                    }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

