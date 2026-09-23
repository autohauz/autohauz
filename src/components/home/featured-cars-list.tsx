"use client";

import { useState } from "react";
import { VehicleCard } from "@/components/vehicle-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { VehicleListItem } from "@/lib/domain";
import { cn } from "@/lib/utils";

const FILTERS = ["All Cars", "SUV", "Sedan", "Hatchback", "Ute"];

export function FeaturedCarsList({ vehicles }: { vehicles: VehicleListItem[] }) {
  const [activeFilter, setActiveFilter] = useState("All Cars");

  const filteredVehicles = vehicles.filter((v) => {
    if (activeFilter === "All Cars") return true;
    
    // Map filter label to expected body type data logic. 
    // Usually v.bodyType is something like "suv", "sedan", "hatch", "ute", etc.
    const normalizedFilter = activeFilter.toLowerCase();
    const normalizedBodyType = v.bodyType.toLowerCase();
    
    if (normalizedFilter === "hatchback") {
      return normalizedBodyType.includes("hatch");
    }
    
    return normalizedBodyType.includes(normalizedFilter) || normalizedFilter.includes(normalizedBodyType);
  });

  if (vehicles.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        headingLevel="h3"
        title="New stock is on its way"
        description="Browse everything currently listed, or tell us what you're after and we'll be in touch when it arrives."
        action={{ label: "Browse all cars", href: "/used-cars" }}
        secondaryAction={{ label: "Tell us what you're after", href: "/contact" }}
      />
    );
  }

  return (
    <div className="mt-6">
      {/* Category Pills */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-colors border",
                isActive
                  ? "bg-[#0a1e3f] text-white border-[#0a1e3f]"
                  : "bg-white text-[#4b5563] border-[#e5e7eb] hover:border-[#cbd5e1] hover:bg-gray-50"
              )}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filteredVehicles.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filteredVehicles.map((v, i) => (
            <VehicleCard key={v.id} vehicle={v} priority={i < 2} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No featured {activeFilter.toLowerCase()}s found. Try another category or view all cars.
        </div>
      )}
    </div>
  );
}
