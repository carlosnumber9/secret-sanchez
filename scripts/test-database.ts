export function isolatedTestDatabase(value: string | undefined) {
  if (!value) throw new Error("Define TEST_DATABASE_URL con una base local dedicada terminada en _test.");
  const parsed = new URL(value);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || !/^\/[a-zA-Z0-9_]+_test$/.test(parsed.pathname)) {
    throw new Error("Las pruebas solo admiten una base _test en localhost. Nunca uses la base compartida.");
  }
  return value;
}
