import { H, SHOT, launch, signIn } from "./harness.mjs";
const r = []; const check=(n,ok,d="")=>{r.push(ok);console.log(`${ok?"PASS":"FAIL"}  ${n}${d?"  — "+d:""}`)};
const b = await launch();
const p = await (await b.newContext({ locale:"ar-EG", viewport:{width:1280,height:1100} })).newPage();
const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,140)));
await p.goto(H+"/login",{waitUntil:"domcontentloaded",timeout:180000});
await p.fill('input[name="email"]',"admin@spir.local");
await p.fill('input[name="password"]',"123");
await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await p.waitForURL(u=>!u.pathname.startsWith("/login"),{timeout:180000}).catch(()=>{});

// With no DATABASE_URL this machine is standalone — the panel must say so.
await p.goto(H+"/monitoring/sync",{waitUntil:"domcontentloaded",timeout:120000});
await p.waitForTimeout(2500);
let t1 = await p.locator("body").innerText();
check("page has a database-sync section", t1.includes("مزامنة قاعدة البيانات"));
check("and a separate browser-queue section", t1.includes("طابور المتصفّح والاتصال"));
check("standalone state is explained", t1.includes("هذا الحاسوب فقط"));
check("it reports how many changes are recorded", t1.includes("التغييرات المسجّلة على هذا الحاسوب"));
check("no Arabic-Indic digits", !/[٠-٩]/.test(t1));

// Make a change, then confirm the count it reports moves.
const before = (t1.match(/التغييرات المسجّلة على هذا الحاسوب[^\d]*(\d+)/) || [])[1];
await p.goto(H+"/labs/new",{waitUntil:"domcontentloaded",timeout:120000});
await p.fill('input[name="code"]',"L-MON");
await p.fill('input[name="name"]',"مختبر المراقبة");
await p.locator('button[type="submit"]').last().click();
await p.waitForURL(u=>!u.pathname.endsWith("/new"),{timeout:60000}).catch(()=>{});
await p.goto(H+"/monitoring/sync",{waitUntil:"domcontentloaded",timeout:120000});
await p.waitForTimeout(2500);
const t2 = await p.locator("body").innerText();
const after = (t2.match(/التغييرات المسجّلة على هذا الحاسوب[^\d]*(\d+)/) || [])[1];
check("the recorded-change count rises after a save", Number(after) > Number(before), `${before} -> ${after}`);
check("no uncaught page errors", errs.length===0, errs.slice(0,2).join(" | "));
await p.screenshot({ path:`${SHOT}/monitoring-sync.png`, fullPage:true });
console.log(`\n${r.filter(Boolean).length}/${r.length} checks passed`);
await b.close();
