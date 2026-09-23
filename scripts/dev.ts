const projectRoot = import.meta.dir.replace(/\\scripts$/, "");
const dev = Bun.spawn(["bun", "run", "--cwd", "apps/electron", "dev"], {
  cwd: projectRoot,
  env: process.env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const stop = () => dev.kill("SIGINT");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

process.exit(await dev.exited);
