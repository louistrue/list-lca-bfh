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
}

interface MaterialSelectProps {
    materials: MaterialOption[];
    selectedMaterial: string;
    onSelect: (material: MaterialOption) => void;
    showDensity?: boolean;
    placeholder?: string;
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

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    <span className="truncate">
                        {selectedMaterial || placeholder}
                    </span>
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
                                    <div className="flex gap-3 text-xs text-muted-foreground">
                                        <span>CO₂: {material.co2.toFixed(2)}</span>
                                        <span>UBP: {material.ubp.toFixed(0)}</span>
                                        <span>kWh: {material.kwh.toFixed(2)}</span>
                                        {showDensity && material.density && (
                                            <span>ρ: {material.density.toFixed(0)} kg/m³</span>
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

