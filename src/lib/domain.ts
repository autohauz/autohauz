/**
 * Canonical domain types for the used-car sales platform.
 *
 * These mirror the Postgres schema in supabase/migrations/ (§18 of the SRS).
 * The Supabase clients are untyped, so query functions in src/lib/data/* shape
 * raw rows into these types explicitly. Field names are camelCase at this
 * boundary even though DB columns are snake_case.
 *
 * NOTE: the legacy rental types in src/lib/types.ts are being retired as their
 * consumers migrate to these types (Phase 3+).
 */

// ── Enums (mirror the PG enum types in 0001) ────────────────────────────────
export type FuelType = "petrol" | "diesel" | "hybrid" | "phev" | "electric" | "lpg";
export type TransmissionType = "automatic" | "manual" | "cvt" | "dct";
export type BodyType =
  | "sedan" | "hatch" | "suv" | "ute" | "wagon"
  | "coupe" | "convertible" | "van" | "people_mover";
export type DriveType = "fwd" | "rwd" | "awd" | "four_wd";
export type VehicleStatus = "draft" | "available" | "reserved" | "sold" | "archived";
export type FeatureCategory = "comfort" | "safety" | "technology" | "exterior";

export type LeadType =
  | "vehicle_enquiry" | "inspection" | "finance" | "trade_in"
  | "sell" | "callback" | "general";
export type LeadStatus =
  | "new" | "contacted" | "qualified" | "inspection_scheduled"
  | "negotiation" | "won" | "lost" | "spam";
export type LeadLossReason =
  | "price" | "sold_elsewhere" | "finance_declined" | "unresponsive" | "other";
export type DeviceType = "mobile" | "desktop" | "tablet" | "unknown";

export type TestimonialSource = "google" | "facebook" | "direct";
export type StaffRole = "owner" | "admin" | "manager" | "sales" | "content";

// ── Reference entities ──────────────────────────────────────────────────────
export type Make = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  isPopular: boolean;
  vehicleCount?: number;
};

export type Model = {
  id: string;
  makeId: string;
  name: string;
  slug: string;
  vehicleCount?: number;
};

export type Feature = {
  id: string;
  name: string;
  slug: string;
  category: FeatureCategory;
};

export type LocationBranch = {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  postcode?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  lat?: number | null;
  lng?: number | null;
  hours: Record<string, string>;
};

// ── Vehicle projections ─────────────────────────────────────────────────────

/** Card / listing projection — the 7±2 facts a grid card renders (SRS §8.1). */
export type VehicleListItem = {
  id: string;
  stockId: string;
  slug: string;
  makeSlug: string;
  modelSlug: string;
  makeName: string;
  modelName: string;
  variant: string | null;
  year: number;
  mileageKm: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  bodyType: BodyType;
  price: number;
  previousPrice: number | null;
  weeklyEstimate: number | null;
  status: VehicleStatus;
  isFeatured: boolean;
  isNewArrival: boolean; // published within the last 7 days (computed at fetch)
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  imageUrls?: string[];
  city: string | null;
  roadworthyIncluded: boolean;
  financeAvailable: boolean;
  tradeInWelcome: boolean;
  publishedAt: string | null;
  soldAt: string | null;
};

/** Full detail (VDP) projection. Extends the card with the deep fields. */
export type VehicleDetail = VehicleListItem & {
  makeId: string;
  modelId: string;
  driveType: DriveType | null;
  engine: string | null;
  powerKw: number | null;
  seats: number | null;
  doors: number | null;
  exteriorColor: string | null;
  interior: string | null;
  vinMasked: string | null; // last 6 only; full VIN is admin-only
  registration: string | null;
  regoExpiry: string | null;
  description: string | null;
  safetyRating: string | null;
  warrantyText: string | null;
  inspectionAvailable: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  images: VehicleImage[];
  features: Feature[];
  location: LocationBranch | null;
};

export type VehicleImage = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isCover: boolean;
};

// ── Content entities ────────────────────────────────────────────────────────
export type Testimonial = {
  id: string;
  customerName: string;
  photoUrl: string | null;
  vehicleId: string | null;
  rating: number;
  quote: string;
  source: TestimonialSource;
  reviewDate: string | null;
};

export type Faq = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
};


// ── Lead entities (admin side) ──────────────────────────────────────────────
export type Lead = {
  id: string;
  type: LeadType;
  status: LeadStatus;
  lossReason: LeadLossReason | null;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  vehicleId: string | null;
  payload: Record<string, unknown>;
  sourceUrl: string | null;
  utm: Record<string, unknown>;
  device: DeviceType | null;
  assigneeId: string | null;
  firstContactedAt: string | null;
  closedAt: string | null;
  duplicateOf: string | null;
  createdAt: string;
};

export type LeadEvent = {
  id: string;
  leadId: string;
  actorId: string | null;
  event: "created" | "status_changed" | "note" | "reminder_set" | "assigned" | "notified" | "exported";
  data: Record<string, unknown>;
  createdAt: string;
};

// ── Bidding & Messaging entities (buyer & staff) ─────────────────────────────
export type BidStatus = "pending" | "accepted" | "rejected" | "countered" | "withdrawn";

export type Bid = {
  id: string;
  vehicleId: string;
  buyerId: string;
  amount: number;
  status: BidStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatThread = {
  id: string;
  vehicleId: string | null;
  buyerId: string;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string | null; // null = system message
  content: string;
  createdAt: string;
};

// ── Faceted-listing query contracts (SRS §9.2 / API §19.1) ──────────────────
export type VehicleSort =
  | "recommended" | "price_asc" | "price_desc"
  | "year_desc" | "km_asc" | "newest";

export type VehicleFilters = {
  make?: string;
  model?: string;
  bodyType?: BodyType;
  fuelType?: FuelType;
  transmission?: TransmissionType;
  driveType?: DriveType;
  seats?: number;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  kmMax?: number;
  features?: string[];
  city?: string;
  q?: string;
  status?: "all" | "available" | "sold";
};

export type FacetCount = { value: string; label: string; count: number };

export type VehicleListingResult = {
  items: VehicleListItem[];
  total: number;
  page: number;
  perPage: number;
  facets: {
    make: FacetCount[];
    bodyType: FacetCount[];
    fuelType: FacetCount[];
    transmission: FacetCount[];
  };
};

export type FinanceParams = {
  annualRate: number;
  termMonths: number;
  depositPct: number;
  disclaimer: string;
};

// ── Invoicing (Phase 7) ──────────────────────────────────────────────────────
export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "void";

export type Invoice = {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  leadId: string | null;
  vehicleId: string | null;

  // Billing Snapshot
  billingName: string;
  billingEmail: string | null;
  billingPhone: string | null;
  billingAddress: string | null;
  billingAbn: string | null;

  // Config Snapshot
  gstEnabled: boolean;
  gstRate: number;
  pricesIncludeGst: boolean;

  // Amounts
  subtotalCents: number;
  lineDiscountsCents: number;
  invoiceDiscountCents: number;
  netExGstCents: number;
  gstCents: number;
  totalIncGstCents: number;
  paymentsCents: number;

  dueDate: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;

  notes: string | null;
  paymentTerms: string | null;
  footerNote: string | null;

  createdAt: string;
  updatedAt: string;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type InvoicePayment = {
  id: string;
  invoiceId: string;
  amountCents: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  recordedById: string | null;
  createdAt: string;
};

export type InvoiceEvent = {
  id: string;
  invoiceId: string;
  actorId: string | null;
  event: "created" | "updated" | "issued" | "payment_recorded" | "voided" | "emailed";
  data: Record<string, unknown>;
  createdAt: string;
};
