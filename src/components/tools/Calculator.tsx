"use client";

import { useState, useEffect, useCallback } from "react";

// A safe arithmetic evaluator (no eval): shunting-yard over + - * / % and parens.
function calc(expr: string): number {
  const tokens = expr.match(/(\d+\.?\d*|[()+\-*/%])/g) ?? [];
  const out: (number | string)[] = [];
  const ops: string[] = [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
  for (const t of tokens) {
    if (/^\d/.test(t)) out.push(parseFloat(t));
    else if (t === "(") ops.push(t);
    else if (t === ")") { while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()!); ops.pop(); }
    else { while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop()!); ops.push(t); }
  }
  while (ops.length) out.push(ops.pop()!);
  const st: number[] = [];
  for (const t of out) {
    if (typeof t === "number") st.push(t);
    else { const b = st.pop() ?? 0, a = st.pop() ?? 0; st.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : t === "%" ? a % b : a / b); }
  }
  return st[0] ?? 0;
}

const KEYS = ["C", "(", ")", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "%", "="];

export function Calculator() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("0");

  const press = useCallback((k: string) => {
    if (k === "C") { setExpr(""); setResult("0"); return; }
    if (k === "=") {
      try { const r = calc(expr); setResult(Number.isFinite(r) ? String(Math.round(r * 1e6) / 1e6) : "Error"); }
      catch { setResult("Error"); }
      return;
    }
    setExpr((e) => e + k);
  }, [expr]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/[0-9+\-*/%.()]/.test(e.key)) { setExpr((x) => x + e.key); }
      else if (e.key === "Enter" || e.key === "=") { e.preventDefault(); press("="); }
      else if (e.key === "Backspace") setExpr((x) => x.slice(0, -1));
      else if (e.key === "Escape") press("C");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div className="w-full max-w-xs rounded-xl border border-outline-gray-2 bg-surface-white p-4 shadow-sm">
      <div className="mb-3 rounded-lg bg-surface-gray-1 p-3 text-right">
        <div className="h-5 truncate text-sm text-ink-gray-5">{expr || "0"}</div>
        <div className="truncate text-2xl font-bold text-ink-gray-9">{result}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className={`rounded-md py-3 text-sm font-semibold ${
              k === "=" ? "bg-brand text-white hover:bg-brand-dark" :
              k === "C" ? "bg-red-50 text-red-600 hover:bg-red-100" :
              /[0-9.]/.test(k) ? "bg-surface-gray-1 text-ink-gray-8 hover:bg-surface-gray-2" :
              "bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
