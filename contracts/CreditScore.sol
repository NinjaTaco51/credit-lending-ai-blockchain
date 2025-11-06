// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract CreditScore {
    struct UserCredit {
        uint256 score;
        uint256 totalLoans;
        uint256 successfulRepayments;
        uint256 missedPayments;
        bool isRegistered;
    }
    
    mapping(address => UserCredit) public userCredits;
    address public admin;
    
    event UserRegistered(address indexed user);
    event CreditScoreUpdated(address indexed user, uint256 newScore);
    
    constructor() {
        admin = msg.sender;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }
    
    function registerUser(address _user) external onlyAdmin {
        require(!userCredits[_user].isRegistered, "User already registered");
        userCredits[_user] = UserCredit({
            score: 500,
            totalLoans: 0,
            successfulRepayments: 0,
            missedPayments: 0,
            isRegistered: true
        });
        emit UserRegistered(_user);
    }
    
    function updateCreditScore(
        address _user,
        uint256 _totalLoans,
        uint256 _successfulRepayments,
        uint256 _missedPayments
    ) external onlyAdmin {
        require(userCredits[_user].isRegistered, "User not registered");
        
        UserCredit storage credit = userCredits[_user];
        credit.totalLoans = _totalLoans;
        credit.successfulRepayments = _successfulRepayments;
        credit.missedPayments = _missedPayments;
        
        uint256 newScore = 500;
        if (_totalLoans > 0) {
            uint256 successRate = (_successfulRepayments * 100) / _totalLoans;
            newScore = 300 + (successRate * 7);
            
            if (_missedPayments > 0) {
                newScore = newScore > (_missedPayments * 50) ? newScore - (_missedPayments * 50) : 0;
            }
            
            if (newScore > 850) newScore = 850;
        }
        
        credit.score = newScore;
        emit CreditScoreUpdated(_user, newScore);
    }
    
    function getCreditScore(address _user) external view returns (uint256) {
        require(userCredits[_user].isRegistered, "User not registered");
        return userCredits[_user].score;
    }
    
    function getUserCredit(address _user) external view returns (UserCredit memory) {
        return userCredits[_user];
    }
}