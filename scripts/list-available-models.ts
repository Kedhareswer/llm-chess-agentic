import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function listGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error("GROQ_API_KEY missing");
    return;
  }
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error("Groq models error", res.status, await res.text());
    return;
  }
  const data = await res.json();
  const ids = data?.data?.map((m: any) => m.id) || [];
  console.log("Groq models:");
  console.log(ids);
}

async function listGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("GEMINI_API_KEY missing");
    return;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  );
  if (!res.ok) {
    console.error("Gemini models error", res.status, await res.text());
    return;
  }
  const data = await res.json();
  const ids = data?.models?.map((m: any) => m.name) || [];
  console.log("Gemini models:");
  console.log(ids);
}

async function main() {
  await listGroq();
  await listGemini();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
