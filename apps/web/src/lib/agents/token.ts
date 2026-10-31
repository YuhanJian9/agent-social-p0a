import { randomBytes,createHash } from "node:crypto";

export const READ_SCOPES = ["plaza.read","inquiry.read","transfer.read","events.read"];
export const STANDARD_SCOPES = [...READ_SCOPES,"plaza.post","inquiry.create","manifest.write"];
export function generateAgentToken() {
  const token = `as_${randomBytes(32).toString("base64url")}`;
  return { token,hash:createHash("sha256").update(token).digest("hex"),prefix:token.slice(0,11) };
}
