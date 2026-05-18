/// <mls fileReference="_102027_/l2/agents/skills/genContract.ts" enhancement="_blank"/>

export const skill = `
#SKILL: Contract Generator
You generate a single TypeScript .contract.ts file from a pages JSON.
You are a mechanical transformer. You do not add, infer, or complete anything beyond what is explicitly written in the JSON.

##Your only job
Read the JSON. Extract specific values. Place them into specific templates. Stop.
You do NOT:

Add fields not listed in the JSON
Rename anything
Add convenience types, helper types, or utility types
Add comments explaining the domain
Complete "obvious" missing fields
Guess what a field "should" be

---

## Triple Slash (Mandatory)

Every file MUST start with the triple slash directive as its first line.

\`\`\`ts
/// <mls fileReference="_XXXXX_/l1/path/file.ts" enhancement="_blank" />
\`\`\`

Built from project + outputPath:
Given { "project": 102027, "outputPath": "/l1/petshop/layer_2_contract/product.ts" }:

\`\`\`ts
/// <mls fileReference="_102027_/l1/petshop/layer_2_contract/product.ts" enhancement="_blank" />
\`\`\`

---

##How to read the JSON
The JSON has this shape (simplified):
pages[]
  screenId, pageName, actor, purpose
  sections[]
    organisms[]
      dataShape.entityFields[]   → used in STEP 1
      tempStates[]               → used in STEP 2
      navigationFields[]         → used in STEP 3
      emits[]                    → used in STEP 4
  actionStates[]                 → used in STEP 5
Process each page independently. For each page, follow STEPS 1–6 in order.

##STEP 1 — Entity Interfaces
Read from: pages[i].sections[j].organisms[k].dataShape.entityFields[]
Algorithm:
collect = []
for each section in page.sections:
  for each organism in section.organisms:
    if organism.dataShape exists:
      for each field in organism.dataShape.entityFields:
        collect.push(field)

groups = group collect[] by field.entity

sanitizeKey(name): replace every "." in the name with "_"
Apply sanitizeKey to every field name before using it as a key or passing it to inferType.

for each group (entityName, fields[]):
  emit:
    export interface {entityName} {
      for each field in fields:
        key = sanitizeKey(field.entityField)
        if field.priority == "required":
          {key} : {inferType(key)};
        else:
          {key}?: {inferType(key)};
    }
inferType(name) — match the FIRST rule that applies:
RuleTypename ends with Id or Codestringname ends with Price, Amount, Total, Count, or Qtynumbername ends with Date, At, or Onstringname starts with is or has, OR ends with Flag, Active, or Enabledbooleanname ends with List, Items, or Arrayunknown[](no rule matched)string
Formatting: align all : to the same column within each interface block.
Example input:
json"entityFields": [
  { "entity": "client", "entityField": "name",    "priority": "required" },
  { "entity": "client", "entityField": "city", "priority": "required" },
  { "entity": "client", "entityField": "age",    "priority": "optional" }
]
Example output:
typescriptexport interface client {
  name   : string;
  city: string;
  age?  : string;
}

##STEP 2 — TempStateAction Enum
**Key sanitization**: any interface or type field name that contains "." must have every "." replaced with "_" before being written — "." is not a valid TypeScript identifier character
Read from: pages[i].sections[j].organisms[k].tempStates[]
Algorithm:
collect = []
for each section in page.sections:
  for each organism in section.organisms:
    if organism.tempStates exists:
      for each ts in organism.tempStates:
        collect.push(ts.stateKey)

if collect is empty: skip this step entirely, write nothing

emit:
  export enum TempStateAction {
    for each stateKey in collect:
      word = stateKey.split('.').last()   ← last segment after final dot
                                            (if no dot, use the full stateKey)
      memberName = toScreamingSnakeCase(word)
      value      = word                  ← same word, original casing
      emit: {memberName} = '{value}',
  }
toScreamingSnakeCase: insert _ before each uppercase letter, then uppercase everything.
Examples: showPassword → SHOW_PASSWORD, rememberMe → REMEMBER_ME, errorMessage → ERROR_MESSAGE
Example input:
json"tempStates": [
  { "stateKey": "ui.client.showPassword" },
  { "stateKey": "ui.client.rememberMe"   }
]
Example output:
typescriptexport enum TempStateAction {
  SHOW_PASSWORD = 'showPassword',
  REMEMBER_ME   = 'rememberMe',
}

##STEP 3 — NavigationFieldsAction Enum
**Key sanitization**: any interface or type field name that contains "." must have every "." replaced with "_" before being written — "." is not a valid TypeScript identifier character
Read from: pages[i].sections[j].organisms[k].navigationFields[]
Algorithm:
collect = []
for each section in page.sections:
  for each organism in section.organisms:
    if organism.navigationFields exists:
      for each nf in organism.navigationFields:
        collect.push(nf.fieldId)

if collect is empty: skip this step entirely, write nothing

emit:
  export enum NavigationFieldsAction {
    for each fieldId in collect:
      memberName = toScreamingSnakeCase(fieldId)
      value      = fieldId                       ← unchanged original string
      emit: {memberName} = '{value}',
  }
Example input:
json"navigationFields": [
  { "fieldId": "toForgotName" },
  { "fieldId": "toEnter"       }
]
Example output:
typescriptexport enum NavigationFieldsAction {
  TO_FORGOT_NAME = 'toForgotName',
  TO_ENTER        = 'toEnter',
}

##STEP 4 — EmitsAction Enum
**Key sanitization**: any interface or type field name that contains "." must have every "." replaced with "_" before being written — "." is not a valid TypeScript identifier character
Read from: pages[i].sections[j].organisms[k].emits[]
Algorithm:
collect = []
for each section in page.sections:
  for each organism in section.organisms:
    if organism.emits exists:
      for each emit in organism.emits:
        collect.push(emit.event)

if collect is empty: skip this step entirely, write nothing

emit:
  export enum EmitsAction {
    for each event in collect:
      memberName = toScreamingSnakeCase(event)
      value      = event                    ← unchanged original string
      emit: {memberName} = '{value}',
  }
Example input:
json"emits": [
  { "event": "submitLogin" }
]
Example output:
typescriptexport enum EmitsAction {
  SUBMIT_LOGIN = 'submitLogin',
}

##STEP 5 — ActionState Enums
Read from: pages[i].actionStates[]
Algorithm:
for each actionState in page.actionStates:
  word     = actionState.stateKey.split('.').last()
                ← last segment after final dot
                  (if no dot, use the full stateKey)
  enumName = toPascalCase(word)

  emit:
    export enum {enumName} {
      for each v in actionState.values:
        memberName = toScreamingSnakeCase(v)
        value      = v                  ← unchanged original string
        emit: {memberName} = '{value}',
    }
toPascalCase: capitalize first letter, keep rest as-is.
**Key sanitization**: any interface or type field name that contains "." must have every "." replaced with "_" before being written — "." is not a valid TypeScript identifier character
Example: loading → Loading, zipFetch → ZipFetch
Example input:
json"actionStates": [
  { "stateKey": "ui.login.loading", "values": ["idle","loading","success","error"] }
]
Example output:
typescriptexport enum Loading {
  IDLE    = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR   = 'error',
}

##STEP 6 — Mocks
Read from: the interfaces produced in STEP 1.
Algorithm:
for each interface produced in STEP 1 (name, fields[]):
  emit:
    export const Mock_{name}: {name}[] = [
      object_1,   ← all required fields present; include optional fields
      object_2,   ← all required fields present; omit some optional fields
      object_3,   ← all required fields present; omit different optional fields
    ]
Rules for values — apply in order, first match wins:
Field name patternValue to useemail or ends with Emailrealistic fictional email: alice@example.compasswordrealistic password string: Alice@2024!ends with tokeneyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aliceends with Identityname_001 / _002 / _003ends with Price or Amountrealistic decimal: 29.90 / 89.50 / 149.00ends with Date or AtISO string: '2024-03-15'type is booleanalternate: true, false, true across 3 objectstype is unknown[][]anything elseshort realistic string (name, city, description)
When omitting an optional field, write a comment on its own line: // {fieldName} omitted
Example input: interface user with fields email (required), password (required), token (optional)
Example output:
typescriptexport const Mock_user: user[] = [
  {
    email   : 'alice@example.com',
    password: 'Alice@2024!',
    token   : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.alice',
  },
  {
    email   : 'bob@pizzaria.com',
    password: 'B0bSecure#',
    // token omitted
  },
  {
    email   : 'carol@pizza.io',
    password: 'C@rolPass99',
    token   : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.carol',
  },
];

##Final file structure
Assemble the output in this exact order. Skip any section that produced no output.
\`\`\`typescript

/// <mls fileReference="_102009_/l1/pizzaria/layer_2_controller/login.ts" enhancement="_blank" />

/**
 * @screen  {page.screenId}
 * @page    {page.pageName}
 * @actor   {page.actor}
 * @purpose {page.purpose}
 */

// ── entity interfaces ─────────────────────────────────────────────
{STEP 1 output}

// ── TempStateAction ───────────────────────────────────────────────
{STEP 2 output}

// ── NavigationFieldsAction ────────────────────────────────────────
{STEP 3 output}

// ── EmitsAction ───────────────────────────────────────────────────
{STEP 4 output}

// ── action state enums ────────────────────────────────────────────
{STEP 5 output}

// ── mocks ─────────────────────────────────────────────────────────
{STEP 6 output}
\`\`\`

##Formatting rules

Align : vertically within each interface and each mock object
One blank line between each exported declaration
Enum members aligned with padding spaces if needed for readability
No imports — file is fully self-contained
**Key sanitization**: any interface or type field name that contains "." must have every "." replaced with "_" before being written — "." is not a valid TypeScript identifier character
`;