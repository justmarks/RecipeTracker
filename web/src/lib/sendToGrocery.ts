// "Send to Grocery" — hand a meal plan's generated grocery list off to
// the sibling Grocery app (https://github.com/justmarks/Grocery) via a
// deep link. Grocery's /import route decodes the payload, shows a
// review screen, and commits the items to the household list.
//
// The payload shape + base64url encoding MUST stay in lockstep with
// Grocery's shared/src/importPayload.ts (decodeMealPlanPayload). It is
// versioned: Grocery refuses a payload whose schemaVersion it doesn't
// recognize, so bump IMPORT_SCHEMA_VERSION on both sides together.

import type { GroceryItem } from "shared";

const IMPORT_SCHEMA_VERSION = 1 as const;

// Default to the .firebaseapp.com host — that domain is in Grocery's
// Firebase Auth authorized-domains list by default (the .web.app
// alias is not, which would break sign-in on the import landing).
const DEFAULT_GROCERY_URL = "https://marksgrocerylist.firebaseapp.com";

function groceryBaseUrl(): string {
  const configured = import.meta.env.VITE_GROCERY_APP_URL?.trim();
  return (configured || DEFAULT_GROCERY_URL).replace(/\/+$/, "");
}

/** Base64url-encode a UTF-8 string (browser-safe, no Buffer). */
function base64urlEncode(input: string): string {
  const utf8 = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of utf8) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export type SendToGroceryArgs = {
  mealPlanId: string;
  mealPlanName: string;
  items: GroceryItem[];
};

/** Build the Grocery import deep link for a meal plan's grocery list. */
export function buildGroceryImportUrl(args: SendToGroceryArgs): string {
  const payload = base64urlEncode(
    JSON.stringify({
      schemaVersion: IMPORT_SCHEMA_VERSION,
      mealPlanId: args.mealPlanId,
      mealPlanName: args.mealPlanName,
      items: args.items,
    }),
  );
  return `${groceryBaseUrl()}/import?source=mealplan&payload=${payload}`;
}

/** Open the Grocery import flow in a new tab. */
export function sendToGrocery(args: SendToGroceryArgs): void {
  const url = buildGroceryImportUrl(args);
  window.open(url, "_blank", "noopener,noreferrer");
}
