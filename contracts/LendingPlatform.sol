// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./CreditScore.sol";

contract LendingPlatform {
    CreditScore public creditScore;
    address public admin;
    uint256 public nextRequestId;
    uint256 public nextLoanId;
    
    struct LoanRequest {
        uint256 requestId;
        address borrower;
        uint256 amount;
        uint256 interestRate;
        uint256 duration;
        bool isFunded;
    }
    
    struct Loan {
        uint256 loanId;
        address borrower;
        address lender;
        uint256 amount;
        uint256 interestRate;
        uint256 duration;
        uint256 startTime;
        uint256 amountRepaid;
        bool isActive;
    }
    
    mapping(uint256 => LoanRequest) public loanRequests;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;
    mapping(address => uint256[]) public lenderLoans;
    
    event LoanRequested(uint256 indexed requestId, address indexed borrower, uint256 amount);
    event LoanFunded(uint256 indexed loanId, address indexed lender, address indexed borrower);
    event RepaymentMade(uint256 indexed loanId, uint256 amount);
    event LoanCompleted(uint256 indexed loanId);
    
    constructor(address _creditScoreAddress) {
        creditScore = CreditScore(_creditScoreAddress);
        admin = msg.sender;
    }
    
    function requestLoan(uint256 _amount, uint256 _interestRate, uint256 _duration) external {
        require(_amount > 0, "Amount must be greater than 0");
        
        loanRequests[nextRequestId] = LoanRequest({
            requestId: nextRequestId,
            borrower: msg.sender,
            amount: _amount,
            interestRate: _interestRate,
            duration: _duration,
            isFunded: false
        });
        
        emit LoanRequested(nextRequestId, msg.sender, _amount);
        nextRequestId++;
    }
    
    function fundLoan(uint256 _requestId) external payable {
        LoanRequest storage request = loanRequests[_requestId];
        require(!request.isFunded, "Loan already funded");
        require(msg.value >= request.amount, "Insufficient funds");
        require(msg.sender != request.borrower, "Cannot fund your own loan");
        
        request.isFunded = true;
        
        loans[nextLoanId] = Loan({
            loanId: nextLoanId,
            borrower: request.borrower,
            lender: msg.sender,
            amount: request.amount,
            interestRate: request.interestRate,
            duration: request.duration,
            startTime: block.timestamp,
            amountRepaid: 0,
            isActive: true
        });
        
        borrowerLoans[request.borrower].push(nextLoanId);
        lenderLoans[msg.sender].push(nextLoanId);
        
        payable(request.borrower).transfer(request.amount);
        
        emit LoanFunded(nextLoanId, msg.sender, request.borrower);
        nextLoanId++;
    }
    
    function makeRepayment(uint256 _loanId) external payable {
        Loan storage loan = loans[_loanId];
        require(loan.isActive, "Loan not active");
        require(msg.sender == loan.borrower, "Only borrower can repay");
        require(msg.value > 0, "Repayment must be greater than 0");
        
        loan.amountRepaid += msg.value;
        
        uint256 totalOwed = loan.amount + (loan.amount * loan.interestRate / 10000);
        
        if (loan.amountRepaid >= totalOwed) {
            loan.isActive = false;
            emit LoanCompleted(_loanId);
        }
        
        payable(loan.lender).transfer(msg.value);
        emit RepaymentMade(_loanId, msg.value);
    }
    
    function getLoanRequest(uint256 _requestId) external view returns (LoanRequest memory) {
        return loanRequests[_requestId];
    }
    
    function getLoanDetails(uint256 _loanId) external view returns (Loan memory) {
        return loans[_loanId];
    }
}