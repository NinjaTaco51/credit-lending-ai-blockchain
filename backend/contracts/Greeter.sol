// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract Greeter {
    string private greeting;

    event GreetingChanged(address indexed changer, string newGreeting);

    constructor(string memory _greeting) {
        greeting = _greeting;
        emit GreetingChanged(msg.sender, _greeting);
    }

    function greet() external view returns (string memory) {
        return greeting;
    }

    function setGreeting(string calldata _greeting) external {
        greeting = _greeting;
        emit GreetingChanged(msg.sender, _greeting);
    }
}