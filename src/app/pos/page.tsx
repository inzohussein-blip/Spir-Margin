import { createClient } from "@/lib/supabase/server";
import { getProducts, getLabs } from "@/lib/queries";
import { PosTerminal } from "@/components/pos/PosTerminal";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const supabase = createClient();
  const [products, labs, { data: rate }] = await Promise.all([
    getProducts(),
    getLabs(),
    supabase.rpc("fn_usd_iqd_rate"),
  ]);

  return (
    <PosTerminal
      products={products as never}
      labs={labs as never}
      iqdRate={Number(rate) || 1310}
    />
  );
}
