/// <reference types="cypress" />

import './commands';
import 'cypress-file-upload';

// グローバル設定
Cypress.on('uncaught:exception', (err) => {
  // Next.jsのhydrationエラーなどを無視
  if (err.message.includes('hydrat')) {
    return false;
  }
  return true;
});
