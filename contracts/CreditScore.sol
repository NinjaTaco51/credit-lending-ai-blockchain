contract CreditScore {
    struct CreditProfile {
        uint256 score;
        uint256 totalLoans;
        uint256 successfulRepayments;
        uint256 defaultedLoans;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        bool isRegistered;
    }
    
    mapping(address => CreditProfile) public creditProfiles;
    address public admin;
    
    event CreditScoreUpdated(address indexed user, uint256 newScore);
    event UserRegistered(address indexed user);
    
    constructor() {
        admin = msg.sender;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    function registerUser(address _user) external {
        require(!creditProfiles[_user].isRegistered, "Already registered");
        creditProfiles[_user] = CreditProfile({
            score: 500, // Starting score
            totalLoans: 0,
            successfulRepayments: 0,
            defaultedLoans: 0,
            totalBorrowed: 0,
            totalRepaid: 0,
            isRegistered: true
        });
        emit UserRegistered(_user);
    }
    
    function updateCreditScore(address _user, bool _successful, uint256 _amount) external onlyAdmin {
        CreditProfile storage profile = creditProfiles[_user];
        require(profile.isRegistered, "User not registered");
        
        if (_successful) {
            profile.successfulRepayments++;
            profile.totalRepaid += _amount;
            profile.score = min(profile.score + 20, 850);
        } else {
            profile.defaultedLoans++;
            profile.score = max(profile.score - 50, 300);
        }
        
        emit CreditScoreUpdated(_user, profile.score);
    }
    
    function getCreditScore(address _user) external view returns (uint256) {
        return creditProfiles[_user].score;
    }
    
    function min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
    
    function max(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a : b;
    }
}