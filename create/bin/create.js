#!/usr/bin/env bun

import degit from "degit";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, extname, join, resolve } from "node:path";
import process from "node:process";

const template = "isnandev/electron-bun-starter";
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

function printUsage() {
  console.log("Usage: bun create electron-bun-starter <directory>");
}

function toPackageName(directory) {
  const name = basename(directory)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  if (!name || name.length > 214 || name.startsWith(".")) {
    throw new Error(`Cannot derive a valid package name from '${basename(directory)}'.`);
  }

  return name;
}

function toTitle(name) {
  return name
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

async function rebrand(directory, packageName, title) {
  const titleWithHyphens = title.replaceAll(" ", "-");

  async function visit(currentDirectory) {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if ([".git", "node_modules", "artifacts", "create"].includes(entry.name)) continue;
        await visit(join(currentDirectory, entry.name));
        continue;
      }

      if (
        !textExtensions.has(extname(entry.name).toLowerCase()) &&
        entry.name !== ".gitignore" &&
        entry.name !== "bun.lock"
      ) {
        continue;
      }

      const filePath = join(currentDirectory, entry.name);
      const content = await readFile(filePath, "utf8");
      if (content.includes("\0")) continue;

      const updated = content
        .replaceAll("create-electron-bun-starter", "__ELECTRON_BUN_STARTER_CREATOR_COMMAND__")
        .replaceAll("github.com/isnandev/electron-bun-starter", "__ELECTRON_BUN_STARTER_GITHUB_URL__")
        .replaceAll("isnandev/electron-bun-starter", "__ELECTRON_BUN_STARTER_REPOSITORY__")
        .replaceAll("electron-bun-starter", packageName)
        .replaceAll("Electron Bun Starter", title)
        .replaceAll("Electron-Bun-Starter", titleWithHyphens)
        .replaceAll("electronbunstarter", packageName.replaceAll(/[^a-z0-9]/g, ""))
        .replaceAll("__ELECTRON_BUN_STARTER_REPOSITORY__", "isnandev/electron-bun-starter")
        .replaceAll("__ELECTRON_BUN_STARTER_GITHUB_URL__", "github.com/isnandev/electron-bun-starter")
        .replaceAll("__ELECTRON_BUN_STARTER_CREATOR_COMMAND__", "create-electron-bun-starter");

      if (updated !== content) await writeFile(filePath, updated);
    }
  }

  await visit(directory);

  const rootPackagePath = join(directory, "package.json");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  rootPackage.name = packageName;
  rootPackage.private = true;
  await writeFile(rootPackagePath, `${JSON.stringify(rootPackage, null, 2)}\n`);
}

const destinationArgument = process.argv[2];
if (!destinationArgument || ["--help", "-h"].includes(destinationArgument)) {
  printUsage();
  process.exit(destinationArgument ? 0 : 1);
}

const destination = resolve(destinationArgument);
const temporaryDestination = `${destination}.tmp-${randomUUID()}`;
const packageName = toPackageName(destination);
const title = toTitle(packageName);

try {
  await readdir(destination);
  throw new Error(`Destination '${destinationArgument}' already exists. Choose a new directory.`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

console.log(`Creating ${title} from ${template}...`);

try {
  await mkdir(dirname(destination), { recursive: true });
  await degit(template, { cache: false, force: false }).clone(temporaryDestination);
  await rm(join(temporaryDestination, "create"), { recursive: true, force: true });
  await rebrand(temporaryDestination, packageName, title);
  await rename(temporaryDestination, destination);
  console.log(`\nCreated ${destinationArgument}. Next steps:\n`);
  console.log(`  cd ${destinationArgument}`);
  console.log("  bun install");
  console.log("  bun run dev");
} catch (error) {
  await rm(temporaryDestination, { recursive: true, force: true });
  console.error(`\nCould not create the project: ${error.message}`);
  process.exitCode = 1;
}
