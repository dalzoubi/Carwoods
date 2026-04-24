/**
 * Regression test: formDataToApiBody sends empty state/zip strings when
 * cityStateZip cannot be parsed. The server-side validateUpdatePropertyAddress
 * (added in commit 8e72d09) now rejects empty address field strings, causing
 * every PATCH for a property with a non-standard cityStateZip format to return
 * HTTP 400 → "Unexpected error" in the UI.
 *
 * Root cause: parseCityStateZip falls back to { city: raw, state: '', zip: '' }
 * when the input has no comma. formDataToApiBody includes city/state/zip in
 * the body unconditionally (|| ''), so state='' and zip='' are sent as strings,
 * not omitted (not undefined). validateUpdatePropertyAddress treats any present
 * but empty address field as invalid.
 */

import { formDataToApiBody } from './propertiesApiClient.js';

describe('formDataToApiBody', () => {
  describe('parseCityStateZip fallback produces empty state/zip strings sent to API', () => {
    it('sends state="" and zip="" when cityStateZip has no comma', () => {
      // A city-state-zip value without a comma cannot be parsed by the regex.
      // parseCityStateZip falls back to { city: raw, state: '', zip: '' }.
      // formDataToApiBody must NOT send empty strings for state and zip because
      // validateUpdatePropertyAddress on the server rejects them with
      // missing_required_fields → HTTP 400 → "Unexpected error" in the UI.
      const body = formDataToApiBody({
        addressLine: '123 Main St',
        cityStateZip: 'Houston TX 77001',
        harId: '',
        monthlyRentLabel: '',
        photoUrl: '',
        harListingUrl: '',
        applyUrl: '',
        detailLines: [],
        showOnApplyPage: false,
        landlordUserId: '',
      });

      // BUG: these are '' (empty string), not undefined.
      // The server rejects '' for any present-but-empty address field.
      // They should be undefined (omitted from the body) when parsing fails.
      expect(body.state).not.toBe('');
      expect(body.zip).not.toBe('');
    });

    it('sends state="" and zip="" when cityStateZip is only a city name', () => {
      const body = formDataToApiBody({
        addressLine: '456 Oak Ave',
        cityStateZip: 'Dallas',
        harId: '',
        monthlyRentLabel: '',
        photoUrl: '',
        harListingUrl: '',
        applyUrl: '',
        detailLines: [],
        showOnApplyPage: false,
        landlordUserId: '',
      });

      // BUG: state and zip are '' (not undefined), causing server 400.
      expect(body.state).not.toBe('');
      expect(body.zip).not.toBe('');
    });
  });

  describe('happy-path: well-formed cityStateZip is parsed correctly', () => {
    it('parses "City, ST 12345" into structured address fields', () => {
      const body = formDataToApiBody({
        addressLine: '789 Elm Blvd',
        cityStateZip: 'Katy, TX 77449',
        harId: '',
        monthlyRentLabel: '',
        photoUrl: '',
        harListingUrl: '',
        applyUrl: '',
        detailLines: [],
        showOnApplyPage: false,
        landlordUserId: '',
      });

      expect(body.street).toBe('789 Elm Blvd');
      expect(body.city).toBe('Katy');
      expect(body.state).toBe('TX');
      expect(body.zip).toBe('77449');
    });
  });
});
