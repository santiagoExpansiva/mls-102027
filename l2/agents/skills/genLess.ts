/// <mls fileReference="_102027_/l2/agents/skills/genLess.ts" enhancement="_blank"/>
export const skill = `

# SKILL: Component LESS File

You are responsible for creating the component's LESS file. From the layout JSON you extract all classes, infer their visual role from context, and generate a semantic, encapsulated LESS file using only the system tokens provided in this skill.

You receive:
- **layout JSON** → tagName, render blocks, class names, element types, hierarchy
- **tokens** → design system variables available for use

You never invent tokens. You never place styles outside the root tag. You never use element selectors — only class selectors.

---

## Your reasoning process (follow this order before writing any code)

### Step 1 — Extract all classes

Traverse the entire \`render.blocks\` tree recursively. For every node that has a \`"class"\` field, collect it. Split compound classes (e.g. \`"btn btn--secondary"\` → \`btn\` and \`btn--secondary\`). Deduplicate.

Also collect classes from \`conditions\` blocks (\`loading\`, \`error\`).

### Step 2 — Infer role from class name + element + context

For each class, infer its visual role by combining three signals:

**Signal 1 — Class name pattern:**
| Class name pattern | Inferred role |
|---|---|
| \`loading\` | state-container (centered, flex) |
| \`spinner\` | loading-indicator (animated circle) |
| \`loading__message\` | text (muted, next to spinner) |
| \`error\` | state-container (centered, danger color) |
| \`error__message\` | text (danger color) |
| \`*-page\` | page-root (block, padding) |
| \`*__cols\` | columns-container (grid, 2 cols) |
| \`*__col\` | column (flex, column direction) |
| \`*__info\` | info-block (flex, column, gap) |
| \`*__map\` | secondary-block (flex, centered) |
| \`*__channels\` | flex-row (horizontal, gap, wrap) |
| \`*__channel\` | channel-item (flex, align-center) |
| \`*__title\` | heading (font-size large, font-weight bold) |
| \`*__address\` | address-text (font-style normal, line-height) |
| \`*__hours\` | text (muted color, font-size small) |
| \`*__text\` / \`*__description\` | text (body, line-height) |
| \`*__price\` | highlight-text (prominent color, font-weight bold) |
| \`*__image\` | image (width 100%, object-fit cover) |
| \`*__body\` | card-body (flex, column, gap, padding) |
| \`*__actions\` | actions-row (flex, justify-end, gap) |
| \`*__full\` | full-width-row (width 100%) |
| \`btn\` | button-base (padding, border-radius, cursor, font) |
| \`btn--primary\` | button-variant (filled background) |
| \`btn--secondary\` | button-variant (outline or ghost) |
| \`btn--icon\` | button-icon (square, icon only) |
| \`field\` | field-wrapper (flex, column, gap, label) |
| \`field__input\` / \`field__select\` | input (width 100%, border, padding) |
| \`field__checkbox\` | checkbox (width auto, cursor pointer) |
| \`spinner\` | animated circle (border, border-radius 50%, @keyframes) |
| \`section\` element wrapping | section-root (display block, margin-bottom) |

**Signal 2 — Parent element in JSON:**
- Parent is \`section\` → the class is a section root (display block, padding)
- Parent is \`form\` → the class is a form container
- Parent is \`label\` → the class is a field wrapper
- Parent is \`button\` → skip, already handled by \`btn\` classes

**Signal 3 — Children in JSON:**
- Has children with \`*__col\` → it's a columns-container → \`display: grid\`
- Has children with \`*__channel\` → it's a channels row → \`display: flex; flex-wrap: wrap\`
- Has children with \`btn\` only → it's an actions row → \`display: flex; justify-content: flex-end\`
- Has \`"condition"\` field → it's a conditional wrapper → no special layout, just \`display: contents\` or nothing

### Step 3 — Infer nesting from JSON hierarchy

The JSON tree directly encodes the nesting. For each class:
- If its parent node has a class → nest this class inside the parent's class block
- If it has no classed parent (direct child of a block root) → top level inside the tag

Classes that appear in multiple different parents → declare at top level, not nested.

\`btn\`, \`btn--primary\`, \`btn--secondary\` are always top level — they appear in multiple contexts.

### Step 4 — Decide desktop layout per columns-container

When a class ends with \`__cols\` or contains \`cols\`:
- Default: \`display: grid; grid-template-columns: 1fr 1fr; gap: 24px;\`
- If context suggests info + action (one info block, one map/action block): \`grid-template-columns: 2fr 1fr\`
- If context suggests equal columns: \`grid-template-columns: 1fr 1fr\`
- If context suggests three cards: \`grid-template-columns: repeat(3, 1fr)\`

---

## Triple Slash (Mandatory — first line)

Built from \`project\` + \`outputPath\` with \`.ts\` replaced by \`.less\`:

Given \`"outputPath": "/l2/storeLocation/web/desktop/page.ts"\` and \`"project": 102027\`:

\`\`\`less
/// <mls fileReference="_102027_/l2/storeLocation/web/desktop/page.less" enhancement="_blank" />
\`\`\`

---

## Encapsulation

ALL styles must live inside the component tag from \`tagName\`.

\`\`\`less
petshop--web--desktop--store-location-102009 {
  display: block;
  font-family: @font-family-primary;

  // all styles here
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
}


\`\`\`

---

## Tokens — use only what is provided

Use a token when the desired value exists in the list. Use the direct value when no token matches. Never invent tokens.

\`\`\`less
// token exists → use it
font-family: @font-family-primary;
font-size:   @font-size-16;

// no token → use value directly
border-radius: 4px;
color: #e53935;
\`\`\`

Available tokens:
\`\`\`less
[TOKENS]
\`\`\`

---

## Nesting strategy

Use the JSON tree to determine nesting. Classes that belong to a single parent are nested:

\`\`\`less
petshop--web--desktop--store-location-102009 {

  .loading { ... .spinner { } .loading__message { } }
  .error   { ... .error__message { } }

  ...

  @keyframes spin { to { transform: rotate(360deg); } }
}


\`\`\`

---

## Full output example — store-location page

\`\`\`less
/// <mls fileReference="_102009_/l2/petshop/web/desktop/storeLocation.less" enhancement="_blank" />

petshop--web--desktop--store-location-102009 {
  display: block;
  font-family: @font-family-primary;

  ...
}


\`\`\`

---

## What you NEVER do

- Place any style outside the component tag 
- Use element selectors (\`div\`, \`button\`, \`h2\`, \`section\`) — only class selectors
- Invent tokens not in the provided list
- Generate styles for classes not found in the layout JSON
- Add resets or global styles
- Duplicate class declarations
- Nest \`btn\`, \`btn--primary\`, \`btn--secondary\` inside other classes — always top level
`


export const skillOld = `
# SKILL: Component LESS File

You are responsible for creating the component's LESS file.
From the JSON definition you generate a semantic, encapsulated LESS file
using only the system tokens provided in this skill.

You never invent tokens. You never place styles outside the root tag.
You never use tag selectors or element selectors — only the class names
declared in the JSON classes array.

---

- tagName     → root encapsulation tag and the component selector

---

## What you generate

### 1. Triple slash — always the first line

Every component file **must** start with the triple slash directive. It is indispensable for the system and must be the **first line** of the file.

\`\`\`less
/// <mls fileReference="_XXXXX_/l2/path/file.less" enhancement="_blank" />
\`\`\`

example 
{
  "project":102027,
  "outputPath": "/l2/petshop/layer/prod.ts",
}

\`\`\`less
/// <mls fileReference="_102027_/l2/petshop/layer/prod.less" enhancement="_blank" />
\`\`\`

---

### 2. Encapsulation within the component tag

All CSS must be inside the component tag defined in \`tagName\` in the JSON. Nothing outside it.

\`\`\`less
petshop-update-product {
    // all CSS goes here
}
\`\`\`

---

### 3. Tokens — use only the available ones

### 3.1 Main Rule

- **Use tokens** when the desired value exists in the provided token list.
- **Use the direct value** in the attribute when the value does not exist as a token.
- **Never invent tokens** that were not provided.

### 3.2 Available Tokens

\`\`\`less
[TOKENS]
\`\`\`

### 3.3 Correct Usage Examples

Token exists → use it:
\`\`\`less
font-family: @font-family-primary;
font-size: @font-size-16;
\`\`\`

Value has no token → use directly:
\`\`\`less
border-radius: 4px;
color: #e53935;
\`\`\`

---


## 4. Generating styles from the classes array

For each entry in classes, generate one LESS block using the
name as the class selector. Use role and context to decide
what CSS properties to apply.

Role → CSS pattern mapping:

state-container
  display: flex; align-items: center; justify-content: center;
  Use context to decide padding and any specific color.

loading-indicator
  Animated spinner — use border + border-radius + @keyframes animation.
  Never use a background image or external asset.

text
  font-size, font-family, color derived from context
  (loading message → muted; error message → danger color).

form-root
  display: flex; flex-direction: column; gap from tokens or direct value.

columns-container
  display: grid; grid-template-columns based on layout.columns value;
  gap from tokens or direct value.

column
  display: flex; flex-direction: column; gap from tokens or direct value.

full-width-row
  width: 100%; applies below the columns grid.

actions-row
  display: flex; justify-content: flex-end; gap from tokens or direct value.
  Context says "aligned to the right" → justify-content: flex-end.

field-wrapper
  display: flex; flex-direction: column; gap: 4px.
  label text styles: font-size, font-family.

text-input / select-input
  width: 100%; padding; border; border-radius; font-size; font-family; box-sizing: border-box.

checkbox-input
  width: auto; cursor: pointer.

button-base
  Shared button styles: padding, border-radius, cursor, font-size, font-family, border: none.
  Also include &:disabled { opacity: 0.6; cursor: not-allowed; }.

button-variant
  Only the variant-specific overrides (background-color, color, border).
  Context "primary" → filled background. Context "secondary" → transparent + border.

---

## Expected full structure

\`\`\`less
/// <mls fileReference="_102029_/petshop/updateProduct/PetshopUpdateProduct.less" enhancement="_blank" />

petshop-update-product {
    display: block;
    font-family: @font-family-primary;
    font-size: @font-size-16;

    .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 32px;
    }

    .error {
        color: #e53935;
        font-size: @font-size-14;
        padding: 8px 0;
    }

    form.update-product {
        display: flex;
        flex-direction: column;
        gap: 24px;

        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .full-width {
            grid-column: 1 / -1;
        }

        label {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: @font-size-14;
            font-family: @font-family-primary;
        }

        input,
        textarea,
        select {
            width: 100%;
            font-size: @font-size-16;
            font-family: @font-family-primary;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 8px 12px;
            box-sizing: border-box;
        }

        textarea {
            resize: vertical;
        }

        input[type="checkbox"] {
            width: auto;
            cursor: pointer;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding-top: 8px;

            button {
                font-size: @font-size-16;
                font-family: @font-family-primary;
                padding: 10px 24px;
                border-radius: 4px;
                cursor: pointer;
                border: none;

                &.primary {
                    background-color: #1976d2;
                    color: #fff;

                    &:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                }

                &.secondary {
                    background-color: transparent;
                    color: #1976d2;
                    border: 1px solid #1976d2;
                }
            }
        }
    }
}
\`\`\`

---

## What you NEVER do

- Place any style outside the component tag
- Use element selectors (input, form, button, label) — only class selectors
- Invent tokens not in the provided list
- Generate styles for classes not listed in the JSON classes array
- Add resets or global styles
- Duplicate class declarations
`