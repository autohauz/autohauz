-- ─────────────────────────────────────────────────────────────────────────────
-- 0010  Seed data (dev/QA baseline; safe to run on a fresh project)
-- Not the full AU catalogue — enough makes/models/features to exercise the UI.
-- Real inventory + full make/model catalogue is a data-entry/import task.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Settings defaults ───────────────────────────────────────────────────────
insert into public.settings (key, value) values
  ('company_profile', jsonb_build_object(
    'legal_name', 'Your Dealership Pty Ltd',
    'trading_name', 'Your Dealership',
    'abn', '',
    'email', 'info@jashire.com.au',
    'google_rating', 4.9,
    'google_review_count', 0
  )),
  ('phone_numbers', jsonb_build_object(
    'primary', '+61492962418',
    'whatsapp', '+61492962418'
  )),
  ('finance_params', jsonb_build_object(
    'annual_rate', 8.99,
    'term_months', 60,
    'deposit_pct', 10,
    'disclaimer', 'Indicative only, not an offer of finance. Weekly repayment estimates assume a fixed rate over the stated term with the stated deposit and exclude fees and charges. Talk to us for a personalised quote.'
  )),
  ('notification_recipients', jsonb_build_object('emails', jsonb_build_array())),
  ('blocked_dates', jsonb_build_object('dates', jsonb_build_array())),
  ('legal_text', jsonb_build_object(
    'contact_consent', 'We only use your details to contact you about this enquiry.'
  ))
on conflict (key) do nothing;

-- ── A starter branch/location ───────────────────────────────────────────────
insert into public.locations (name, slug, address, city, state, postcode, hours, is_active)
values (
  'Main Showroom', 'main-showroom', '14 Harvey Rd', 'Kings Park', 'NSW', '2148',
  jsonb_build_object(
    'mon', '9:00-18:00', 'tue', '9:00-18:00', 'wed', '9:00-18:00',
    'thu', '9:00-18:00', 'fri', '9:00-18:00', 'sat', '9:00-17:00', 'sun', 'closed'
  ),
  true
)
on conflict (slug) do nothing;

-- ── Features (managed vocabulary, grouped by category) ───────────────────────
insert into public.features (name, slug, category) values
  ('Air Conditioning', 'air-conditioning', 'comfort'),
  ('Climate Control', 'climate-control', 'comfort'),
  ('Leather Seats', 'leather-seats', 'comfort'),
  ('Heated Seats', 'heated-seats', 'comfort'),
  ('Keyless Entry', 'keyless-entry', 'comfort'),
  ('Cruise Control', 'cruise-control', 'comfort'),
  ('Reversing Camera', 'reversing-camera', 'safety'),
  ('Blind Spot Monitoring', 'blind-spot-monitoring', 'safety'),
  ('Lane Keep Assist', 'lane-keep-assist', 'safety'),
  ('Autonomous Emergency Braking', 'aeb', 'safety'),
  ('Parking Sensors', 'parking-sensors', 'safety'),
  ('Adaptive Cruise Control', 'adaptive-cruise-control', 'safety'),
  ('Apple CarPlay', 'apple-carplay', 'technology'),
  ('Android Auto', 'android-auto', 'technology'),
  ('Satellite Navigation', 'sat-nav', 'technology'),
  ('Bluetooth', 'bluetooth', 'technology'),
  ('Digital Dashboard', 'digital-dashboard', 'technology'),
  ('Alloy Wheels', 'alloy-wheels', 'exterior'),
  ('Sunroof', 'sunroof', 'exterior'),
  ('Tow Bar', 'tow-bar', 'exterior'),
  ('LED Headlights', 'led-headlights', 'exterior'),
  ('Roof Rails', 'roof-rails', 'exterior')
on conflict (slug) do nothing;

-- ── A handful of popular AU makes + models ──────────────────────────────────
insert into public.makes (name, slug, is_popular) values
  ('Toyota', 'toyota', true),
  ('Mazda', 'mazda', true),
  ('Hyundai', 'hyundai', true),
  ('Ford', 'ford', true),
  ('Kia', 'kia', true),
  ('Mitsubishi', 'mitsubishi', true),
  ('Volkswagen', 'volkswagen', false),
  ('Subaru', 'subaru', false)
on conflict (slug) do nothing;

insert into public.models (make_id, name, slug)
select m.id, x.name, x.slug from public.makes m
join (values
  ('toyota', 'Corolla', 'corolla'),
  ('toyota', 'RAV4', 'rav4'),
  ('toyota', 'HiLux', 'hilux'),
  ('toyota', 'Camry', 'camry'),
  ('mazda', 'CX-5', 'cx-5'),
  ('mazda', 'Mazda3', 'mazda3'),
  ('mazda', 'CX-3', 'cx-3'),
  ('hyundai', 'i30', 'i30'),
  ('hyundai', 'Tucson', 'tucson'),
  ('hyundai', 'Kona', 'kona'),
  ('ford', 'Ranger', 'ranger'),
  ('ford', 'Everest', 'everest'),
  ('kia', 'Sportage', 'sportage'),
  ('kia', 'Cerato', 'cerato'),
  ('mitsubishi', 'Triton', 'triton'),
  ('mitsubishi', 'Outlander', 'outlander'),
  ('volkswagen', 'Golf', 'golf'),
  ('subaru', 'Forester', 'forester')
) as x(make_slug, name, slug) on x.make_slug = m.slug
on conflict (make_id, slug) do nothing;

-- ── Starter FAQs ────────────────────────────────────────────────────────────
insert into public.faqs (category, question, answer, sort_order, is_published) values
  ('Buying', 'Are your cars inspected?', 'Yes — every vehicle passes a multi-point inspection before it is listed, and the condition is documented honestly, including any imperfections.', 1, true),
  ('Buying', 'Can I reserve a car?', 'Contact us and our team will let you know current availability and how to hold a vehicle while you arrange finance or an inspection.', 2, true),
  ('Finance', 'Do you offer finance?', 'We work with finance partners and can help you arrange a car loan. Submit a finance enquiry and a specialist will be in touch.', 1, true),
  ('Finance', 'Can I get finance with no deposit?', 'It depends on your circumstances and the lender. Send us a finance enquiry and we will talk you through the options.', 2, true),
  ('Selling', 'Can I sell you my car?', 'Yes. Use the Sell Your Car form with a few details and photos and we will get back to you with an offer.', 1, true),
  ('Warranty', 'Do the cars come with a warranty?', 'Warranty offerings vary by vehicle and are shown on each listing. Extended warranty options may also be available.', 1, true),
  ('Inspections', 'Can I book a test drive?', 'Absolutely — request an inspection on any vehicle page and we will confirm a time by phone or WhatsApp.', 1, true)
on conflict do nothing;

-- ── Blog categories ─────────────────────────────────────────────────────────
insert into public.blog_categories (name, slug) values
  ('Buying Guides', 'buying-guides'),
  ('Selling Tips', 'selling-tips'),
  ('Finance', 'finance'),
  ('News', 'news')
on conflict (slug) do nothing;
