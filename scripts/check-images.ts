import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

async function run() {
  const envFile = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
  const envVars = Object.fromEntries(
    envFile
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim().replace(/^"|'/, "").replace(/"|'$/, "")];
      })
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envVars["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!supabaseUrl || !supabaseKey) {
    console.log("Missing env vars");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      slug, 
      makes:make_id ( name ), 
      models:model_id ( name ),
      vehicle_images ( alt_text, sort_order, is_cover, media_assets:media_id ( storage_key ) )
    `)
    .limit(5);

  if (error) console.error(error);
  console.dir(data, { depth: null });
}

run();
