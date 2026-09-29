-- Optional per-product override for the photo used on its page in the catalog PDF.
-- When set, this replaces the product's regular gallery photos in that one column;
-- when null, the PDF falls back to the product's own images.
alter table public.products
  add column if not exists pdf_image_url text;
