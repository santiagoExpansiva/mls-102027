/// <mls fileReference="_102027_/l2/agents/skills/genPageRender.ts" enhancement="_blank"/>
export const skill = `
# SKILL: WebComponent

You are responsible for creating the WebComponent file — the visual layer
of the feature. You extend the Shared class and are responsible ONLY for:

  1. Rendering the layout via render()
  2. Reading inherited states to populate the DOM
  3. Wiring DOM events to set inherited states directly

You never declare methods. You never dispatch CustomEvents.
You never call the backend. All logic lives in the Shared.

---

## Triple Slash (Mandatory — first line)

Every file MUST start with the triple slash directive as its first line.

\`\`\`ts
/// <mls fileReference="_XXXXX_/l1/path/contract.ts" enhancement="_102027_/l2/enhancementLit" />
\`\`\`

Built from \`project\` + \`outputPath\`:

Given \`{ "project": 102027, "outputPath": "/l2/storeLocation/component.ts" }\`:

\`\`\`ts
/// <mls fileReference="_102027_/l2/storeLocation/component.ts" enhancement="_blank" />
\`\`\`

---

## Tag naming rule

Derive the @customElement tag from outputPath:
- Extract project number → goes at the end
- camelCase filename → kebab-case
- subfolders beyond l2 → separated by --

\`\`\`
outputPath: /l2/petshop/web/desktop/updateProduct.ts
tag:        petshop--web--desktop--update-product-102027
\`\`\`

---

## Imports

Always:
\`\`\`ts
import { html }        from 'lit';
import { customElement } from 'lit/decorators.js';
\`\`\`


Rule: only import names actually used in the render() template.
Never import @property or @state decorators — they live in the Shared.

## Imports externos (from JSON "imports" array)

When the JSON contains an imports array, generate one import statement
per entry in the exact order they appear.

Each entry has three fields:
- type:   "type" → generates import type { ... }
          "value" → generates import { ... }
- import: the exact import clause to use, already formatted (e.g. "{PetshopAction}")
- path:   the source path

Path formatting rules (applied to every entry):
- Prepend / if missing
- Replace .ts with .js, or append .js if no extension present
- Never duplicate the leading /

\`\`\`
"_102027_/l1/petshop/contract.js"  →  '/_102027_/l1/petshop/contract.js'
"/_102027_/l1/petshop/contract.js" →  '/_102027_/l1/petshop/contract.js'
"_102027_/l1/petshop/contract.ts"  →  '/_102027_/l1/petshop/contract.js'
"_102027_/l1/petshop/contract"     →  '/_102027_/l1/petshop/contract.js'
\`\`\`

Examples:

\`\`\`json
"imports": [
  { "type": "value", "import": "{ PetshopAction }",                        "path": "_102027_/l1/petshop/contract.js" },
  { "type": "type",  "import": "{ PetshopProduct, PetshopCategory }",      "path": "_102027_/l1/petshop/contract.js" },
  { "type": "value", "import": "{ PetshopUpdateProductShared }",           "path": "_102027_/l2/petshop/web/shared/updateProduct.js" }
]
\`\`\`

\`\`\`ts
// Generated — one line per entry, preserving order
import       { PetshopAction }                   from '/_102027_/l1/petshop/contract.js';
import type  { PetshopProduct, PetshopCategory } from '/_102027_/l1/petshop/contract.js';
import       { PetshopUpdateProductShared }      from '/_102027_/l2/petshop/web/shared/updateProduct.js';
\`\`\`

Import order in the final file:

  1. import { html } from 'lit'
  2. import { customElement } from 'lit/decorators.js'
  3. Entries from imports array — exactly as declared, in order

Never infer what to import. Never add imports beyond what is declared
in the imports array plus the two mandatory lit imports above.

---

## I18n

When i18n is present in the JSON, generate the i18n block between
imports and @customElement. Use the mandatory markers.
Generate one key per entry in i18n.keys

\`\`\`ts
/// **collab_i18n_start**
const message_en: Record<string, string> = {
  name: 'Name'
};
const message_pt: Record<string, string> = {
  name: 'Nome'
};
type MessageType = typeof message_en;
const messages: { [key: string]: MessageType } = { en: message_en, pt: message_pt };
/// **collab_i18n_end**
\`\`\`

Inside the class, declare the msg field and resolve it at the top of render():
\`\`\`ts
private msg = messages['en'];

render() {
  const lang = document.documentElement.lang || 'en';
  this.msg = messages[lang] || messages['en'];
  ...
}
\`\`\`

Use \${this.msg.key} for every element that has "i18n" in the JSON.

> Generate one entry per key listed in \`i18n.keys\`. Generate all languages listed in \`i18n.languages\`.

---

## Class declaration

Extend the Shared. Register the custom element.
Never redeclare @state() or @property() — inherited from Shared.

\`\`\`ts
@customElement('petshop--web--desktop--update-product-102027')
export class PetshopUpdateProduct extends PetshopUpdateProductShared {
  private msg = messages['en'];

  render() { ... }
}
\`\`\`

---

## render() — the only method you generate

Return html\`\`. No other methods are generated.

Step 1 — resolve i18n at the top
\`\`\`ts
render() {
  const lang = document.documentElement.lang || 'en';
  this.msg = messages[lang] || messages['en'];
  ...
}
\`\`\`

Step 2 — conditional early returns (from render.conditions)

Evaluate conditions in the order they appear in the JSON.
Each condition is an early return of its named block.

\`\`\`ts
if (this.loading) return html\`<div class="loading">
  <span class="spinner"></span>
  <span class="loading__message">\${this.msg.loading}</span>
</div>\`;

if (this.error) return html\`<div class="error">
  <span class="error__message">\${this.error}</span>
  <button class="btn btn--secondary" type="button"
    @click=\${() => { this.action = PetshopAction.LOAD; }}>
    \${this.msg.retry}
  </button>
</div>\`;
\`\`\`

Step 3 — default block

Return the default layout block as the final return statement.

---

## Event wiring rules

There are exactly two event types. Use "type" in the JSON to tell them apart.

type "action" — sets a control state to trigger Shared's updated()

\`\`\`ts
// event: { "on": "submit", "type": "action", "state": "action", "value": "PetshopAction.SAVE", "prevent": true }
@submit=\${(e: Event) => { e.preventDefault(); this.action = PetshopAction.SAVE; }}

// event: { "on": "click", "type": "action", "state": "action", "value": "PetshopAction.CANCEL" }
@click=\${() => { this.action = PetshopAction.CANCEL; }}
\`\`\`

Rule: when prevent === true, always call e.preventDefault() FIRST.
Rule: the value field is always an enum reference — render it as-is (no quotes).

type "set" — assigns a value directly to a data state

\`\`\`ts
// cast: "string"
@input=\${(e: Event) => { this.product_name = (e.target as HTMLInputElement).value; }}

// cast: "number"
@input=\${(e: Event) => { this.product_price = Number((e.target as HTMLInputElement).value); }}

// cast: "boolean" — always use .checked, never .value
@change=\${(e: Event) => { this.product_active = (e.target as HTMLInputElement).checked; }}
\`\`\`

---

## Binding rules

How to bind a state to an element depends on the element type:

\`\`\`ts
// input text / number / url → .value (property binding)
<input type="text" class="field__input" .value=\${this.product_name} />

// checkbox → ?checked (boolean attribute binding)
<input type="checkbox" class="field__checkbox" ?checked=\${this.product_active} />

// select → .value (property binding)
<select class="field__select" .value=\${this.product_categoryId}>...</select>

// any other element → text interpolation
<span class="error__message">\${this.error}</span>

// disabled → ?disabled (boolean attribute binding)
<button ?disabled=\${this.loading}>...</button>
\`\`\`

---

## Select with dynamic options

When input.type === "select" and input.options is present:

\`\`\`ts
<select class="field__select" .value=\${this.product_categoryId}
  @change=\${(e: Event) => { this.product_categoryId = (e.target as HTMLSelectElement).value; }}>
  \${this.categories?.map(opt => html\`
    <option value=\${opt.id} ?selected=\${opt.id === this.product_categoryId}>
      \${opt.name}
    </option>
  \`)}
</select>
\`\`\`

options.source → the state holding the array (e.g. this.categories)
options.value  → the field used as option value (e.g. opt.id)
options.label  → the field used as option text (e.g. opt.name)

---

## Label elements

When "element": "label" has both i18n and input, render the i18n text
as a text node before the input child:

\`\`\`ts
<label class="field">
  \${this.msg.name}
  <input type="text" class="field__input" .value=\${this.product_name}
    @input=\${(e: Event) => { this.product_name = (e.target as HTMLInputElement).value; }} />
</label>
\`\`\`

---

## Styling — classes only

When styling === "classes-only":
- Apply every "class" value from the JSON to the corresponding element
- Never generate a static styles block
- Never write inline styles
- The CSS is handled by a separate agent

---

## Full output example

\`\`\`ts
/// <mls fileReference="_102027_/l2/petshop/web/desktop/updateProduct.ts" enhancement="_102027_/l2/enhancementLit" />

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { PetshopUpdateProductShared } from '/_102027_/l2/petshop/web/shared/updateProduct.js';
import type { PetshopCatalogProduct, PetshopCategory } from '/_102027_/l2/petshop/web/shared/updateProduct.js';

/// **collab_i18n_start**
const message_pt = { ... }
const message_en = { ... }
type MessageType = typeof message_en;
const messages: { [key: string]: MessageType } = { 'en': message_en, 'pt': message_pt }
/// **collab_i18n_end**

@customElement('petshop--web--desktop--update-product-102027')
export class PetshopUpdateProduct extends PetshopUpdateProductShared {

    private msg = messages['en'];


    render() {
        const lang = this.getMessageKey(messages);
        this.msg = messages[lang];
        // render logic from Definition
    }
}
\`\`\`

---

## What you NEVER do

- Declare @state() or @property() — inherited from Shared
- Declare methods beyond render()
- Dispatch CustomEvents — Shared's responsibility
- Call execBff or any backend method directly
- Generate static styles or inline styles
- Import @property or @state decorators
- Add i18n keys not declared in i18n.keys
- Mix enums into import type statements
`;