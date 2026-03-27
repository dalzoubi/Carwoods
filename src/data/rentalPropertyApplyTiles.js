/**
 * Properties shown as apply tiles on /apply (under “Submit your application”).
 *
 * Maintenance:
 * - Add or remove objects in this array; the UI maps over it automatically.
 * - `applyUrl`: Open the listing on HAR, click Apply / RentSpree, or view page source
 *   and search for `apply.link` to copy the current short URL (it can change).
 * - `photoUrl`, rent, beds/baths/sqft/lot/type: Keep in sync with the HAR listing
 *   (meta description and JSON-LD on the homedetail page are good references).
 * - `harListingUrl`: Full HAR homedetail URL (used for “View on HAR” and your records).
 */

export const RENTAL_APPLY_PROPERTIES = [
  {
    id: '6314-bonnie-chase',
    addressLine: '6314 Bonnie Chase Ln',
    cityStateZip: 'Katy, TX 77449',
    monthlyRentLabel: '$1,925/mo',
    photoUrl: 'https://mediahar.harstatic.com/752618828/lr/752618889.jpeg',
    harListingUrl:
      'https://www.har.com/homedetail/6314-bonnie-chase-ln-katy-tx-77449/8469293?lid=10644408&cid=dalzoubi',
    applyUrl: 'https://apply.link/Ba5-sy4',
    detailLines: [
      '3 Bedroom(s)',
      '2 Full Bath(s)',
      '1,852 Sqft',
      '5,750 Lot Sqft',
      'Rental - Single Family Detached',
    ],
  },
  {
    id: '18920-sunrise-ranch',
    addressLine: '18920 Sunrise Ranch Ct',
    cityStateZip: 'Houston, TX 77073',
    monthlyRentLabel: '$1,850/mo',
    photoUrl: 'https://mediahar.harstatic.com/737490532/lr/739102649.jpeg',
    harListingUrl:
      'https://www.har.com/homedetail/18920-sunrise-ranch-ct-houston-tx-77073/3770269?lid=10463663&cid=dalzoubi',
    applyUrl: 'https://apply.link/IUh3SsI',
    detailLines: [
      '4 Bedroom(s)',
      '2 Full & 1 Half Bath(s)',
      '1,977 Sqft',
      '2,898 Lot Sqft',
      'Rental - Single Family Detached',
    ],
  },
];
