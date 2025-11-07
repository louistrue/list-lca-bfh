"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

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

interface MaterialSelectProps {
    materials: MaterialOption[];
    selectedMaterial: string;
    onSelect: (material: MaterialOption) => void;
    showDensity?: boolean;
    placeholder?: string;
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

export default function MaterialSelect({
    materials,
    selectedMaterial,
    onSelect,
    showDensity = false,
    placeholder = "Material auswählen...",
}: MaterialSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");

    const selectedMaterialData = materials.find((m) => m.name === selectedMaterial);

    const filteredMaterials = React.useMemo(() => {
        if (!searchQuery) return materials;

        const query = searchQuery.toLowerCase();
        return materials.filter((material) =>
            material.name.toLowerCase().includes(query)
        );
    }, [materials, searchQuery]);

    const displayText = selectedMaterial || placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between min-w-0"
                >
                    <TruncatedText className="truncate flex-1 text-left">
                        {displayText}
                    </TruncatedText>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Material suchen..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                    />
                    <CommandList>
                        <CommandEmpty>Kein Material gefunden.</CommandEmpty>
                        <CommandGroup>
                            {filteredMaterials.map((material) => (
                                <CommandItem
                                    key={material.id}
                                    value={material.name}
                                    onSelect={() => {
                                        onSelect(material);
                                        setOpen(false);
                                        setSearchQuery("");
                                    }}
                                    className="flex flex-col items-start gap-1 py-3"
                                >
                                    <div className="flex w-full items-center justify-between">
                                        <span className="font-medium">{material.name}</span>
                                        <Check
                                            className={cn(
                                                "h-4 w-4 shrink-0",
                                                selectedMaterial === material.name
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                    </div>
                                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                                        <span>CO₂: {material.co2.toFixed(2)}</span>
                                        <span>UBP: {material.ubp.toFixed(0)}</span>
                                        <span>kWh: {material.kwh.toFixed(2)}</span>
                                        {showDensity && material.density !== undefined && (
                                            <>
                                                {material.densityMin !== material.densityMax && 
                                                 material.densityMax && 
                                                 material.densityMax > 0 ? (
                                                    <span className="text-orange-600 dark:text-orange-400 font-bold">
                                                        ρ: {material.densityMin}–{material.densityMax} kg/m³ (editierbar)
                                                    </span>
                                                ) : (
                                                    <span>
                                                        ρ: {material.density.toFixed(0)} kg/m³
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

