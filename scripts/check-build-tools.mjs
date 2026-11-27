// Astro may offer an interactive install and exit successfully when a checker
// dependency cannot load. Fail before that prompt so every build checks types.
try {
  await Promise.all([import("@astrojs/check"), import("typescript")]);
} catch {
  console.error("No se pudo cargar el comprobador de tipos. Ejecuta npm ci antes de volver a compilar.");
  process.exitCode = 1;
}
