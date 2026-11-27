import assert from "node:assert/strict";
import test from "node:test";
import { renderEmail } from "../src/services/notifications/renderEmail";

const revealUrl = "https://app.example.invalid/r#synthetic-secret";

test("Gmail renders the branded HTML and text without revealing the receiver", () => {
  const result = renderEmail({ name: "Synthetic giver", revealUrl });
  assert.equal(result.subject, "Tu Amigo Invisible de Reyes ya está listo");
  assert.match(result.html, /#b83232/);
  assert.match(result.html, /Synthetic giver/);
  assert.match(result.text, /Synthetic giver/);
  assert.ok(result.html.includes(`href="${revealUrl}"`));
  assert.ok(result.text.includes(revealUrl));
  assert.doesNotMatch(result.html + result.text, /\{\{\{|PRUEBA:/);
});

test("test editions label the subject, HTML notice and plain text", () => {
  const result = renderEmail({ name: "Synthetic giver", revealUrl, testMode: true });
  assert.match(result.subject, /^\[PRUEBA\]/);
  assert.match(result.text, /^\[PRUEBA\]/);
  assert.match(result.html, /PRUEBA:.*únicamente al administrador/);
});

test("HTML variables are escaped once and never interpreted recursively", () => {
  const name = '<img src=x onerror="alert(1)"> & {{{REVEAL_URL}}}';
  const result = renderEmail({ name, revealUrl });
  assert.ok(result.html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; {{{REVEAL_URL}}}'));
  assert.ok(result.text.includes(name));
  assert.ok(!result.html.includes('<img src=x'));
});

test("reveal URLs must use HTTP(S), contain a fragment and have no credentials", () => {
  for (const invalid of ["javascript:alert(1)", "https://app.example.invalid/r", "https://user:password@app.example.invalid/r#token"]) {
    assert.throws(() => renderEmail({ name: "Synthetic giver", revealUrl: invalid }));
  }
});
