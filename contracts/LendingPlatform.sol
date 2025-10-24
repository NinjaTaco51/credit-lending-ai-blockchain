contract LendingPlatform {
    struct Loan {
        address borrower;
        address lender;
        uint256 amount;
        uint256 interestRate; // Basis points (e.g., 500 = 5%)
        uint256 duration; // In seconds
        uint256 startTime;
        uint256 totalRepayment;
        uint256 amountRepaid;
        LoanStatus status;
    }
    
    enum LoanStatus {
        Requested,
        Active,
        Repaid,
        Defaulted
    }
    
    struct LoanRequest {
        address borrower;
        uint256 amount;
        uint256 interestRate;
        uint256 duration;
        bool isActive;
    }
    
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => LoanRequest) public loanRequests;
    uint256 public loanCounter;
    uint256 public requestCounter;
    
    CreditScore public creditScoreContract;
    
    event LoanRequested(uint256 indexed requestId, address indexed borrower, uint256 amount);
    event LoanFunded(uint256 indexed loanId, address indexed lender, address indexed borrower);
    event RepaymentMade(uint256 indexed loanId, uint256 amount);
    event LoanCompleted(uint256 indexed loanId);
    event LoanDefaulted(uint256 indexed loanId);
    
    constructor(address _creditScoreAddress) {
        creditScoreContract = CreditScore(_creditScoreAddress);
    }
    
    // Borrower creates a loan request
    function requestLoan(uint256 _amount, uint256 _interestRate, uint256 _duration) external returns (uint256) {
        require(_amount > 0, "Amount must be > 0");
        require(_duration > 0, "Duration must be > 0");
        
        uint256 creditScore = creditScoreContract.getCreditScore(msg.sender);
        require(creditScore >= 400, "Credit score too low");
        
        uint256 requestId = requestCounter++;
        loanRequests[requestId] = LoanRequest({
            borrower: msg.sender,
            amount: _amount,
            interestRate: _interestRate,
            duration: _duration,
            isActive: true
        });
        
        emit LoanRequested(requestId, msg.sender, _amount);
        return requestId;
    }
    
    // Lender funds a loan request
    function fundLoan(uint256 _requestId) external payable returns (uint256) {
        LoanRequest storage request = loanRequests[_requestId];
        require(request.isActive, "Request not active");
        require(msg.value == request.amount, "Incorrect amount");
        require(msg.sender != request.borrower, "Cannot fund own loan");
        
        // Transfer funds to borrower
        payable(request.borrower).transfer(msg.value);
        
        // Calculate total repayment
        uint256 interest = (request.amount * request.interestRate) / 10000;
        uint256 totalRepayment = request.amount + interest;
        
        // Create loan
        uint256 loanId = loanCounter++;
        loans[loanId] = Loan({
            borrower: request.borrower,
            lender: msg.sender,
            amount: request.amount,
            interestRate: request.interestRate,
            duration: request.duration,
            startTime: block.timestamp,
            totalRepayment: totalRepayment,
            amountRepaid: 0,
            status: LoanStatus.Active
        });
        
        // Deactivate request
        request.isActive = false;
        
        emit LoanFunded(loanId, msg.sender, request.borrower);
        return loanId;
    }
    
    // Borrower makes repayment
    function makeRepayment(uint256 _loanId) external payable {
        Loan storage loan = loans[_loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");
        require(msg.sender == loan.borrower, "Not borrower");
        require(msg.value > 0, "Amount must be > 0");
        
        uint256 remainingAmount = loan.totalRepayment - loan.amountRepaid;
        require(msg.value <= remainingAmount, "Exceeds remaining amount");
        
        loan.amountRepaid += msg.value;
        payable(loan.lender).transfer(msg.value);
        
        emit RepaymentMade(_loanId, msg.value);
        
        // Check if fully repaid
        if (loan.amountRepaid >= loan.totalRepayment) {
            loan.status = LoanStatus.Repaid;
            creditScoreContract.updateCreditScore(loan.borrower, true, loan.amount);
            emit LoanCompleted(_loanId);
        }
    }
    
    // Mark loan as defaulted (can be called by lender after duration expires)
    function markAsDefaulted(uint256 _loanId) external {
        Loan storage loan = loans[_loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");
        require(msg.sender == loan.lender, "Not lender");
        require(block.timestamp > loan.startTime + loan.duration, "Loan not expired");
        require(loan.amountRepaid < loan.totalRepayment, "Loan already repaid");
        
        loan.status = LoanStatus.Defaulted;
        creditScoreContract.updateCreditScore(loan.borrower, false, loan.amount);
        emit LoanDefaulted(_loanId);
    }
    
    // View functions
    function getLoanDetails(uint256 _loanId) external view returns (
        address borrower,
        address lender,
        uint256 amount,
        uint256 interestRate,
        uint256 totalRepayment,
        uint256 amountRepaid,
        uint256 dueDate,
        LoanStatus status
    ) {
        Loan memory loan = loans[_loanId];
        return (
            loan.borrower,
            loan.lender,
            loan.amount,
            loan.interestRate,
            loan.totalRepayment,
            loan.amountRepaid,
            loan.startTime + loan.duration,
            loan.status
        );
    }
    
    function getLoanRequest(uint256 _requestId) external view returns (
        address borrower,
        uint256 amount,
        uint256 interestRate,
        uint256 duration,
        bool isActive
    ) {
        LoanRequest memory request = loanRequests[_requestId];
        return (
            request.borrower,
            request.amount,
            request.interestRate,
            request.duration,
            request.isActive
        );
    }
}