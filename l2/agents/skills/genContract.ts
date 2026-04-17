/// <mls fileReference="_102027_/l2/agents/skills/genContract.ts" enhancement="_blank"/>
export const skill = `
# SKILL: Contract

You are responsible for creating the contract file for a page — the single source of truth for all TypeScript types used by that page's components.

You receive two JSON inputs:
- **pages JSON** → source of truth. Defines which fields, params, routines and events exist.
- **ontology JSON** → auxiliary only. Used to confirm field types and optional status. Never add fields from the ontology that are not referenced in the pages JSON.

You generate enums, interfaces, and typed functions. You contain no logic whatsoever. Types only.

---

## Triple Slash (Mandatory — first line)

Every file MUST start with the triple slash directive as its first line.

\`\`\`ts
/// <mls fileReference="_XXXXX_/l1/path/contract.ts" enhancement="_blank" />
\`\`\`

Built from \`project\` + \`outputPath\`:

Given \`{ "project": 102027, "outputPath": "/l1/storeLocation/contract.ts" }\`:

\`\`\`ts
/// <mls fileReference="_102027_/l1/storeLocation/contract.ts" enhancement="_blank" />
\`\`\`

---

## Generation order (always follow this sequence)

Generate sections in this exact order so later declarations can safely reference earlier ones:

1. enums
2. interfaces — entity interfaces first, then organism interfaces, then params interfaces, then event interfaces
3. functions (typed function types)
4. mocks — one per entity interface

Within each section, preserve the order entries appear in the spec.

---

## How to read the pages JSON

For each organism in \`pages[*].sections[*].organisms\`:

| pages JSON field | What to extract |
|---|---|
| \`dataShape.fields\` | Fields of the entity interface + organism interface |
| \`dataShape.params\` | Fields of the params interface |
| \`dataShape.sourceRoutine\` | Name of the typed function (\`namespace.methodName\`) |
| \`computedFields\` | Extra fields added only to the organism interface |
| \`emits\` | Event name + payload → event interfaces |

For each \`actionStates\` entry in \`pages[*].actionStates\`:

| pages JSON field | What to extract |
|---|---|
| \`stateKey\` | Enum name (derived from pageName + stateKey suffix) |
| \`values\` | Enum members |

---

## How to use the ontology JSON

For each field collected from the pages JSON, look it up in \`ontology.entities[EntityName].fields[fieldName]\` to get:

- \`type\` → TypeScript type (\`string\`, \`number\`, \`boolean\`, \`string[]\`)
- \`required: false\` → mark field as optional (\`?\`)

**Never add fields from the ontology that are not in the pages JSON.**
**Never use the ontology as the primary source — only as a type lookup.**

---

## 1. Enums — from actionStates

Generated from \`pages[*].actionStates\`. One enum per entry.

Derive the enum name from \`pageName\` + the suffix of \`stateKey\` (part after the last dot), both in PascalCase.

\`\`\`
pageName: "storeLocation"
stateKey: "ui.storeLocation.loading"
→ enum name: StoreLocationLoading
\`\`\`

Each value in \`values\` becomes an enum member: uppercase key, lowercase string value.

\`\`\`ts
// spec
"actionStates": [
  {
    "stateKey": "ui.storeLocation.loading",
    "values": ["idle", "loading", "error"]
  }
]

// generated
export enum StoreLocationLoading {
  IDLE    = 'idle',
  LOADING = 'loading',
  ERROR   = 'error',
}
\`\`\`

---

## 2. Interfaces

### 2a. Entity interfaces — one per entity referenced in the page

Collect all \`dataShape.fields\` from ALL organisms in the page that reference the same \`entity\`. Deduplicate fields with the same name. The result is the complete entity interface for this page.

Name: exactly the \`entity\` value from the pages JSON (e.g. \`StoreInfo\`).

\`\`\`ts
// pages JSON — two organisms both reference entity "StoreInfo"
// organism 1 fields: name, address, city, state, country, businessHours, mapLink
// organism 2 fields: phone, whatsapp, email
// → merged: all 10 fields

export interface StoreInfo {
  name:          string;
  address:       string;
  city?:         string;
  state?:        string;
  country:       string;
  businessHours: string;
  mapLink?:      string;
  phone?:        string;
  whatsapp?:     string;
  email?:        string;
}
\`\`\`

Alignment: align the \`:\` of all fields to the column of the longest field name + 1 space.

### 2b. Organism interfaces — one per organism, only when it differs from the entity

Generate an organism-specific interface when:
- The organism uses a **subset** of the entity fields (not all), OR
- The organism has \`computedFields\`

When both conditions are false (organism uses all entity fields and has no computed fields), skip the organism interface — the entity interface is sufficient.

Name: \`PascalCase(organismName)\` + \`Data\`

\`\`\`
organismName: "storeLocationAddressMap"
→ interface name: StoreLocationAddressMapData
\`\`\`

Fields: only the fields from \`dataShape.fields\` for that organism + all \`computedFields\`.

\`computedFields\` always have type \`string\` unless the field name implies a boolean (starts with \`has\`, \`is\`, \`can\`, \`should\`) → use \`boolean\`. Mark them with a \`// computedField\` comment.

\`\`\`ts
export interface StoreLocationAddressMapData {
  name:          string;
  address:       string;
  city?:         string;
  state?:        string;
  country:       string;
  businessHours: string;
  mapLink?:      string;
  fullAddress:   string;   // computedField
}

export interface StoreLocationContactSummaryData {
  phone?:      string;
  whatsapp?:   string;
  email?:      string;
  hasWhatsapp: boolean;    // computedField
}
\`\`\`

### 2c. Params interfaces — one per unique sourceRoutine in the page

Deduplicate: if two organisms share the same \`sourceRoutine\`, generate only one params interface.

Name: derive from the method part of \`sourceRoutine\` (part after the dot), converted to PascalCase, with \`Params\` suffix.

\`\`\`
sourceRoutine: "storeInfo.getStoreById"
→ interface name: GetStoreByIdParams
\`\`\`

Fields: from \`dataShape.params\` of that organism. Look up each param type from the ontology if available; otherwise use \`string\`.

\`\`\`ts
export interface GetStoreByIdParams {
  storeId: string;
}
\`\`\`

### 2d. Event interfaces — one per emitted event

For each entry in \`emits\`, generate one interface.

Name: \`PascalCase(event)\` + \`Event\`

Payload rules:
- Payload is a plain field name (e.g. \`"storeId"\`) → \`{ fieldName: string }\`
- Payload is an inline object string (e.g. \`"{channel:string,storeId:string}"\`) → parse and expand as typed fields

\`\`\`ts
export interface AddressMapLoadedEvent {
  storeId: string;
}

export interface ContactChannelClickedEvent {
  channel: string;
  storeId: string;
}
\`\`\`

---

## 3. Functions — typed function signatures

Generated from the unique \`sourceRoutine\` values collected across all organisms in the page.

Group by namespace (prefix before the dot in \`sourceRoutine\`).
One \`export type\` per namespace, named \`PascalCase(namespace)Functions\`.

Each method inside the type uses:
- params interface from section 2c
- return type = the entity interface (e.g. \`StoreInfo\`)

\`\`\`ts
// sourceRoutine: "storeInfo.getStoreById"
// → namespace: storeInfo → type name: StoreInfoFunctions
// → method: getStoreById

export type StoreInfoFunctions = {
  getStoreById: (params: GetStoreByIdParams, options?: any) => Promise<StoreInfo>;
};
\`\`\`

---
## 4. Mocks — one array per entity interface

Generate one exported mock array for each entity interface (section 2a only).
Do NOT generate mocks for organism interfaces, params interfaces, or event interfaces.
Naming rule
interface name: StoreInfo
→ mock name:    Mock_StoreInfo
Always prefix with Mock_ followed by the exact interface name.
Array rules

Minimum 3 items per array
Every item must be a complete, valid object satisfying the interface
Optional fields (?) must be included in at least 2 of the 3 items and omitted in at least 1 — this shows both cases
Values must be realistic and contextually appropriate — not "string" or "value1"
Each item must be meaningfully different from the others (different names, addresses, values)

Type annotation
Always annotate the array with the interface type:

\`\`\`ts
export const Mock_StoreInfo: StoreInfo[] = [ ... ];
\`\`\`

---

When multiple routines share the same namespace, group them in the same type:

\`\`\`ts
export type ProductFunctions = {
  listByCategory: (params: ListByCategoryParams, options?: any) => Promise<Product[]>;
  getById:        (params: GetProductByIdParams, options?: any) => Promise<Product>;
};
\`\`\`

Return type is always \`Promise<T>\`. When the routine returns a list (inferred from action name containing \`list\`), use \`Promise<T[]>\`.

---

## Full output example — store-location page

\`\`\`ts
/// <mls fileReference="_102027_/l1/storeLocation/contract.ts" enhancement="_blank" />

// ── enums ────────────────────────────────────────────────────────

export enum StoreLocationLoading {
  IDLE    = 'idle',
  LOADING = 'loading',
  ERROR   = 'error',
}

// ── entity interfaces ─────────────────────────────────────────────

export interface StoreInfo {
  name:          string;
  address:       string;
  city?:         string;
  state?:        string;
  country:       string;
  businessHours: string;
  mapLink?:      string;
  phone?:        string;
  whatsapp?:     string;
  email?:        string;
}

// ── organism interfaces ───────────────────────────────────────────

export interface StoreLocationAddressMapData {
  name:          string;
  address:       string;
  city?:         string;
  state?:        string;
  country:       string;
  businessHours: string;
  mapLink?:      string;
  fullAddress:   string;   // computedField
}

export interface StoreLocationContactSummaryData {
  phone?:      string;
  whatsapp?:   string;
  email?:      string;
  hasWhatsapp: boolean;    // computedField
}

// ── params interfaces ─────────────────────────────────────────────

export interface GetStoreByIdParams {
  storeId: string;
}

// ── event interfaces ──────────────────────────────────────────────

export interface AddressMapLoadedEvent {
  storeId: string;
}

export interface ContactChannelClickedEvent {
  channel: string;
  storeId: string;
}

// ── functions ─────────────────────────────────────────────────────

export type StoreInfoFunctions = {
  getStoreById: (params: GetStoreByIdParams, options?: any) => Promise<StoreInfo>;
};

// ── mocks ─────────────────────────────────────────────────────────

export const Mock_StoreInfo: StoreInfo[] = [...]
\`\`\`

---

## What you NEVER do

- Add fields from the ontology that are not referenced in the pages JSON
- Use the ontology as primary source — only as type lookup
- Generate logic, functions implementations, or classes
- Use \`| undefined\` instead of \`?\` for optional fields
- Infer fields or routines not present in the pages JSON
- Generate organism interfaces when the organism uses all entity fields and has no computedFields
- Duplicate params interfaces when two organisms share the same sourceRoutine
- Change the generation order (enums → entity interfaces → organism interfaces → params interfaces → event interfaces → functions)
`

export const skillOld = `
# SKILL: Contract

You are responsible for creating the contract file — the single source of
truth for all TypeScript types used by the feature.

You generate enums, type aliases, constants, and interfaces.
You contain no logic whatsoever. Types and values only.

---

## Triple Slash (Mandatory)

Every file MUST start with the triple slash directive as its first line.

\`\`\`ts
/// <mls fileReference="_XXXXX_/l1/path/file.ts" enhancement="_blank" />
\`\`\`

Built from project + outputPath:
Given { "project": 102027, "outputPath": "/l1/petshop/contract.ts" }:

\`\`\`ts
/// <mls fileReference="_102027_/l1/petshop/contract.ts" enhancement="_blank" />
\`\`\`

---

## Generation order (always follow this sequence)

Generate the sections in this exact order so that later declarations
can safely reference earlier ones:

  1. enums
  2. types
  3. constants
  4. interfaces

Within each section, preserve the order the entries appear in the JSON.

---

## 1. Enums — for each entry in \`enums\`

Generate an exported enum. Each entry has a values array of
{ key, value } pairs. Use the key as the enum member name and
the value as its string literal.

\`\`\`ts
// JSON
"enums": {
  "PetshopAction": {
    "values": [
      { "key": "SAVE",   "value": "save"   },
      { "key": "DELETE", "value": "delete" },
      { "key": "LOAD",   "value": "load"   }
    ]
  }
}

// Generated
export enum PetshopAction {
  SAVE   = 'save',
  DELETE = 'delete',
  LOAD   = 'load',
}
\`\`\`

---

## 2. Types — for each entry in \`types\`

Generate an exported type alias. The definition field is the
right-hand side of the type assignment, rendered verbatim.

\`\`\`ts
// JSON
"types": {
  "PetshopProductId": { "definition": "string" },
  "PetshopStatus":    { "definition": "PetshopAction.SAVE | PetshopAction.LOAD" }
}

// Generated
export type PetshopProductId = string;
export type PetshopStatus    = PetshopAction.SAVE | PetshopAction.LOAD;
\`\`\`

---

## 3. Constants — for each entry in \`constants\`

Generate an exported const with explicit type annotation.
The value field is rendered as-is — wrap strings in quotes,
numbers and booleans as literals.

\`\`\`ts
// JSON
"constants": {
  "PETSHOP_API_VERSION": { "type": "string",  "value": "v1"   },
  "PETSHOP_MAX_STOCK":   { "type": "number",  "value": 9999   },
  "PETSHOP_ACTIVE":      { "type": "boolean", "value": true   }
}

// Generated
export const PETSHOP_API_VERSION: string  = 'v1';
export const PETSHOP_MAX_STOCK:   number  = 9999;
export const PETSHOP_ACTIVE:      boolean = true;
\`\`\`

---

## 4. Interfaces — for each entry in \`interfaces\`

Generate an exported interface. Each field has name, type, and
optionally optional: true which adds the ? modifier.

When the JSON entry has extends, add it to the interface declaration.

\`\`\`ts
// JSON
"interfaces": {
  "PetshopBaseProduct": {
    "fields": [
      { "name": "id",    "type": "string" },
      { "name": "shopId","type": "string" }
    ]
  },
  "PetshopCatalogProduct": {
    "extends": "PetshopBaseProduct",
    "fields": [
      { "name": "name",        "type": "string"  },
      { "name": "price",       "type": "number"  },
      { "name": "imageUrl",    "type": "string",  "optional": true },
      { "name": "active",      "type": "boolean" },
      { "name": "tags",        "type": "string[]" },
      { "name": "categoryId",  "type": "string"  }
    ]
  }
}

// Generated
export interface PetshopBaseProduct {
  id:     string;
  shopId: string;
}

export interface PetshopCatalogProduct extends PetshopBaseProduct {
  name:       string;
  price:      number;
  imageUrl?:  string;
  active:     boolean;
  tags:       string[];
  categoryId: string;
}
\`\`\`

Field type rules:
- Primitives (string, number, boolean) → rendered as-is
- Arrays (string[], number[], InterfaceName[]) → rendered as-is
- References to other interfaces or enums → rendered as-is
- optional: true → append ? to the field name, no | undefined

Alignment: align the : of all fields in the same interface to the
column of the longest field name + 1 space. This keeps the file readable.

---

## Full output example

\`\`\`ts
/// <mls fileReference="_102027_/l1/petshop/contract.ts" enhancement="_blank" />

export interface PetshopBaseProduct {
  id:     string;
  shopId: string;
}

...

\`\`\`

---

## What you NEVER do

- Add any imports
- Add any logic, functions, or classes
- Use | undefined instead of ? for optional fields
- Generate a section that is absent from the JSON
  (no enums key → no enum block; no types key → no type block; etc.)
- Repeat declarations with the same name
- Change the generation order (enums → types → constants → interfaces)
`;