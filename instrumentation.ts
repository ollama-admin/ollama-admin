export async function register() {
  const pkg = await import("./package.json");
  console.log(
    `${new Date().toISOString()} [INFO] Ollama Admin v${pkg.version} | Node ${process.version} | PID ${process.pid}`
  );
}
