window.addEventListener("load", function () {
  window.ui = SwaggerUIBundle({
    url: "/docs/openapi.json",
    dom_id: "#swagger-ui",
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "StandaloneLayout",
    displayRequestDuration: true,
    tryItOutEnabled: true
  });
});
