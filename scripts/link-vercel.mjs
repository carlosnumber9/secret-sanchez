import { mkdir, readFile, writeFile } from "node:fs/promises";

// Keep the ignored CLI metadata reproducible without creating another Vercel project.
const root = new URL("../", import.meta.url);
const project = JSON.parse(await readFile(new URL("vercel.project.json", root), "utf8"));
if (!/^prj_[A-Za-z0-9]+$/.test(project.projectId) || !/^team_[A-Za-z0-9]+$/.test(project.orgId) || project.projectName !== "secret-sanchez-2amj") {
  throw new Error("Invalid canonical Vercel project configuration.");
}
await mkdir(new URL(".vercel/", root), { recursive: true });
await writeFile(new URL(".vercel/project.json", root), `${JSON.stringify(project, null, 2)}\n`);
console.log(`Linked this checkout to Vercel project ${project.projectName}.`);
