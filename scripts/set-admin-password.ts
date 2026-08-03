import { pathToFileURL } from "node:url";
import { emitKeypressEvents } from "node:readline";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { z } from "zod";

config({ path: [".env.local", ".env"], quiet: true });

export function parseUserId(argv: string[]) {
  if (argv.some((argument) => argument === "--password" || argument.startsWith("--password="))) {
    throw new Error("La contraseña no se admite como argumento. Se solicitará de forma oculta.");
  }

  const flagIndex = argv.indexOf("--user-id");
  const userId = flagIndex >= 0 ? argv[flagIndex + 1]?.trim() : undefined;
  const parsed = z.uuid().safeParse(userId);
  if (!parsed.success) {
    throw new Error("Uso: npm run admin:set-password -- --user-id <uuid>");
  }
  return parsed.data;
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  if (!password) throw new Error("La contraseña no puede estar vacía.");
  if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");
  return password;
}

export function getPasswordUpdateErrorMessage(error: { code?: string; status?: number }) {
  const reason = error.code ?? error.status ?? "provider_error";
  return `Supabase no pudo actualizar la contraseña (${reason}).`;
}

async function readHidden(prompt: string) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Este comando necesita una terminal interactiva para leer secretos de forma segura.");
  }

  emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  const wasPaused = stdin.isPaused();
  let value = "";

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise<string>((resolve, reject) => {
    function cleanup() {
      stdin.off("keypress", onKeypress);
      stdin.setRawMode(wasRaw);
      if (wasPaused) stdin.pause();
      stdout.write("\n");
    }

    function onKeypress(character: string, key: { name?: string; ctrl?: boolean; meta?: boolean }) {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Operación cancelada."));
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
        return;
      }

      if (key.name === "backspace") {
        value = Array.from(value).slice(0, -1).join("");
        return;
      }

      if (!key.ctrl && !key.meta && character) value += character;
    }

    stdin.on("keypress", onKeypress);
  });
}

function getSupabaseUrl() {
  const value = process.env.PUBLIC_SUPABASE_URL?.trim();
  if (!value) throw new Error("PUBLIC_SUPABASE_URL es obligatoria.");

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
  } catch {
    throw new Error("PUBLIC_SUPABASE_URL debe ser una URL HTTP o HTTPS válida.");
  }

  return value;
}

async function getAdminKey() {
  const configuredKey =
    process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (configuredKey) return configuredKey;

  const promptedKey = (await readHidden("Supabase secret/service-role key: ")).trim();
  if (!promptedKey) throw new Error("La clave administrativa de Supabase es obligatoria.");
  return promptedKey;
}

export async function main(argv = process.argv.slice(2)) {
  const userId = parseUserId(argv);
  const supabaseUrl = getSupabaseUrl();
  const adminKey = await getAdminKey();
  const password = await readHidden("Nueva contraseña: ");
  const confirmation = await readHidden("Repite la contraseña: ");
  const confirmedPassword = validatePasswordConfirmation(password, confirmation);

  const supabase = createClient(supabaseUrl, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: confirmedPassword
  });

  if (error) throw new Error(getPasswordUpdateErrorMessage(error));
  console.log(`Contraseña actualizada para el usuario ${userId}.`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    process.exitCode = 1;
  });
}
