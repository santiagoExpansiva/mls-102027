/// <mls fileReference="_102027_/l2/agents/skills/genPageShared.ts" enhancement="_blank"/>

export const skill = `
# SKILL: Shared Component

You are responsible for creating the Shared file — a base Lit component extended by the WebComponent. You are the orchestration layer: you control all reactive states, properties, and backend communication.

You receive two JSON inputs:
- **pages JSON** → source of truth. Read, understand and reason about the page to generate the correct states, actions and lifecycle.
- **contract file** → already generated. Use it to confirm interface names and function signatures. Do NOT look for enums in the contract — the action enum lives in the Shared file itself.

You never render UI. You never register a custom element.

---

## Your reasoning process (follow this order before writing any code)

### Step 1 — Understand the page purpose
Read \`pages[*].purpose\` and each \`organism[*].purpose\`. Understand what the page does, what data it loads, and what the user can interact with.

### Step 2 — Identify properties (@property)
Properties are values that come from OUTSIDE the component:
- \`dataShape.params\` whose \`source.from === "route"\` → \`@property()\`
- \`dataShape.params\` whose \`source.from === "input"\` → \`@property()\`

Everything else is internal state.

### Step 3 — Identify states (@state)
**Control states** — always generate:
- \`action: ActionEnum | null = null\` (reset: true)
- \`loading: boolean = false\`
- \`error: string | null = null\`

**Data states** — one per field referenced in \`dataShape.fields\` across all organisms:
- Prefix derived from \`stateKey\` (e.g. \`db.storeInfo\` → prefix \`storeInfo_\`)
- Each field → \`storeInfo_name\`, \`storeInfo_address\`, etc.

**Computed states** — one per \`computedField\`:
- Same prefix as the entity they derive from
- Type: \`string\` by default; \`boolean\` if name starts with \`has\`, \`is\`, \`can\`, \`should\`

**Temp states** — from \`pages[*].tempStates\` and \`organism[*].tempStates\`:
- Name: suffix of \`stateKey\` (after last dot), camelCase

### Step 4 — Design the action enum (declared IN this file, NOT in contract)

The action enum is declared directly in the Shared file as a local \`const enum\` or regular \`enum\`. It is NOT imported from the contract.

Create one action per \`sourceRoutine\` found across all organisms. Name each action by reading the routine name and inferring intent:

| Routine pattern | Action name |
|---|---|
| \`*.get*\` / \`*.find*\` / \`*.fetch*\` | \`LOAD_<ENTITY>\` |
| \`*.list*\` / \`*.search*\` | \`LOAD_<ENTITIES>\` (plural) |
| \`*.create*\` / \`*.add*\` | \`CREATE_<ENTITY>\` |
| \`*.update*\` / \`*.save*\` | \`SAVE_<ENTITY>\` |
| \`*.delete*\` / \`*.remove*\` | \`DELETE_<ENTITY>\` |

Add non-bff actions when the page logic requires them (navigation resets, UI interactions, etc.).
Deduplicate: if two organisms share the same \`sourceRoutine\`, one action only.

Declare the enum at the top of the file, before the class, exported:

\`\`\`ts
export enum StoreLocationAction {
  LOAD_STORE_INFO = 'load_store_info',
}
\`\`\`

Naming rule for the enum itself: \`PascalCase(pageName)\` + \`Action\`.

### Step 5 — Design each action method

**With bff (\`sourceRoutine\` exists):**
- \`trigger\`: the action enum value
- \`method\`: \`_\` + camelCase(actionName)
- bff call uses the \`execBff\` response shape (see section below)
- params built from \`dataShape.params\` mapped to \`this.propertyName\` or \`this.stateName\`

**Without bff:**
- \`bff: null\`
- only state resets / assignments

### Step 6 — Design computed field methods
One private method per \`computedField\`. Called inside \`onSuccess\` after distributing result fields.

### Step 7 — Design the lifecycle
\`connectedCallback\`: dispatch all LOAD_* actions that should run on mount.

### Step 8 — Design navigation methods
One public method per \`navigationField\` with \`navigationType: "external"\`.

### Step 9 — Design emit methods
One public method per \`emits\` entry.

---

## Triple Slash (Mandatory — first line)

Every file MUST start with the triple slash directive as its first line.

\`\`\`ts
/// <mls fileReference="_XXXXX_/l1/path/shared.ts" enhancement="_102027_/l2/enhancementLit" />
\`\`\`

Built from \`project\` + \`outputPath\`:

Given \`{ "project": 102027, "outputPath": "/l1/storeLocation/shared.ts" }\`:

\`\`\`ts
/// <mls fileReference="_102027_/l1/storeLocation/shared.ts" enhancement="_102027_/l2/enhancementLit" />
\`\`\`

---

## Imports

\`\`\`ts
import { CollabLitElement }      from '/_100554_/l2/collabLitElement.js';
import { property, state }       from 'lit/decorators.js';
import type { BffClientOptions } from '/_102029_/l2/bffClient.js';
import { execBff }               from '/_102029_/l2/bffClient.js';
\`\`\`

Contract imports — interfaces, mocks and types only (NO enums — the action enum is declared here):
Built from interfacePath

\`\`\`ts
import type {
  StoreInfo,
  GetStoreByIdParams,
  AddressMapLoadedEvent,
  ContactChannelClickedEvent,
} from '{interfacePath}';
import { Mock_StoreInfo } from '{interfacePath}';
\`\`\`

NEVER import an action enum from the contract. The enum is declared in this file.

---

## Action enum — declared in this file before the class

\`\`\`ts
export enum StoreLocationAction {
  LOAD_STORE_INFO = 'load_store_info',
}
\`\`\`

Export it so the WebComponent can import and use it for event wiring.

---

## execBff response shape — CRITICAL

\`execBff\` does NOT throw on server errors. It always resolves and returns:

\`\`\`ts
{
  data:  T | null,
  error: {message:string} | null,
  ok:    boolean,
}
\`\`\`

Therefore the action method structure is:

\`\`\`ts
private async _loadStoreInfo() {
  this.action  = null;    // ALWAYS first — prevents updated() loop
  this.loading = true;
  this.error   = null;

  try {
    /*
    // Remove comment to execute
    const result = await execBff<StoreInfo>(
      'storeInfo.getStoreById',
      { storeId: this.storeId } as GetStoreByIdParams,
    );
    if (result.error) {
      this.error   = result.error;
      this.loading = false;
      return;
    }
    const res = result.data;
    if (!res) {
      this.loading = false;
      return;
    }
    */

    const res: StoreInfo = Mock_StoreInfo[0];   // ← single object mock

    this.storeInfo_name          = res.name;
    this.storeInfo_address       = res.address;
    this.storeInfo_city          = res.city ?? '';
    this.storeInfo_state         = res.state ?? '';
    this.storeInfo_country       = res.country;
    this.storeInfo_businessHours = res.businessHours;
    this.storeInfo_mapLink       = res.mapLink ?? '';
    this.storeInfo_phone         = res.phone ?? '';
    this.storeInfo_whatsapp      = res.whatsapp ?? '';
    this.storeInfo_email         = res.email ?? '';
    this._computeFullAddress();
    this.loading = false;
    this.emitAddressMapLoaded();

  } catch (e) {
    this.loading = false;
    this.error   = (e as Error).message;
  }
}
\`\`\`

Array result example
\`\`\` ts
private async _loadFlavors() {
  this.action  = null;
  this.loading = true;
  this.error   = null;

  try {
    /*
    // Remove comment to execute
    const result = await execBff<PizzariaFlavor[]>(
      'pizzaria.listFlavors',
      { storeId: this.storeId } as ListFlavorsParams,
    );
    if (result.error) {
      this.error   = result.error;
      this.loading = false;
      return;
    }
    const res = result.data;
    if (!res) {
      this.loading = false;
      return;
    }
    */

    const res: PizzariaFlavor[] = Mock_PizzariaFlavor;  // ← full array mock

    this.flavors = res;
    this.loading = false;

  } catch (e) {
    this.loading = false;
    this.error   = (e as Error).message;
  }
}

\`\`\`

### execBff response rules

**Always follow this exact order inside try:**
1. \`this.action = null\` — first line, before the await
2. Set \`loading = true\` and \`error = null\` — before the await
3. \`await execBff(...)\` — the call
4. \`if (result.error)\` → set \`this.error\`, set \`this.loading = false\`, \`return\`
5. \`const res = result.data\` → guard with \`if (!res)\`
6. When \`res\` is an **array** — guard with \`if (!res || !res.length)\` only when an empty array is meaningfully different from null; otherwise assign directly
7. Distribute fields from \`res\` into individual states
8. Call computed methods
9. Set \`this.loading = false\`
10. Call emit methods
11. \`catch (e)\` → set \`loading = false\` and \`error = (e as Error).message\`

The mock line that replaces res must:

Use the exact same variable name res
Have the correct type annotation matching bff result type
Use Mock_EntityName[0] for single objects
Use Mock_EntityName for arrays (no index)

### Array result example

When \`sourceRoutine\` returns a list (e.g. \`listCategories\`):

\`\`\`ts
const result = await execBff<PizzariaFlavor[]>(
  'pizzaria.listFlavors',
  { storeId: this.storeId } as PizzariaListFlavorsParams,
);

if (result.error) {
  this.error   = result.error;
  this.loading = false;
  return;
}

const res = result.data;
if (!res) {
  this.loading = false;
  return;
}

// Array assigned directly — no field distribution needed
this.flavors = res;
this.loading = false;
\`\`\`

---

## Properties — @property()

\`\`\`ts
@property({ type: String })
storeId: string = '';
\`\`\`

Type mapping: \`string → String\`, \`number → Number\`, \`boolean → Boolean\`. Non-primitives omit type.

---

## States — @state()

CRITICAL: Never use an interface as a state type. Always expand to individual primitive fields.

Optional fields from the result use \`?? ''\` or \`?? false\` to avoid \`undefined\` in states.

Group with comment headers:

\`\`\`ts
// states — control
@state() action:  StoreLocationAction | null = null;
@state() loading: boolean = false;
@state() error:   string | null = null;

// states — StoreInfo
@state() storeInfo_name:          string = '';
@state() storeInfo_address:       string = '';
@state() storeInfo_city:          string = '';
@state() storeInfo_state:         string = '';
@state() storeInfo_country:       string = '';
@state() storeInfo_businessHours: string = '';
@state() storeInfo_mapLink:       string = '';
@state() storeInfo_phone:         string = '';
@state() storeInfo_whatsapp:      string = '';
@state() storeInfo_email:         string = '';
@state() storeInfo_fullAddress:   string = '';  // computed

// states — temp
@state() selectedContactChannel: string | null = null;
\`\`\`

---

## updated()

\`\`\`ts
updated(changed: Map<string, unknown>) {
  if (changed.has('action')) {
    if (this.action === StoreLocationAction.LOAD_STORE_INFO) this._loadStoreInfo();
  }
}
\`\`\`

---

## Computed field methods

\`\`\`ts
private _computeFullAddress() {
  this.storeInfo_fullAddress = [
    this.storeInfo_address,
    this.storeInfo_city,
    this.storeInfo_state,
    this.storeInfo_country,
  ].filter(Boolean).join(', ');
}
\`\`\`

---

## Navigation methods

\`\`\`ts
public openMap() {
  if (this.storeInfo_mapLink) window.open(this.storeInfo_mapLink, '_blank');
}

public contactWhatsapp() {
  if (this.storeInfo_whatsapp) {
    window.open(\`https://wa.me/\${this.storeInfo_whatsapp}\`, '_blank');
  }
}

public contactPhone() {
  if (this.storeInfo_phone) window.open(\`tel:\${this.storeInfo_phone}\`);
}

public contactEmail() {
  if (this.storeInfo_email) window.open(\`mailto:\${this.storeInfo_email}\`);
}
\`\`\`

Navigation target mapping:
- \`external:mapLink\` → \`window.open(this.storeInfo_mapLink, '_blank')\`
- \`external:whatsapp\` → \`window.open('https://wa.me/' + value, '_blank')\`
- \`external:tel\` → \`window.open('tel:' + value)\`
- \`external:mailto\` → \`window.open('mailto:' + value)\`

Always guard with \`if (this.stateName)\` before opening.

---

## Emit methods

\`\`\`ts
public emitAddressMapLoaded() {
  this.dispatchEvent(new CustomEvent('addressMapLoaded', {
    detail: { storeId: this.storeId } as AddressMapLoadedEvent,
    bubbles: true,
    composed: true,
  }));
}

public emitContactChannelClicked(channel: string) {
  this.dispatchEvent(new CustomEvent('contactChannelClicked', {
    detail: { channel, storeId: this.storeId } as ContactChannelClickedEvent,
    bubbles: true,
    composed: true,
  }));
}
\`\`\`

---

## Full output structure

\`\`\`ts
/// <mls fileReference="_102027_/l2/storeLocation/shared.ts" enhancement="_102027_/l2/enhancementLit" />

import { CollabLitElement }      from '/_100554_/l2/collabLitElement.js';
import { property, state }       from 'lit/decorators.js';
import type { BffClientOptions } from '/_102029_/l2/bffClient.js';
import { execBff }               from '/_102029_/l2/bffClient.js';
import { Mock_StoreInfo }        from '/_102027_/l1/storeLocation/contract.js';
import type {
  StoreInfo,
  GetStoreByIdParams,
  AddressMapLoadedEvent,
  ContactChannelClickedEvent,
} from '/_102027_/l1/storeLocation/contract.js';

export enum StoreLocationAction {
  LOAD_STORE_INFO = 'load_store_info',
}

export class StoreLocationShared extends CollabLitElement {

  @property({ type: String }) storeId: string = '';

  // states — control
  @state() action:  StoreLocationAction | null = null;
  @state() loading: boolean = false;
  @state() error:   string | null = null;

  // states — StoreInfo
  @state() storeInfo_name:          string = '';
  @state() storeInfo_address:       string = '';
  @state() storeInfo_city:          string = '';
  @state() storeInfo_state:         string = '';
  @state() storeInfo_country:       string = '';
  @state() storeInfo_businessHours: string = '';
  @state() storeInfo_mapLink:       string = '';
  @state() storeInfo_phone:         string = '';
  @state() storeInfo_whatsapp:      string = '';
  @state() storeInfo_email:         string = '';
  @state() storeInfo_fullAddress:   string = '';  // computed

  // states — temp
  @state() selectedContactChannel: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.action = StoreLocationAction.LOAD_STORE_INFO;
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('action')) {
      if (this.action === StoreLocationAction.LOAD_STORE_INFO) this._loadStoreInfo();
    }
  }

  private async _loadStoreInfo() {
    this.action  = null;
    this.loading = true;
    this.error   = null;
    try {
      /*
      // Remove comment to execute
      const result = await execBff<StoreInfo>(
        'storeInfo.getStoreById',
        { storeId: this.storeId } as GetStoreByIdParams,
      );
      if (result.error) {
        this.error   = result.error;
        this.loading = false;
        return;
      }
      const res = result.data;
      if (!res) {
        this.loading = false;
        return;
      }
      */

      const res: StoreInfo = Mock_StoreInfo[0];

      this.storeInfo_name          = res.name;
      this.storeInfo_address       = res.address;
      this.storeInfo_city          = res.city ?? '';
      this.storeInfo_state         = res.state ?? '';
      this.storeInfo_country       = res.country;
      this.storeInfo_businessHours = res.businessHours;
      this.storeInfo_mapLink       = res.mapLink ?? '';
      this.storeInfo_phone         = res.phone ?? '';
      this.storeInfo_whatsapp      = res.whatsapp ?? '';
      this.storeInfo_email         = res.email ?? '';
      this._computeFullAddress();
      this.loading = false;
      this.emitAddressMapLoaded();
    } catch (e) {
      this.loading = false;
      this.error   = (e as Error).message;
    }
  }

  private _computeFullAddress() {
    this.storeInfo_fullAddress = [
      this.storeInfo_address,
      this.storeInfo_city,
      this.storeInfo_state,
      this.storeInfo_country,
    ].filter(Boolean).join(', ');
  }

  public openMap() {
    if (this.storeInfo_mapLink) window.open(this.storeInfo_mapLink, '_blank');
  }

  public contactWhatsapp() {
    if (this.storeInfo_whatsapp) {
      window.open(\`https://wa.me/\${this.storeInfo_whatsapp}\`, '_blank');
    }
  }

  public contactPhone() {
    if (this.storeInfo_phone) window.open(\`tel:\${this.storeInfo_phone}\`);
  }

  public contactEmail() {
    if (this.storeInfo_email) window.open(\`mailto:\${this.storeInfo_email}\`);
  }

  public emitAddressMapLoaded() {
    this.dispatchEvent(new CustomEvent('addressMapLoaded', {
      detail: { storeId: this.storeId } as AddressMapLoadedEvent,
      bubbles: true,
      composed: true,
    }));
  }

  public emitContactChannelClicked(channel: string) {
    this.dispatchEvent(new CustomEvent('contactChannelClicked', {
      detail: { channel, storeId: this.storeId } as ContactChannelClickedEvent,
      bubbles: true,
      composed: true,
    }));
  }
}
\`\`\`

---

## What you NEVER do

- Implement \`render()\`
- Register the component as a custom element
- Declare interfaces — they always come from the contract
- Import an action enum from the contract — declare it in this file
- Use an interface type as a \`@state()\` type — always expand to individual fields
- Access \`result\` directly as the data — always check \`result.error\` first, then use \`result.data\`
- Skip the \`if (result.error)\` check after execBff
- Skip the \`if (!res)\` guard after extracting \`result.data\`
- Put \`this.action = null\` anywhere other than the first line of the method
- Generate \`updated()\` if no actions are defined
- Generate \`connectedCallback()\` if no actions dispatch on mount
- Use \`import type\` for the action enum — it is a value declared in this file, not imported
`;

export const skillOld = `
# SKILL: Shared Component

You are responsible for creating the Shared file — a base Lit component
extended by the WebComponent. You are the orchestration layer: you control
all reactive states, properties, and backend communication.

You never render UI. You never register a custom element.

---

## Your responsibility

From a definition JSON you generate a TypeScript file with a base Lit class that:

- Declares all @property() and @state() — one state per field, never an interface as a state
- Watches state changes via updated() and dispatches to private action methods
- Aggregates individual states back into interface objects when calling execBff
- Distributes bff results across individual states on success
- Imports all interfaces from the external file informed in the JSON
- Never implements render() or registers a custom element

---

## Triple Slash (Mandatory)

Every file MUST start with the triple slash directive as its first line.

\`\`\`ts
/// <mls fileReference="_XXXXX_/l2/path/file.ts" enhancement="_102027_/l2/enhancementLit" />
\`\`\`

Built from project + outputPath:
Given { "project": 102027, "outputPath": "/l2/petshop/product/shared.ts" }:

\`\`\`ts
/// <mls fileReference="_102027_/l2/petshop/product/shared.ts" enhancement="_102027_/l2/enhancementLit" />
\`\`\`

---

## Imports

Collect every non-primitive type used across properties, states, and
actions[*].bff.params / result — import them all at once from interfacesPath.
Never declare interfaces in this file.

\`\`\`ts
import { CollabLitElement }      from '/_100554_/l2/collabLitElement.js';
import { property, state }       from 'lit/decorators.js';
import type { BffClientOptions } from '/_102029_/l2/bffClient.js'; // mandatory
import { execBff }               from '/_102029_/l2/bffClient.js'; // mandatory
import type { PetshopAction, PetshopCatalogProduct, ... } from '<interfacesPath>';
\`\`\`

## Imports do contract — separar valores de tipos

Collect all names used from the contract and split them into two groups
before emitting the import statements:

Value imports (import without "type"):
  - Everything that comes from enums in the contract JSON
  - Everything that comes from constants in the contract JSON
  These exist as JavaScript values at runtime and MUST NOT use import type.

Type imports (import type):
  - Everything that comes from interfaces in the contract JSON
  - Everything that comes from types in the contract JSON
  These are erased at compile time and are safe to use import type.

Emit one import line per group, only if the group is non-empty.
Both lines point to the same interfacesPath.

\`\`\`ts
import      { PetshopAction }                       from '<interfacesPath>';
import type { PetshopProduct, PetshopGetProductParams } from '<interfacesPath>';
\`\`\`

NEVER mix enums or constants into an import type statement.
NEVER mix interfaces or types into a plain import statement.

---

## Properties — @property()

For each item in properties. Map primitive type to decorator option:
string → String, number → Number, boolean → Boolean. Non-primitives omit type.
Use reflect: true only when the JSON field reflect === true.

\`\`\`ts
@property({ type: String })
productId: string = '';
\`\`\`

---

## States — @state() — one per field, never an interface type

CRITICAL RULE: A state must NEVER have an interface as its type.
Interfaces are composite — they cannot be reactive as a unit.
Every field of every interface that the component needs must be
declared as its own individual @state().

Each state in the JSON has:
- name: the state field name (e.g. "product_name")
- type: the TypeScript primitive type (e.g. "string", "number", "boolean")
- default: the initial value
- reset: (optional) true = this state is reset to null inside its action method
- interfaceGroup: (optional) which interface this field belongs to
- field: (optional) the original field name inside that interface

States WITHOUT interfaceGroup are control states (action, loading, error, etc).
States WITH interfaceGroup are data fields that map to an interface.

Group states in the output by interfaceGroup, with a comment header for each group:

\`\`\`ts
// states — controle
@state() action:  PetshopAction | null = null;
@state() loading: boolean = false;

// states — PetshopCatalogProduct
@state() product_id:          string  = '';
@state() product_name:        string  = '';
@state() product_description: string  = '';
@state() product_price:       number  = 0;
@state() product_stock:       number  = 0;
@state() product_categoryId:  string  = '';
@state() product_imageUrl:    string  = '';
@state() product_active:      boolean = true;
\`\`\`

---

## Lifecycle — connectedCallback

Generate only when lifecycle.connectedCallback is present. Always call
super.connectedCallback() first. If dispatchAction is set, assign it to
the action state.

\`\`\`ts
connectedCallback() {
  super.connectedCallback();
  this.action = PetshopAction.LOAD;
}
\`\`\`

---

## updated() — reacting to state changes

Generate a single updated(changed: Map<string, unknown>).
For each unique trigger.state across all actions, emit one
if (changed.has('stateName')) block containing one if per action.

When trigger.value contains a dot → enum reference, render as-is.
When trigger.value is a plain string → wrap in quotes.

\`\`\`ts
updated(changed: Map<string, unknown>) {
  if (changed.has('action')) {
    if (this.action === PetshopAction.LOAD) this._load();
    if (this.action === PetshopAction.SAVE) this._save();
  }
}
\`\`\`

Only generate updated() when at least one action is defined.

---

## Action methods — private async, one per action

Each action generates one private async method. Follow this exact order:

Step 1 — Reset trigger state (when state.reset === true)
Set this.<triggerState> = null as the FIRST line, before any other code.
This prevents the updated() watcher from re-triggering the same action.

Step 2 — onStart assignments (before try/catch)
For each entry in bff.onStart, assign the state immediately after the reset.
Use this for flags like loading = true.

Step 3 — Build the params object (aggregation from states)

CRITICAL RULE: Never pass a state directly as params if it holds an interface type.
The params object must always be built by aggregating individual states.

To build the params object for a given bff.params interface:
- Look at all states that have interfaceGroup matching that interface name
- Use each state's field value as the object key
- Use this.stateName as the object value
- Also include any @property() fields whose name matches a field
  in the params interface (e.g. productId)
- Cast the result with as ParamsInterface

Example — building PetshopUpdateProductParams from states + properties:
\`\`\`ts
{
  productId:   this.productId,       // from @property()
  name:        this.product_name,    // from state, field: "name"
  description: this.product_description,
  price:       this.product_price,
  stock:       this.product_stock,
  categoryId:  this.product_categoryId,
  imageUrl:    this.product_imageUrl,
  active:      this.product_active,
} as PetshopUpdateProductParams
\`\`\`

Example — building PetshopGetProductParams (only needs productId):
\`\`\`ts
{ productId: this.productId } as PetshopGetProductParams
\`\`\`

To know which fields a params interface needs, cross-reference the
states array: fields with interfaceGroup === bff.params define the
data fields; properties whose name appears as a field in the interface
cover the identity fields (ids, slugs, etc).

Step 4 — onSuccess assignments (inside try, after await)

For each entry in bff.onSuccess:
- value === "result.fieldName" → this.stateName = result.fieldName
- value === "true"/"false"    → boolean literal
- value contains a dot and is not "result.*" → enum reference, as-is

Step 5 — onError assignments (inside catch)
Same rules as onSuccess. Always generate catch even if onError is empty.

Full example — _load():
\`\`\`ts
private async _load() {
  this.action  = null;           // Step 1: reset (reset: true)
  this.loading = true;           // Step 2: onStart
  try {
    const result = await execBff<PetshopCatalogProduct>(  // Step 3: params
      'petshop.getProduct',
      { productId: this.productId } as PetshopGetProductParams,
    );
    this.product_id          = result.id;           // Step 4: onSuccess
    this.product_name        = result.name;
    this.product_description = result.description;
    this.product_price       = result.price;
    this.product_stock       = result.stock;
    this.product_categoryId  = result.categoryId;
    this.product_imageUrl    = result.imageUrl;
    this.product_active      = result.active;
    this.loading = false;
  } catch (e) {
    this.loading = false;                           // Step 5: onError
  }
}
\`\`\`

Full example — _save() with aggregated params:
\`\`\`ts
private async _save() {
  this.action  = null;           // Step 1: reset
  this.loading = true;           // Step 2: onStart
  try {
    await execBff<PetshopCatalogProduct>(
      'petshop.updateProduct',
      {                          // Step 3: aggregated from states + properties
        productId:   this.productId,
        name:        this.product_name,
        description: this.product_description,
        price:       this.product_price,
        stock:       this.product_stock,
        categoryId:  this.product_categoryId,
        imageUrl:    this.product_imageUrl,
        active:      this.product_active,
      } as PetshopUpdateProductParams,
    );
    this.loading = false;        // Step 4: onSuccess
  } catch (e) {
    this.loading = false;        // Step 5: onError
  }
}
\`\`\`

---

## useMock — mock mode for action methods

Each action in the JSON may have an optional useMock boolean field.

useMock: false (or absent) → generate the method normally with execBff.

useMock: true → generate the method with the execBff call commented out
and a mock object in its place. The mock object must be built from the
states that have interfaceGroup matching bff.result, using realistic
placeholder values per type:
  - string  → short descriptive string related to the field name
  - number  → a realistic non-zero number (price → 89.90, stock → 10)
  - boolean → true
  - string (imageUrl / image / url) → 'https://placehold.co/400x400?text=Mock'
  - string (id / ...Id) → 'mock-001'

When bff.result ends with [] (array) → mock is an array with 2-3 items.
Each item follows the same placeholder rules above, with incremental ids
(mock-001, mock-002, mock-003) and varied names.

Structure when useMock: true

The commented execBff block comes FIRST, then the mock object.
The comment must say exactly: // Remove comment to execute

\`\`\`ts
private async _load() {
  this.action  = null;    // Step 1: reset
  this.loading = true;    // Step 2: onStart

  try {
    /*
    // Remove comment to execute
    const result = await execBff<PetshopProduct>(
      'petshop.getProduct',
      { productId: this.productId } as PetshopGetProductParams,
    );
    */

    const result: PetshopProduct = {   // mock object
      id:         'mock-001',
      name:       'Ração Golden Premium',
      price:      89.90,
      categoryId: 'cat-001',
      imageUrl:   'https://placehold.co/400x400?text=Mock',
      active:     true,
    };

    // Step 4: onSuccess — identical to non-mock
    this.product_id         = result.id;
    this.product_name       = result.name;
    this.product_price      = result.price;
    this.product_categoryId = result.categoryId;
    this.product_imageUrl   = result.imageUrl;
    this.product_active     = result.active;
    this.loading = false;
  } catch (e) {
    this.loading = false;   // Step 5: onError
  }
}
\`\`\`

Array result example — when bff.result === "PetshopCategory[]":
\`\`\`ts
    /*
    // Remove comment to execute
    const result = await execBff<PetshopCategory[]>(
      'petshop.listCategories',
      {} as PetshopListCategoriesParams,
    );
    */

    const result: PetshopCategory[] = [
      { id: 'mock-001', name: 'Rações' },
      { id: 'mock-002', name: 'Brinquedos' },
      { id: 'mock-003', name: 'Acessórios' },
    ];

    this.categories = result;
\`\`\`

Rules

- The onSuccess and onError assignments are IDENTICAL whether useMock is
  true or false — only the data source changes (execBff vs mock object).
- The mock type annotation uses the same type as bff.result:
  const result: PetshopProduct = {...}
- The commented block must be a valid, complete execBff call — so the
  developer can uncomment it and it works immediately without edits.
- When useMock is absent, treat it as false — generate normally.

## What you NEVER do

- Implement render()
- Register the component as a custom element
- Declare interfaces — they always come from interfacesPath
- Use an interface type as a @state() type — always expand to individual fields
- Pass a composite state as params — always aggregate from individual states
- Put the reset line anywhere other than the first line of the method
- Generate updated() if no actions are defined
- Generate connectedCallback() if lifecycle is absent from the JSON
- Add any logic not described in the JSON
- Use Mock_EntityName[0] for array results — use the full array
- Use Mock_EntityName (full array) for single object results — use [0]
`;