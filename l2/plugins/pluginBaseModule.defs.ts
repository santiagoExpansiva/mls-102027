/// <mls fileReference="_102027_/l2/plugins/pluginBaseModule.defs.ts" enhancement="_blank" />

// Do not change – automatically generated code. 

export const asis: mls.defs.AsIs = {
  "meta": {
    "fileReference": "_102027_/l2/plugins/pluginBaseModule.ts",
    "componentType": "pluginUI",
    "componentScope": "appFrontEnd"
  },
  "references": {
    "imports": [
      {
        "ref": "lit/decorators.js",
        "dependencies": [
          {
            "name": "property"
          }
        ]
      },
      {
        "ref": "/_102029_/l2/stateLitElement.js",
        "dependencies": [
          {
            "name": "StateLitElement",
            "type": "class"
          }
        ]
      }
    ]
  },
  "asIs": {
    "semantic": {
      "generalDescription": "Abstract base class for plugin modules.",
      "technicalCapabilities": [
        "Base class for Lit-based plugin modules",
        "Scope management for plugins"
      ],
      "businessCapabilities": [],
      "implementedFeatures": [
        "scope property",
        "abstract render method"
      ]
    }
  }
}
    