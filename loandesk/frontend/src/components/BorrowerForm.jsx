import { useState } from "react";

export default function BorrowerForm({ contract }) {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [uri, setUri] = useState("");
  const [score, setScore] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const tx = await contract.createRequest(
        Math.round(parseFloat(amount) * 100),
        purpose,
        uri,
        parseInt(score)
      );
      await tx.wait();
      alert("Loan requested!");
      setAmount("");
      setPurpose("");
      setUri("");
      setScore("");
    } catch (err) {
      console.error(err);
      alert(err?.reason || "Transaction failed");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>Request a Loan</h2>
      <label>Amount (USD)</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <label>Purpose</label>
      <input
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        required
      />
      <label>Metadata URI (optional)</label>
      <input value={uri} onChange={(e) => setUri(e.target.value)} />
      <label>Credit Score</label>
      <input
        type="number"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        required
      />
      <button type="submit">Submit</button>
    </form>
  );
}
