import { strict as assert } from "node:assert";
import { test } from "node:test";
import { authFeedback } from "./feedback";

test("unconfirmed users are directed to email confirmation", () => {
  assert.equal(authFeedback("email_not_confirmed", 400), "unconfirmed");
});
test("provider throttling is actionable without exposing raw errors", () => {
  assert.equal(authFeedback("over_email_send_rate_limit", 429), "rate_limited");
  assert.equal(authFeedback(undefined, 429), "rate_limited");
  assert.equal(authFeedback("invalid_credentials", 400), "credentials");
  assert.equal(authFeedback("private provider diagnostic", 500), "error");
});
