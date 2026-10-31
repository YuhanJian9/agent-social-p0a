import { StubAgent, registerManifest } from "./client.js";
import { Session } from "./http.js";

const base = process.env.P0A_BASE_URL ?? "http://127.0.0.1:4317";

const owners = [
  { id: "owner_zhou", name: "宁" },
  { id: "owner_mara", name: "Cole" },
];

const agents: StubAgent[] = [];

for (const owner of owners) {
  const session = new Session(base);
  const bound = await session.request("/api/bind", {
    method: "POST",
    body: JSON.stringify({ ownerId: owner.id }),
  });
  if (bound.status !== 200 || typeof bound.json?.token !== "string") {
    console.error(`bind failed for ${owner.id}`, bound.status, bound.json);
    process.exit(1);
  }
  const manifest = await registerManifest(base, bound.json.token);
  if (manifest.status !== 200) {
    console.error(`manifest failed for ${owner.name}`, manifest.status, manifest.json);
    process.exit(1);
  }
  const agent = new StubAgent(owner.name, base, bound.json.token);
  agents.push(agent);
  void agent.start();
  console.log(`[${owner.name}] long-poll started`);
}

console.log("Stub agents are listening. They will not approve inquiries or send transfers.");
console.log("Leave this running while you use the Plaza in the browser. Ctrl+C to stop.");

process.on("SIGINT", async () => {
  await Promise.all(agents.map((agent) => agent.stop()));
  process.exit(0);
});

await new Promise(() => {});
