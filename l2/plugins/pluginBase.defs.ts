/// <mls fileReference="_102027_/l2/plugins/pluginBase.defs.ts" enhancement="_blank" />

// Do not change – automatically generated code. 

export const asis: mls.defs.AsIs = {
  "meta": {
    "fileReference": "_102027_/l2/plugins/pluginBase.ts",
    "componentType": "pluginUI",
    "componentScope": "appFrontEnd"
  },
  "references": {
    "imports": [
      {
        "ref": "lit",
        "dependencies": [
          {
            "name": "html",
            "type": "function"
          },
          {
            "name": "LitElement",
            "type": "class"
          },
          {
            "name": "TemplateResult",
            "type": "type"
          }
        ]
      },
      {
        "ref": "/_102029_/l2/collabLitElement.js",
        "dependencies": [
          {
            "name": "CollabLitElement",
            "type": "class"
          }
        ]
      },
      {
        "ref": "lit/decorators.js",
        "dependencies": [
          {
            "name": "customElement",
            "type": "function"
          },
          {
            "name": "property",
            "type": "function"
          },
          {
            "name": "state",
            "type": "function"
          }
        ]
      }
    ]
  },
  "asIs": {
    "semantic": {
      "generalDescription": "Abstract base class for plugin components.",
      "businessCapabilities": [
        "Standardizes plugin structure"
      ],
      "technicalCapabilities": [
        "Inheritance from CollabLitElement",
        "Abstract property and method enforcement"
      ],
      "implementedFeatures": [
        "scope property",
        "abstract description property",
        "abstract getSvg method"
      ]
    }
  }
}
    