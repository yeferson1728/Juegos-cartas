import app from "./app.js";

const PORT = process.env.PORT || 3000;

// Debug: listar rutas registradas
if (app && app._router) {
  const routes = app._router.stack
    .filter((r) => r.route)
    .map((r) => {
      const methods = Object.keys(r.route.methods).join(",").toUpperCase();
      return `${methods} ${r.route.path}`;
    });
  console.log("Rutas registradas:", routes);
}

app.listen(PORT, () => {
  console.log(`🚀 RELANCINA API corriendo en http://localhost:${PORT}`);
});
