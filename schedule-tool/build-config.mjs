import { writeFileSync } from "node:fs";

const url = process.env.SCHEDIA_SUPABASE_URL || "";
const anonKey = process.env.SCHEDIA_SUPABASE_ANON_KEY || "";

const config = `window.SCHEDIA_SUPABASE = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
};
`;

writeFileSync(new URL("./config.js", import.meta.url), config);
