/// <mls fileReference="_102027_/l2/agents/skills/genPageShared.ts" enhancement="_blank"/>

export const skill = `
# Lit Base Component — Shared File Generator

You generate a **Shared** TypeScript file: a headless Lit 3 base class that holds all reactive state and communicates with the backend via \`execBff\`. It never renders, never registers a custom element, never declares any enum, and never dispatches events.

---

## SOURCES OF TRUTH — build before writing any code

Extract these maps from the two inputs first. Every identifier you write must trace back to one of them.

| Map | Source | What to collect |
|---|---|---|
| **M-Enums** | contract file | every exported enum + every declared value, read verbatim |
| **M-Interfaces** | contract file | every exported interface |
| **M-Mocks** | contract file | every exported mock variable |
| **M-Props** | pages JSON \`dataShape.params\` where \`source.from\` is \`"route"\` or \`"input"\` | field name, type |
| **M-States** | pages JSON (all state sources below) | field name, type, initial value |
| **M-i18n** | JSON \`i18n\` section | every key in \`i18n.keys\`, every language in \`i18n.languages\` |

**M-States** collects four sub-groups:
- **Control** — always present: \`action\`, \`loading\`, \`error\`
- **Data** — one per \`entityField\` in \`dataShape.entityFields\`
- **Computed** — one per \`computedField.fieldId\`
- **Temp** — from \`pages[*].tempStates\` and \`organism[*].tempStates\`
- **ActionState** — from \`pages[*].actionStates\` (enum-typed, e.g. a Loading state)

If a name is not in any map → do not use it. Flag as \`// DISCREPANCY: not found\`.

---

## GENERATION SEQUENCE — follow in order

---

### Step 1 — Triple Slash (first line, mandatory)

Derived from JSON \`project\` and \`outputPath\`:
\`\`\`
/// <mls fileReference="_{project}_{outputPath}" enhancement="_102020_/l2/enhancementAura" />
\`\`\`

---

### Step 2 — Imports

Fixed imports, always present:
\`\`\`ts
import { CollabLitElement } from '/_102029_/l2/collabLitElement.js';
import { property, state }  from 'lit/decorators.js';
import { execBff }          from '/_102029_/l2/bffClient.js';
import { bindExpectedNavigationLoad, consumeExpectedNavigationLoad } from '/_102029_/l2/interactionRuntime.js';
\`\`\`

From the contract (path = contract \`fileReference\` with \`.ts\` → \`.js\`):
- \`import type { <Name> }\` — for every interface from M-Interfaces used in bff calls
- \`import { <EnumName>, <MockName>, ... }\` — for every enum from M-Enums and every mock from M-Mocks used

---

### Step 3 — i18n block (always mandatory)

Every Shared file must have this block between the imports and the class. No exceptions. 

\`\`\`ts
/// **collab_i18n_start**
const message_en = {
  // one entry per key in M-i18n — use sensible English text
};
// repeat for each additional language in M-i18n.languages . In the available language keys, always use only 2 characters.
type MessageType = typeof message_en;
export const messages: { [key: string]: MessageType } = { en: message_en, /* other languages */ };
/// **collab_i18n_end**
\`\`\`

Rules:
- \`message_en\` is **always required** — it is the system fallback
- If the JSON has no \`i18n\` section, generate a minimal \`message_en\` with a \`loading\` key


---

### Step 4 — Class declaration
Make sure the first letter is capitalized in pageName.
\`\`\`ts
export class <pageName>Shared extends CollabLitElement {
  protected msg = messages['en'];
  // fields and methods follow
}
\`\`\`

- Class name = JSON \`pageName\` attribute + \`"Shared"\`
- \`protected msg\` — always present, never \`private\`
- Never register a custom element

---

### Step 5 — Fields inside the class

#### @property() fields
One per entry in M-Props:
\`\`\`ts
@property() <name>: <type> = <defaultValue>;
\`\`\`

#### @state() fields

**Control states — always present:**
\`\`\`ts
@state() action:  <union of every enum in M-Enums whose name ends in "Action"> | null = null;
@state() loading: boolean = false;
@state() error:   string | null = null;
\`\`\`

The \`action\` type is a union of **every** \`*Action\` enum from M-Enums. If M-Enums has 3 \`*Action\` enums, the union has 3 members.

**Data states** — one per entry in M-States.Data:
- Name: \`<entity>_<entityField>\` (both lowercased, joined by underscore)
- Type: primitive only — never use an interface

**Computed states** — one per entry in M-States.Computed:
- Type: \`boolean\` if fieldId starts with \`is\`, \`has\`, \`can\`, \`should\`; otherwise \`string\`
- Initial value: \`false\` or \`''\` accordingly

**Temp states** — one per entry in M-States.Temp:
- Name: last segment of \`stateKey\`, camelCase
- Initial value: from \`initialValue\` in the JSON

**ActionState fields** — one per entry in M-States.ActionState:
- Name: last segment of \`stateKey\`, camelCase
- Type: the enum named in the entry — read from M-Enums
- Initial value: the **first declared value** of that enum in M-Enums

---

### Step 6 — Lifecycle methods

#### connectedCallback — Always implement this.
\`\`\`ts
connectedCallback() {
  super.connectedCallback();
  const pendingLoad = consumeExpectedNavigationLoad();
  bindExpectedNavigationLoad(pendingLoad, Promise.resolve());
}
\`\`\`

#### firstUpdated — Do this for all functions that load states (mocks).
\`\`\`ts
override firstUpdated() {
  this._<initialLoadMethod>();  // one call per initial-load method
}
\`\`\`

#### updated — only when M-Enums has at least one \`*Action\` enum
\`\`\`ts
updated(changed: Map<string, unknown>) {
  if (changed.has('action')) {
    // <EnumName> — one comment header per enum group
    if (this.action === <EnumName.VALUE>) this._<handlerName>();
    // ... one if per value, no else if, no switch
  }
}
\`\`\`

Every value from every \`*Action\` enum in M-Enums must have exactly one \`if\` branch here.

---

### Step 7 — BFF action methods (one per EmitsAction value)

One \`private async\` method per value in the \`EmitsAction\` enum (from M-Enums).

Fixed internal order — never deviate:
\`\`\`ts
private async _<methodName>() {
  this.action  = null;   // ALWAYS first
  this.loading = true;
  this.error   = null;

  try {
    /*
    // Remove comment to execute
    const result = await execBff<<InterfaceName>>(
      '<bff.key>',
      { <param>: this.<stateField>, ... },
    );
    if (result.error) {
      this.error   = result.error.message;
      this.loading = false;
      return;
    }
    const res = result.data;
    if (!res) { this.loading = false; return; }
    */

    // Mock — single object:
    const res: <InterfaceName> = Mock_<Name>[0];
    // Mock — array:
    // const res: <InterfaceName>[] = Mock_<Name>;

    // distribute result fields into @state() fields from M-States
    this._compute<FieldName>();  // only if computed states exist

    // update ActionState field using its enum — only values that exist in M-Enums
    this.loading = false;

  } catch (e) {
    this.loading = false;
    this.error   = (e as Error).message;
  }
}
\`\`\`

Critical rules:
- \`this.action = null\` is the **first line, always**
- The \`execBff\` call is always inside a \`/* ... */\` comment block — the mock line runs
- When updating an ActionState field after success, use only enum values that exist in M-Enums
- Never reference enum values not declared in M-Enums

---

### Step 8 — Temp state methods (one per TempStateAction value)

One synchronous \`private\` method per value in the \`TempStateAction\` enum:
\`\`\`ts
private _<methodName>() {
  this.action = null;               // ALWAYS first
  this.<stateField> = !this.<stateField>;  // toggle
  // or: this.<stateField> = <resetValue>; // clear
}
\`\`\`

---

### Step 9 — Navigation methods (one per NavigationFieldsAction value)

One \`public\` method per value in the \`NavigationFieldsAction\` enum:
\`\`\`ts
public navigateTo<Target>() {
  this.action = null;  // ALWAYS first
  // router call or state change here
}
\`\`\`

No \`dispatchEvent\`. No \`CustomEvent\`.

---

### Step 10 — Computed field methods

One \`private\` method per entry in M-States.Computed. Called inside Step 7 methods after field distribution:
\`\`\`ts
private _compute<FieldName>() {
  this.<fieldName> = <boolean or string expression using only M-States fields>;
}
\`\`\`

---

## FORBIDDEN

- Implement \`render()\`
- Register a custom element (\`customElements.define\` or \`@customElement\`)
- Declare any enum — all enums come from the contract
- Build the \`action\` union from fewer \`*Action\` enums than M-Enums contains — always include all
- Leave any \`*Action\` enum value without a branch in \`updated()\`
- Call \`dispatchEvent\` anywhere — not in navigation, not in emits, nowhere
- Use an interface as \`@state()\` type — always expand to primitives
- Place \`this.action = null\` anywhere other than the first line of a handler method
- Generate \`updated()\` when no \`*Action\` enums exist
- Generate \`connectedCallback()\` when nothing dispatches on mount
- Generate \`firstUpdated()\` when no initial-load methods exist
- Invent \`@state()\` or \`@property()\` fields not traceable to the inputs
- Invent types, interfaces, or enums not in the contract
- Declare \`msg\` as \`private\` — must be \`protected\`
- Omit the i18n block — it is always mandatory
- Add i18n keys not in M-i18n
- Resolve \`document.documentElement.lang\` inside the Shared — that is the Render's responsibility
- Use enum values not declared in M-Enums (read each enum's actual declaration — do not assume values)

---
`;
