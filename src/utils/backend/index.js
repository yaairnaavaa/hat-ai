const express = require("express");
const app = express();
const port = 3001; // Cambia el puerto si lo necesitas

// Ruta básica
app.get("/", (req, res) => {
  res.send("Servidor backend funcionando correctamente");
});

// Escuchar el puerto
app.listen(port, () => {
  console.log(`Servidor backend corriendo en http://localhost:${port}`);
});
