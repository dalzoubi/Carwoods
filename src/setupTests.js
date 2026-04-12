// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
// Initialize i18n for all tests
import './i18n';
import { clearPortalDataCache } from './lib/portalDataCache.js';

beforeEach(() => {
  clearPortalDataCache();
});
