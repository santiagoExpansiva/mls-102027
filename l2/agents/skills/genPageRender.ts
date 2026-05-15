/// <mls fileReference="_102027_/l2/agents/skills/genPageRender.ts" enhancement="_blank"/>

export const skill = `
# SKILL: Lit WebComponent Render Generator

You generate the **WebComponent** TypeScript file — the pure visual layer of a Lit feature.
You extend a Shared base class and your only job is to generate the \`render()\` method.
All state, logic, enums, and methods live in the Shared. You never redeclare or invent any of them.

---

## THE GOLDEN RULE

**Every identifier you write must be read from one of the two inputs.**

| Input | What it provides |
|---|---|
| **Shared class** | State fields, enum names and values, public methods, i18n \`msg\` |
| **JSON layout** | Elements, bindings, conditions, events, i18n keys |

If a name is not found in either input → add a \`// DISCREPANCY: not found — skipped\` comment and omit it.
There are no standard values, typical fields, or common patterns. What you receive IS the contract.

---

## Step 0 — Build your lookup tables (do this before writing any code)

Parse the Shared class and build four tables. Reference only these tables when writing the render.

**Table A — States**: every \`@state()\` and \`@property()\` field → \`{ name, type }\`

**Table B — Enums**: for every enum imported in the Shared, read its declaration in the contract and list every value exactly as written. Do not add, remove, or rename values.

**Table C — Methods**: every \`public\` method name, exactly as declared.

**Table D — i18n keys**: if \`i18n\` is present in the JSON, every key listed in \`i18n.keys\`. Nothing else.

> These four tables are your only reference. Anything not in a table does not exist for this file.

---

## Step 1 — Triple Slash (first line, mandatory)

Derive from JSON fields \`project\` and \`outputPath\`:

\`\`\`
/// <mls fileReference="_{project}_{outputPath}" enhancement="_102020_/l2/enhancementAura" />
\`\`\`

---

## Step 2 — Custom element tag

Read the JSON \`tagName\` field and use it verbatim in \`@customElement\`.

---

## Step 3 — Imports

Always present:
\`\`\`ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
\`\`\`

Then every entry from the JSON \`imports\` array, in order.

Path rules:
- Prepend \`/\` if missing
- Replace \`.ts\` → \`.js\`, or append \`.js\` if no extension

Kind rules:
- \`"type"\` → \`import type { ... }\`
- \`"value"\` → \`import { ... }\`
- Never import \`@property\` or \`@state\`

**\`anyInterfaces\` placeholder**: When an entry has \`anyInterfaces\` as the import clause, replace it with the exact set of names your \`render()\` actually uses — nothing more, nothing less.

**\`messages\` (i18n)**: When i18n is present, add \`messages\` to the **same import statement** that already imports the Shared class. Never create a separate import for it.

Import order:
1. \`import { html } from 'lit'\`
2. \`import { customElement } from 'lit/decorators.js'\`
3. JSON \`imports\` entries in order

---

## Step 4 — i18n resolution (only when i18n is present in the JSON)

The i18n block (\`collab_i18n_start\` / \`collab_i18n_end\`) and the \`msg\` field are declared in the Shared. **Do not redeclare them here.**

Your only responsibility: place these two lines at the very top of \`render()\`:
\`\`\`ts
const lang = document.documentElement.lang || 'en';
this.msg = messages[lang] || messages['en'];
\`\`\`

When referencing i18n text in the template, use only keys from **Table D**. Never use a key not in that table.

---

## Step 5 — Class declaration

\`\`\`ts
@customElement('<tagName from JSON>')
export class <className from JSON Make sure the first letter is capitalized.> extends <extends from JSON> {
  render() { ... }
}
\`\`\`

Never declare \`@state()\`, \`@property()\`, or \`msg\` — all are inherited from the Shared.

---

## Step 6 — render() method

The only method you generate.

### 6a — i18n at the top
Only if i18n is present (Step 4). First two lines of \`render()\`:
\`\`\`ts
const lang = document.documentElement.lang || 'en';
this.msg = messages[lang] || messages['en'];
\`\`\`

### 6b — Conditional early returns
Only generate when \`render.conditions\` in the JSON has entries. If absent or empty: generate no early returns.

For each condition entry:
1. Find the referenced state in **Table A** — get its exact name and type
2. If the condition compares against an enum value, find that value in **Table B** — verify it is listed
3. If Table A or Table B does not contain the name: add \`// DISCREPANCY\` comment and skip this condition entirely
4. Generate the \`if\` block using only the confirmed names

### 6c — Default block
The final \`return html\\\`...\\\`\` from the JSON layout blocks.

---

## Event wiring

For each event declared in the JSON:

**\`type: "action"\`** — sets \`this.action\` to an enum value
- Verify the enum value exists in **Table B** before using it
- If \`prevent: true\` → call \`e.preventDefault()\` first, then assign
- The \`value\` field is an enum reference — emit it as-is, never as a string

**\`type: "set"\`** — assigns a value to a state field
- Verify the field name exists in **Table A** before using it
- \`cast: "string"\` → \`(e.target as HTMLInputElement).value\`
- \`cast: "number"\` → \`Number((e.target as HTMLInputElement).value)\`
- \`cast: "boolean"\` → \`(e.target as HTMLInputElement).checked\`
- \`cast: "toggle"\` → \`!this.<fieldName>\`

**\`type: "method"\`** — calls a public method from the Shared
- Find the exact method name in **Table C** — the JSON value may be a short alias
- If not found in Table C: add \`// DISCREPANCY\` comment and skip

---

## Bindings

| Element | Binding syntax |
|---|---|
| \`input\` text / email / number / url | \`.value=\${this.<field>}\` |
| \`input\` checkbox | \`?checked=\${this.<field>}\` |
| \`input\` password with toggle | \`type=\${this.<boolField> ? 'text' : 'password'}\` |
| \`select\` | \`.value=\${this.<field>}\` |
| \`span\`, \`div\`, \`p\`, or any display element | \`\${this.<field>}\` |
| \`disabled\` | \`?disabled=\${<boolean expression>}\` — only using fields from Table A and values from Table B |
| conditional element | \`\${<condition> ? html\\\`...\\\` : ''}\` — only using fields from Table A |

Every \`<field>\` placeholder must be replaced with the exact name from **Table A**.
Every enum value in any expression must exist in **Table B**.

---

## Label elements

When \`"element": "label"\` has both \`i18n\` and a child \`input\`:
render the i18n text as a text node **before** the input inside the label. Use only keys from Table D.

---

## Styling — Tailwind (always active)

Never generate \`static styles\` or inline styles.
Always use Tailwind utility classes on the \`class\` attribute.

- If the JSON provides a \`"class"\` field: use it as the base and complement with Tailwind as needed
- If no \`"class"\` field: apply Tailwind classes appropriate to the element's semantic role and layout position

Reference baselines by role:

| Role | Tailwind baseline |
|---|---|
| Page / root wrapper | \`flex flex-col min-h-screen\` |
| Form container | \`flex flex-col gap-4 w-full max-w-md mx-auto p-6\` |
| Card / panel | \`bg-white rounded-2xl shadow-md p-6\` |
| Section heading | \`text-2xl font-bold text-gray-800\` |
| Label / sub-heading | \`text-sm font-medium text-gray-700 mb-1\` |
| Text input | \`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500\` |
| Primary button | \`w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed\` |
| Secondary button | \`w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50\` |
| Link-style button | \`text-sm text-blue-600 hover:underline\` |
| Error text | \`text-sm text-red-600 mt-1\` |
| Loading spinner wrapper | \`flex flex-col items-center justify-center gap-3 py-12\` |
| Spinner | \`h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent\` |
| Checkbox wrapper | \`flex items-center gap-2\` |
| Checkbox input | \`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500\` |
| Divider | \`my-4 border-t border-gray-200\` |
| Helper text | \`text-xs text-gray-500 mt-1\` |

> Goal: a coherent, accessible UI — not a mechanical mapping.

---

## Forbidden

- Declare \`@state()\` or \`@property()\` — inherited from Shared
- Declare any method beyond \`render()\`
- Declare \`msg\` (any visibility) — inherited as \`protected\` from Shared
- Generate the \`collab_i18n_start\` / \`collab_i18n_end\` block — belongs to Shared
- Use an i18n key not confirmed in Table D
- Use a state or property name not confirmed in Table A
- Use an enum value not confirmed in Table B (reading the actual declaration, not assuming)
- Use a method name not confirmed in Table C
- Generate a condition or binding for a state that does not exist in the Shared
- Dispatch \`CustomEvent\`
- Call \`execBff\` or any backend method
- Generate \`static styles\` or inline styles
- Import \`@property\` or \`@state\` decorators
- Mix enums into \`import type\` statements

---
`;
