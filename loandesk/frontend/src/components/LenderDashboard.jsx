import { useEffect, useState } from "react";

export default function LenderDashboard({ contract }) {
  const [pending, setPending] = useState([]);

  async function loadPending() {
    const ids = await contract.getPendingRequestIds();
    const data = [];
    for (const id of ids) {
      const r = await contract.getRequest(id);
      data.push(r);
    }
    setPending(data);
  }

  async function review(id, approve) {
    try {
      const tx = await contract.review(id, approve);
      await tx.wait();
      alert("Decision saved");
      await loadPending();
    } catch (err) {
      console.error(err);
      alert("Transaction failed");
    }
  }

  useEffect(() => {
    if (contract) loadPending();
  }, [contract]);

  return (
    <div className="card">
      <h2>Lender Dashboard</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Borrower</th><th>Amount</th><th>Score</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pending.length === 0 ? (
            <tr><td colSpan="5">No pending requests.</td></tr>
          ) : (
            pending.map((r) => (
              <tr key={r.id}>
                <td>{r.id.toString()}</td>
                <td>{r.borrower}</td>
                <td>${(Number(r.amountInCents)/100).toFixed(2)}</td>
                <td>{r.creditScore}</td>
                <td>
                  <button onClick={() => review(r.id, true)}>Approve</button>
                  <button onClick={() => review(r.id, false)}>Deny</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
