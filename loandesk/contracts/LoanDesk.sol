// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * A minimal loan request registry:
 * - Borrower calls createRequest(...) with amount, purpose, metadataURI, creditScore
 * - Lender (single address) reviews each request -> approve/deny
 * - Everything is on-chain for auditability; sensitive PII should be in metadataURI (off-chain)
 */
contract LoanDesk {
    enum Status { Pending, Approved, Denied }

    struct Request {
        uint256 id;
        address borrower;
        uint256 amountInCents;   // keep it chain-agnostic by storing USD cents (for demo)
        string  purpose;
        string  metadataURI;     // link to off-chain JSON with PII/details if needed
        uint16  creditScore;     // supplied by your scoring module
        Status  status;
        uint64  createdAt;
    }

    address public lender;
    uint256 public requestCount;
    mapping (uint256 => Request) public requests;

    event RequestCreated(uint256 indexed id, address indexed borrower, uint256 amountInCents, uint16 creditScore);
    event RequestReviewed(uint256 indexed id, Status newStatus);

    modifier onlyLender() {
        require(msg.sender == lender, "Only lender");
        _;
    }

    constructor(address _lender) {
        require(_lender != address(0), "lender required");
        lender = _lender;
    }

    function createRequest(
        uint256 amountInCents,
        string calldata purpose,
        string calldata metadataURI,
        uint16 creditScore
    ) external returns (uint256) {
        require(amountInCents > 0, "amount > 0");
        require(creditScore > 0, "score required");

        uint256 id = ++requestCount;
        requests[id] = Request({
            id: id,
            borrower: msg.sender,
            amountInCents: amountInCents,
            purpose: purpose,
            metadataURI: metadataURI,
            creditScore: creditScore,
            status: Status.Pending,
            createdAt: uint64(block.timestamp)
        });

        emit RequestCreated(id, msg.sender, amountInCents, creditScore);
        return id;
    }

    function review(uint256 id, bool approve) external onlyLender {
        Request storage r = requests[id];
        require(r.id != 0, "not found");
        require(r.status == Status.Pending, "already decided");

        r.status = approve ? Status.Approved : Status.Denied;
        emit RequestReviewed(id, r.status);
    }

    // ---- Convenience read helpers ----

    function getTotalRequests() external view returns (uint256) {
        return requestCount;
    }

    function getRequest(uint256 id) external view returns (Request memory) {
        return requests[id];
    }

    // For dashboards. O(n) view loops are fine for a school demo, but avoid for production.
    function getPendingRequestIds() external view onlyLender returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i <= requestCount; i++) {
            if (requests[i].status == Status.Pending) count++;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 j;
        for (uint256 i = 1; i <= requestCount; i++) {
            if (requests[i].status == Status.Pending) ids[j++] = i;
        }
        return ids;
    }

    function getBorrowerRequestIds(address borrower) external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i <= requestCount; i++) {
            if (requests[i].borrower == borrower) count++;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 j;
        for (uint256 i = 1; i <= requestCount; i++) {
            if (requests[i].borrower == borrower) ids[j++] = i;
        }
        return ids;
    }
}
