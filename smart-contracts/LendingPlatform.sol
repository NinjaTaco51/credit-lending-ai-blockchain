// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LendingPlatform {

    // Enums for State Management
    enum LoanType { General, Personal, School }
    enum LoanStatus { Pending, Active, Repaid, Cancelled }

    struct Loan {
        uint256 id;
        address borrower;
        address lender;     // Set to target lender initially, confirmed when funded
        uint256 amount;
        uint256 repaymentAmount;
        uint256 dueDate;
        LoanType loanType;
        LoanStatus status;
    }

    struct LenderProfile {
        bool isRegistered;
        string email;
        bool isSoFiVerified;
    }

    // State Variables
    uint256 public nextLoanId;
    mapping(uint256 => Loan) public loans;
    mapping(address => LenderProfile) public lenders;

    // Tracking loans for dashboards (efficient lookup)
    mapping(address => uint256[]) public borrowerLoanIds;
    mapping(address => uint256[]) public lenderLoanIds;

    // Events
    event LenderRegistered(address indexed lender, string email);
    event LoanRequested(uint256 loanId, address borrower, address targetLender, LoanType loanType);
    event LoanFunded(uint256 loanId, address lender);
    event LoanRepaid(uint256 loanId, address borrower, uint256 amount);

    // --- FEATURE 1: LENDER REGISTRY & SOFI VERIFICATION ---

    // Internal helper to check if string ends with specific suffix
    function _endsWith(string memory str, string memory suffix) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory suffixBytes = bytes(suffix);

        if (strBytes.length < suffixBytes.length) {
            return false;
        }

        for (uint i = 0; i < suffixBytes.length; i++) {
            if (strBytes[strBytes.length - suffixBytes.length + i] != suffixBytes[i]) {
                return false;
            }
        }
        return true;
    }

    // Lenders register here. In a real app, you might verify email via an Oracle.
    function registerLender(string memory _email) external {
        bool isSoFi = _endsWith(_email, "@sofi.com");
        
        lenders[msg.sender] = LenderProfile({
            isRegistered: true,
            email: _email,
            isSoFiVerified: isSoFi
        });

        emit LenderRegistered(msg.sender, _email);
    }

    // --- FEATURE 1 (CONT): BORROWER REQUEST LOGIC ---

    function requestLoan(
        uint256 _amount, 
        uint256 _repaymentAmount, 
        uint256 _durationInDays, 
        LoanType _type,
        address _targetLender // Borrower must specify who they are asking
    ) external {
        require(_amount > 0, "Amount must be greater than 0");
        require(_targetLender != address(0), "Must specify a lender");

        // ENFORCEMENT: If Personal or School, lender MUST be SoFi verified
        if (_type == LoanType.Personal || _type == LoanType.School) {
            require(lenders[_targetLender].isRegistered, "Target lender is not registered");
            require(lenders[_targetLender].isSoFiVerified, "Personal/School loans require a lender with a @sofi.com email");
        }

        loans[nextLoanId] = Loan({
            id: nextLoanId,
            borrower: msg.sender,
            lender: _targetLender, 
            amount: _amount,
            repaymentAmount: _repaymentAmount,
            dueDate: block.timestamp + (_durationInDays * 1 days),
            loanType: _type,
            status: LoanStatus.Pending
        });

        borrowerLoanIds[msg.sender].push(nextLoanId);
        // We track it for the lender immediately so they see the request in their dashboard
        lenderLoanIds[_targetLender].push(nextLoanId);

        emit LoanRequested(nextLoanId, msg.sender, _targetLender, _type);
        nextLoanId++;
    }

    // Lender accepts the specific request
    function fundLoan(uint256 _loanId) external payable {
        Loan storage loan = loans[_loanId];
        
        require(loan.status == LoanStatus.Pending, "Loan not pending");
        require(msg.sender == loan.lender, "Only the targeted lender can fund this loan");
        require(msg.value == loan.amount, "Incorrect funding amount");

        loan.status = LoanStatus.Active;
        
        // Transfer funds to borrower
        payable(loan.borrower).transfer(msg.value);

        emit LoanFunded(_loanId, msg.sender);
    }

    // --- FEATURE 2: BORROWER PAYMENT DASHBOARD LOGIC ---

    function repayLoan(uint256 _loanId) external payable {
        Loan storage loan = loans[_loanId];

        require(loan.status == LoanStatus.Active, "Loan is not active");
        require(msg.value >= loan.repaymentAmount, "Insufficient repayment amount");

        loan.status = LoanStatus.Repaid;

        // Transfer funds back to lender
        payable(loan.lender).transfer(msg.value);

        emit LoanRepaid(_loanId, msg.sender, msg.value);
    }

    // View function for Borrower Dashboard
    function getBorrowerLoans(address _borrower) external view returns (Loan[] memory) {
        uint256[] memory ids = borrowerLoanIds[_borrower];
        Loan[] memory myLoans = new Loan[](ids.length);

        for (uint i = 0; i < ids.length; i++) {
            myLoans[i] = loans[ids[i]];
        }
        return myLoans;
    }

    // --- FEATURE 3: LENDER STATUS DASHBOARD LOGIC ---

    // View function for Lender Dashboard (Shows requests and active loans)
    function getLenderLoans(address _lender) external view returns (Loan[] memory) {
        uint256[] memory ids = lenderLoanIds[_lender];
        Loan[] memory myLoans = new Loan[](ids.length);

        for (uint i = 0; i < ids.length; i++) {
            myLoans[i] = loans[ids[i]];
        }
        return myLoans;
    }
}