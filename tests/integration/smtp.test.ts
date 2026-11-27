import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Socket } from "node:net";
import test from "node:test";
import { createTransport } from "nodemailer";
import { sendEmailNotification } from "../../src/services/notifications/sendEmailNotification";

// Loopback only: this server never forwards email or uses external credentials.
async function smtpFixture(mode: "accept" | "reject" | "defer" | "hang", work: (port: number, message: () => string) => Promise<void>) {
  const sockets = new Set<Socket>();
  let received = "";
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    socket.write("220 localhost synthetic SMTP\r\n");
    let buffer = "";
    let data = false;
    socket.on("data", chunk => {
      buffer += chunk;
      for (;;) {
        const index = buffer.indexOf("\r\n");
        if (index < 0) break;
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (data) {
          if (line !== ".") { received += line + "\r\n"; continue; }
          data = false;
          if (mode === "hang") continue;
          socket.write(mode === "accept" ? "250 synthetic accepted\r\n" : mode === "reject" ? "550 synthetic refused\r\n" : "451 synthetic temporary refusal\r\n");
        } else if (line.startsWith("EHLO")) socket.write("250-localhost\r\n250 PIPELINING\r\n");
        else if (line.startsWith("MAIL FROM:") || line.startsWith("RCPT TO:")) socket.write("250 OK\r\n");
        else if (line === "DATA") { data = true; socket.write("354 Send message\r\n"); }
        else if (line === "QUIT") socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await work((server.address() as { port: number }).port, () => received); }
  finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

const message = { to: "recipient@example.invalid", name: "Synthetic giver", revealUrl: "https://app.example.invalid/r#synthetic-token", testMode: true };
const transport = (port: number) => createTransport({ host: "127.0.0.1", port, secure: false, ignoreTLS: true, logger: false, debug: false });

test("SMTP protocol sends the branded multipart email and handles explicit server refusals", async () => {
  for (const mode of ["accept", "reject", "defer"] as const) {
    await smtpFixture(mode, async (port, body) => {
      const delivery = { sender: "sender@example.invalid", transport: transport(port) };
      if (mode === "defer") await assert.rejects(sendEmailNotification(message, delivery), { name: "NotificationRateLimitError" });
      else assert.equal((await sendEmailNotification(message, delivery)).ok, mode === "accept");
      assert.match(body(), /Content-Type: multipart\/alternative/);
      assert.match(body(), /Content-Type: text\/plain/);
      assert.match(body(), /Content-Type: text\/html/);
      assert.match(body(), /Message-ID: <[0-9a-f-]{36}@gmail.com>/);
    });
  }
});

test("SMTP cancellation closes a connection awaiting final acceptance and leaves the result unknown", async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, "timeout", () => timeout(150));
  await smtpFixture("hang", async (port, body) => {
    const delivery = { sender: "sender@example.invalid", transport: transport(port) };
    await assert.rejects(sendEmailNotification(message, delivery), /outcome unknown/);
    assert.match(body(), /Content-Type: multipart\/alternative/);
  });
});
