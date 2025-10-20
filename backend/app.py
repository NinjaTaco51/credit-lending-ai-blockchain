
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional
import json, hashlib, os
from blockchain import MiniChain

app = FastAPI(title="Credit Score + Toy Blockchain (Python-only)")

# single in-memory chain for demo
chain = MiniChain()

def canonical_json(obj) -> str:
    return json.dumps(obj, separators=(",", ":"), sort_keys=True)

def sha256_hex_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

class ScoreIn(BaseModel):
    income: float = Field(3000, ge=0)
    expenses: float = Field(1500, ge=0)
    on_time_payments: float = Field(0.8, ge=0.0, le=1.0)
    model_version: str = "v1"

@app.get("/", response_class=HTMLResponse)
def index():
    return """
<!doctype html>
<html>
  <head>
    <meta charset='utf-8'/>
    <title>Credit + Anchoring (Python)</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 40px; }
      .card { max-width: 640px; padding: 16px; border: 1px solid #ddd; border-radius: 12px; }
      label { display:block; margin: 8px 0 4px; }
      input { width: 100%; padding: 8px; font-size: 14px; }
      button { margin-top: 12px; padding: 10px 16px; border-radius: 10px; border: 0; background: black; color: white; }
      pre { background: #f7f7f7; padding: 12px; border-radius: 10px; overflow:auto; }
      .row { display:flex; gap: 16px; }
    </style>
  </head>
  <body>
    <h2>Credit Score + Toy Blockchain (Python-only)</h2>
    <div class='card'>
      <div>
        <label>Income</label>
        <input id='income' type='number' value='3000'/>
        <label>Expenses</label>
        <input id='expenses' type='number' value='1500'/>
        <label>On-time payments (0–1)</label>
        <input id='otp' type='number' step='0.1' value='0.8'/>
        <label>Model version</label>
        <input id='model' type='text' value='v1'/>
        <button onclick='score()'>Get Score</button>
      </div>
      <div id='scoreBox'></div>
      <div id='anchorBox'></div>
      <div style='margin-top:12px'>
        <button onclick='viewChain()'>View Chain</button>
      </div>
      <pre id='chainView' style='display:none'></pre>
    </div>

    <script>
      async function score(){
        const body = {
          income: parseFloat(document.getElementById('income').value),
          expenses: parseFloat(document.getElementById('expenses').value),
          on_time_payments: parseFloat(document.getElementById('otp').value),
          model_version: document.getElementById('model').value
        };
        const r = await fetch('/score', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
        const data = await r.json();
        window._last = data;
        document.getElementById('scoreBox').innerHTML = '<p><b>Score:</b> '+data.score+'</p><p><b>Decision Hash:</b> '+data.decision_hash+'</p><button onclick="anchor()">Anchor on Toy Blockchain</button>';
        document.getElementById('anchorBox').innerHTML = '';
      }
      async function anchor(){
        const r = await fetch('/anchor', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ decision_hash: window._last.decision_hash, model_version: window._last.model_version })});
        const data = await r.json();
        document.getElementById('anchorBox').innerHTML = '<p><b>Anchored!</b> Block #'+data.block.index+' hash: '+data.block.hash+'</p>';
      }
      async function viewChain(){
        const r = await fetch('/chain');
        const data = await r.json();
        const el = document.getElementById('chainView');
        el.style.display = 'block';
        el.textContent = JSON.stringify(data, null, 2);
      }
    </script>
  </body>
</html>
"""

@app.post("/score")
def score(inp: ScoreIn):
    affordability = max(inp.income - inp.expenses, 0.0)
    raw = 0.6 * (affordability / 1000.0) + 0.4 * inp.on_time_payments
    score_val = int(max(0, min(100, round(raw))))
    decision_payload = {
        "score": score_val,
        "income": inp.income,
        "expenses": inp.expenses,
        "on_time_payments": inp.on_time_payments,
        "model_version": inp.model_version,
    }
    canonical = canonical_json(decision_payload)
    decision_hash = sha256_hex_bytes(canonical.encode())
    return {
        "score": score_val,
        "decision_hash": decision_hash,
        "model_version": inp.model_version,
        "reason": ["affordability", "payment history"],
        "canonical": canonical
    }

class AnchorIn(BaseModel):
    decision_hash: str
    model_version: Optional[str] = "v1"

@app.post("/anchor")
def anchor(inp: AnchorIn):
    # disallow anchoring the same decision twice
    for b in chain.blocks:
        if isinstance(b.data, dict) and b.data.get("decision_hash") == inp.decision_hash:
            return JSONResponse(status_code=400, content={"error": "Already anchored"})
    block = chain.add_anchor(decision_hash=inp.decision_hash, model_version=inp.model_version or "v1")
    return {"block": block.__dict__}

@app.get("/chain")
def get_chain():
    return {"valid": chain.verify(), "blocks": chain.to_dict()}
