import { useEffect, useState } from "react";

export default function BorrowerRequests({ contract, account }) {
  const [requests, setRequests] = useState([]);

  async function loadRequests() {
    const ids = await contract.getBorrowerRequestIds(account);
    const data = [];
    for (const id of ids) {
      const r = await contract.getRequest(id);
      data.push(r);
    }
    setRequests(data);
  }

  useEffect(() => {
    if (contract) loadRequests();
  }, [contract]);

  return (
    <div className="card">
      <h2>My Requests</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Amount</th><th>Score</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr><td colSpan="4">No requests yet.</td></tr>
          ) : (
            requests.map((r) => (
              <tr key={r.id}>
                <td>{r.id.toString()}</td>
                <td>${(Number(r.amountInCents)/100).toFixed(2)}</td>
                <td>{r.creditScore}</td>
                <td>{["Pending", "Approved", "Denied"][r.status]}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
