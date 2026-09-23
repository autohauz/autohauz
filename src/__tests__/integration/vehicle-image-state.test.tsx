/**
 * @vitest-environment jsdom
 */
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { VehicleForm } from "@/components/admin/vehicle-form";
import React from "react";
import type { Feature, LocationBranch } from "@/lib/domain";

type VehicleFormVehicle = NonNullable<React.ComponentProps<typeof VehicleForm>["vehicle"]>;

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock server actions imported in the component
vi.mock("@/app/admin/catalogue/actions", () => ({
  createMake: vi.fn(),
  createModel: vi.fn(),
}));
vi.mock("@/app/admin/inventory/actions", () => ({
  deleteVehicle: vi.fn(),
}));

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "mock-url" } })),
      }),
    },
  }),
}));

const mockMakes = [{ id: "make-1", name: "Toyota", slug: "toyota", isPopular: true }];
const mockModels = [{ id: "model-1", makeId: "make-1", name: "Camry", slug: "camry" }];
const mockFeatures: Feature[] = [];
const mockLocations: LocationBranch[] = [];

const vehicleA = {
  id: "v-a",
  stock_id: "A100",
  year: 2020,
  images: [
    { media: { storage_key: "a-1.jpg", url: "https://example.com/a-1.jpg" }, is_cover: true },
    { media: { storage_key: "a-2.jpg", url: "https://example.com/a-2.jpg" }, is_cover: false },
  ],
};

const vehicleB = {
  id: "v-b",
  stock_id: "B200",
  year: 2021,
  images: [], // Newly imported vehicle with zero images
};

// Wrapper that mimics the Page rendering the component, including the key
function PageWrapper({ vehicle }: { vehicle: VehicleFormVehicle }) {
  // Use a dummy action that just returns immediately
  const mockAction = async () => {};
  
  return (
    <VehicleForm 
      key={vehicle.id} 
      action={mockAction} 
      makes={mockMakes} 
      models={mockModels} 
      features={mockFeatures} 
      locations={mockLocations} 
      vehicle={vehicle} 
      mode="edit" 
    />
  );
}

describe("VehicleForm State Isolation across Navigations", () => {
  afterEach(() => {
    cleanup();
  });

  it("should completely isolate image state when navigating between vehicles and simulating upload", () => {
    // 1. Render Vehicle A
    const { rerender } = render(<PageWrapper vehicle={vehicleA} />);
    
    // Vehicle A has 2 images
    const images = screen.queryAllByRole("img", { hidden: true });
    expect(images.length).toBe(2);
    expect(images[0].getAttribute("src")).toBe("https://example.com/a-1.jpg");
    expect(images[1].getAttribute("src")).toBe("https://example.com/a-2.jpg");

    // 2. "Navigate" to Vehicle B (simulating bulk-imported draft)
    rerender(<PageWrapper vehicle={vehicleB} />);

    // Vehicle B should have exactly 0 images
    const newImages = screen.queryAllByRole("img", { hidden: true });
    expect(newImages.length).toBe(0);

    // 3. Simulate image upload for B
    // Instead of actually uploading via drag-and-drop, we can simulate the Next.js router
    // providing the updated vehicle B data with 1 image.
    // To ensure React picks up the new props from the server (which happens on a fresh navigation),
    // we must first navigate away (unmount) and then navigate back (remount).
    const vehicleBWithUpload = {
      ...vehicleB,
      images: [
        { media: { storage_key: "b-1.jpg", url: "https://example.com/b-1.jpg" }, is_cover: true }
      ]
    };
    
    // 4. "Navigate" back to A
    rerender(<PageWrapper vehicle={vehicleA} />);

    // Confirm A still has exactly 2 images (unmodified)
    const returningAImages = screen.queryAllByRole("img", { hidden: true });
    expect(returningAImages.length).toBe(2);
    expect(returningAImages[0].getAttribute("src")).toBe("https://example.com/a-1.jpg");

    // 5. "Navigate" back to B (now with the uploaded image from the server)
    rerender(<PageWrapper vehicle={vehicleBWithUpload} />);
    
    // Confirm B now has exactly 1 image
    const returningBImages = screen.queryAllByRole("img", { hidden: true });
    expect(returningBImages.length).toBe(1);
    expect(returningBImages[0].getAttribute("src")).toBe("https://example.com/b-1.jpg");
  });
});
