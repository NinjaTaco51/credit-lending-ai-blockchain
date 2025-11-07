'use client'

import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// --- Simple local DB helpers (localStorage) ---
const DB_KEY = "credit_scoring_records_v1";
const loadRecords = () => {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || "[]"); } catch { return []; }
};
const saveRecords = (recs) => localStorage.setItem(DB_KEY, JSON.stringify(recs));
const clearRecords = () => localStorage.removeItem(DB_KEY);

// --- Types ---
/** @typedef {{ id:string, ts:number, applicant:{name:string, email:string}, inputs:any, score:number, pd:number, band:string, reasons:{code:string,label:string,direction:"+"|"-", delta:number}[] }} ScoreRecord */

// --- Utility functions ---
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fmtPct = (x) => `${(x*100).toFixed(1)}%`;
const toBand = (score) => score >= 720 ? "A" : score >= 680 ? "B" : score >= 640 ? "C" : score >= 600 ? "D" : "E";

// Sigmoid helper for PD mapping (rough, illustrative)
const pdFromScore = (score) => {
  // Map 300-850 to odds and then PD; purely illustrative
  const odds = Math.pow(2, (score - 600) / 50); // 50 pts doubles odds
  const pd = 1 / (1 + odds); // higher score -> lower PD
  return clamp(pd, 0.001, 0.95);
};

// --- Mock SHAP-style explainer ---
function explain(inputs){
  const reasons = [];
  const { income, expenses, debt, util, late3m, empYears, savingsRate } = inputs;
  const dti = income > 0 ? (debt + expenses) / income : 1; // debt+expenses to income
  const vol = inputs.balanceVol; // 0..1

  // Negative drivers
  if(dti > 0.45) reasons.push({code:"RC01", label:"High debt-to-income ratio", direction:"-", delta: -25});
  if(util > 0.5) reasons.push({code:"RC11", label:"High credit utilization", direction:"-", delta: -18});
  if(late3m > 0) reasons.push({code:"RC02", label:"Recent missed payments", direction:"-", delta: -22});
  if(vol > 0.6) reasons.push({code:"RC05", label:"High balance fluctuation", direction:"-", delta: -10});

  // Positive drivers
  if(empYears >= 2) reasons.push({code:"RC09", label:"Stable employment history", direction:"+", delta: +12});
  if(savingsRate >= 0.15) reasons.push({code:"RC10", label:"Healthy savings-to-income", direction:"+", delta: +10});
  if(dti <= 0.3) reasons.push({code:"RC15", label:"Low debt-to-income", direction:"+", delta: +14});
  if(util <= 0.2) reasons.push({code:"RC16", label:"Low credit utilization", direction:"+", delta: +8});

  // Rank by absolute impact and keep top 5
  reasons.sort((a,b)=> Math.abs(b.delta) - Math.abs(a.delta));
  return reasons.slice(0,5);
}

function computeScore(inputs){
  // Start from a baseline and add contributions to simulate a scorecard
  let score = 660; // neutral-ish baseline
  const { income, expenses, debt, util, late3m, empYears, savingsRate } = inputs;
  const dti = income > 0 ? (debt + expenses) / income : 1;

  // Penalize/Reward based on simple rules (illustrative only)
  score += clamp( (0.35 - dti) * 200, -80, 40); // lower DTI -> higher score
  score += clamp( (0.25 - util) * 150, -60, 30); // lower utilization -> higher score
  score += empYears >= 2 ? 10 : -10;
  score += clamp((savingsRate - 0.1) * 120, -20, 20);
  score += - late3m * 15;

  return clamp(Math.round(score), 300, 850);
}

// --- UI Components ---
const Pill = ({children, tone="neutral"}) => (
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${tone==="good"?"bg-green-100 text-green-700": tone==="bad"?"bg-red-100 text-red-700":"bg-slate-100 text-slate-700"}`}>{children}</span>
);

export default function CreditScoringDashboard(){
  const [records, setRecords] = useState/** @type {ScoreRecord[]} */(loadRecords());
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    name: "",
    email: "",
    income: 6000,
    expenses: 2000,
    debt: 5000,
    util: 0.35, // credit utilization 0..1
    late3m: 0,
    empYears: 1,
    savingsRate: 0.08, // savings/income
    balanceVol: 0.3,   // 0..1 volatility
    loanAmount: 8000,
    tenorMonths: 12,
  });

  const dti = useMemo(()=> inputs.income>0 ? (inputs.debt + inputs.expenses)/inputs.income : 1, [inputs]);

  const onChange = (k, v) => setInputs(prev => ({...prev, [k]: v}));

  const handleScore = async () => {
    setLoading(true);
    // Simulate scoring latency
    await new Promise(r=> setTimeout(r, 400));

    const score = computeScore(inputs);
    const reasons = explain(inputs);
    const pd = pdFromScore(score);
    const rec = /** @type {ScoreRecord} */({
      id: crypto.randomUUID(),
      ts: Date.now(),
      applicant: { name: inputs.name || "Unnamed", email: inputs.email || "" },
      inputs,
      score,
      pd,
      band: toBand(score),
      reasons,
    });
    const next = [rec, ...records].slice(0, 50);
    setRecords(next);
    saveRecords(next);
    setLoading(false);
  };

  const handleClear = () => { clearRecords(); setRecords([]); };

  const chartData = useMemo(()=>
    [...records].reverse().map(r=> ({
      ts: new Date(r.ts).toLocaleTimeString(),
      score: r.score,
      pd: +(r.pd*100).toFixed(2)
    })),
    [records]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Credit Scoring Dashboard</h1>
            <p className="text-sm text-slate-600">UI/UX prototype • Borrower input → AI score → SHAP-style reasons → Local DB → Visualization</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleClear} className="px-3 py-2 rounded-xl bg-white border text-slate-700 hover:bg-slate-100">Clear History</button>
          </div>
        </header>

        {/* Grid: Inputs + Results */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Inputs Card */}
          <section className="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold">Borrower Inputs</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm">Full Name
                <input value={inputs.name} onChange={e=>onChange("name", e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Jane Doe" />
              </label>
              <label className="col-span-2 text-sm">Email (optional)
                <input value={inputs.email} onChange={e=>onChange("email", e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="jane@example.com" />
              </label>
              <label className="text-sm">Monthly Income ($)
                <input type="number" value={inputs.income} onChange={e=>onChange("income", Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="text-sm">Monthly Expenses ($)
                <input type="number" value={inputs.expenses} onChange={e=>onChange("expenses", Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="text-sm">Existing Debt ($)
                <input type="number" value={inputs.debt} onChange={e=>onChange("debt", Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="text-sm">Credit Utilization (0–1)
                <input type="number" step="0.01" value={inputs.util} onChange={e=>onChange("util", clamp(Number(e.target.value),0,1))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="text-sm">Late Payments (last 3m)
                <input type="number" value={inputs.late3m} onChange={e=>onChange("late3m", Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="text-sm">Employment Length (years)
                <input type="number" step="0.5" value={inputs.empYears} onChange={e=>onChange("empYears", Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="text-sm">Savings Rate (0–1)
                <input type="number" step="0.01" value={inputs.savingsRate} onChange={e=>onChange("savingsRate", clamp(Number(e.target.value),0,1))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="text-sm">Balance Volatility (0–1)
                <input type="number" step="0.01" value={inputs.balanceVol} onChange={e=>onChange("balanceVol", clamp(Number(e.target.value),0,1))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="text-sm">Loan Amount ($)
                <input type="number" value={inputs.loanAmount} onChange={e=>onChange("loanAmount", Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="text-sm">Tenor (months)
                <input type="number" value={inputs.tenorMonths} onChange={e=>onChange("tenorMonths", Math.max(1, Number(e.target.value)))} className="mt-1 w-full rounded-lg border p-2" />
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-slate-600">DTI ≈ <b>{(dti*100).toFixed(1)}%</b></div>
              <button onClick={handleScore} disabled={loading} className={`px-4 py-2 rounded-xl text-white ${loading?"bg-slate-400":"bg-slate-900 hover:bg-black"}`}>
                {loading? "Scoring…" : "Score Application"}
              </button>
            </div>
          </section>

          {/* Results Card */}
          <section className="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold">Decision & Explanations</h2>
            {records.length === 0 ? (
              <p className="text-sm text-slate-500">Run a score to see results here.</p>
            ) : (
              <LatestResult rec={records[0]} />
            )}
          </section>
        </div>

        {/* Visualization */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Scores Over Time</h2>
            <div className="text-xs text-slate-500">Stored locally in your browser</div>
          </div>
          {records.length === 0 ? (
            <p className="text-sm text-slate-500">No historical data yet.</p>
          ) : (
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{top:10,right:20,left:0,bottom:10}}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ts" tick={{fontSize:12}} />
                  <YAxis yAxisId="left" tick={{fontSize:12}} domain={[300,850]} />
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize:12}} />
                  <Tooltip />
                  <Line yAxisId="left" type="monotone" dataKey="score" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="pd" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* History table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">Time</th>
                  <th>Applicant</th>
                  <th>Score</th>
                  <th>PD</th>
                  <th>Band</th>
                  <th>Top Reasons</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r=> (
                  <tr key={r.id} className="border-t">
                    <td className="py-2">{new Date(r.ts).toLocaleString()}</td>
                    <td>{r.applicant.name}</td>
                    <td>{r.score}</td>
                    <td>{fmtPct(r.pd)}</td>
                    <td><Pill tone={r.band<="C"?"good":"neutral"}>{r.band}</Pill></td>
                    <td className="max-w-[420px]">
                      <div className="flex flex-wrap gap-2">
                        {r.reasons.map((m,i)=> (
                          <Pill key={i} tone={m.direction === "+" ? "good" : "bad"}>
                            {m.direction === "+" ? "+" : "-"}{Math.abs(m.delta)} · {m.label}
                          </Pill>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer note */}
        <p className="text-xs text-slate-500 text-center">Prototype for UI/UX demonstration only. Scores and explanations are illustrative and not financial advice.</p>
      </div>
    </div>
  );
}

function LatestResult({ rec }){
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-4">
        <div>
          <div className="text-4xl font-extrabold leading-none">{rec.score}</div>
          <div className="text-slate-500 text-sm">Credit Score • Band <b>{rec.band}</b></div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-sm">PD (12m): <b>{(rec.pd*100).toFixed(1)}%</b></div>
          <div className="text-xs text-slate-500">{new Date(rec.ts).toLocaleString()}</div>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-1">Top Factors</h3>
        <div className="flex flex-wrap gap-2">
          {rec.reasons.map((m,i)=> (
            <Pill key={i} tone={m.direction === "+" ? "good" : "bad"}>
              {m.direction === "+" ? "+" : "-"}{Math.abs(m.delta)} · {m.label}
            </Pill>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-slate-50 rounded-xl p-3 border">
          <div className="text-slate-500">Applicant</div>
          <div className="font-medium">{rec.applicant.name}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border">
          <div className="text-slate-500">Loan Request</div>
          <div className="font-medium">${rec.inputs.loanAmount.toLocaleString()} • {rec.inputs.tenorMonths} mo</div>
        </div>
      </div>
    </div>
  );
}