// Room-category hero images served from public/images.
//
// To add a category photo: drop the file in website/public/images and add a
// line here mapping the exact category name → its path. Categories without an
// entry fall back to the page's default image.
//
// These are optimized WebP (≈100–150 KB each, down from the 2–3 MB PNG
// originals) so the room grid loads fast. Re-run the WebP conversion if you
// replace a source photo.
const CATEGORY_IMAGES = {
  'Premium Plus': '/images/premium-plus.webp',
  'Premium': '/images/premium.webp',
  'Executive': '/images/executive.webp',
  'Super Deluxe': '/images/super-deluxe.webp',
  'Deluxe AC': '/images/deluxe-ac.webp',
  'Standard AC': '/images/standard-ac.webp',
  'Standard Non AC': '/images/standard-non-ac.webp',
  // Separate (pricier) category that intentionally shares the Standard Non AC photo.
  'Standard Non-AC': '/images/standard-non-ac.webp',
  'Economic Non AC': '/images/economic-non-ac.webp',
};

export const categoryImage = (type) => CATEGORY_IMAGES[(type || '').trim()] || null;

// Single source for every room-category image across the site. Categories
// without their own photo above return null — render a neutral placeholder
// rather than a generic default image.
export const roomImage = (type) => categoryImage(type);

export default CATEGORY_IMAGES;
