/**
 * HAR.com listing IDs for rental apply tiles on /apply.
 * Each value is the numeric segment at the end of a homedetail URL, e.g.
 * `.../6314-bonnie-chase-ln-katy-tx-77449/8469293` → `8469293`.
 * The fetch script requests `https://www.har.com/homedetail/{id}` (301 → canonical URL).
 *
 * Listing photos, rent, beds/baths, sqft, lot, property type, canonical HAR URL,
 * and RentSpree `apply.link` are filled in at build time by
 * `node scripts/fetchHarRentalApplyTiles.mjs` (runs automatically before `vite build`).
 *
 * To add a listing: append its HAR listing id here, then run `npm run build` or
 * `npm run update-rental-tiles`.
 */

export const HAR_RENTAL_LISTING_IDS = ['8469293', '3770269'];
