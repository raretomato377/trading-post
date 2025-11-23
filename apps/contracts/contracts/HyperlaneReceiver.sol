pragma solidity ^0.8.0;

interface IMailbox {
    function addressToBytes32(address _addr) external pure returns (bytes32);
    function bytes32ToAddress(bytes32 _bytes32) external pure returns (address);
}

contract HyperlaneReceiver {
    // 1. The Mailbox address on the DESTINATION chain (Celo).
    // Source: https://docs.hyperlane.xyz/docs/reference/addresses/deployments/mailbox
    // Celo Chain ID: 42220
    address public constant MAILBOX_ADDRESS = 0x50da3B3907A08a24fe4999F4Dcf337E8dC7954bb; // Celo Mailbox

    // 2. State variable to store the last received message
    string public lastMessage;
    address public lastSender;
    uint32 public lastOriginDomain;

    event ReceivedMessage(uint32 indexed origin, address indexed sender, string message);

    // 3. Modifier to ensure only the Mailbox can call the handle function
    // This prevents malicious users from faking messages by calling handle() directly.
    modifier onlyMailbox() {
        require(msg.sender == MAILBOX_ADDRESS, "Only Mailbox can call");
        _;
    }

    /**
     * @notice Handles an incoming message from the Hyperlane Mailbox.
     * @dev This must match the IMessageRecipient interface signature exactly.
     * 
     * @param _origin The Domain ID of the chain the message came from (e.g., Base is 8453).
     * @param _sender The address of the sender contract on the origin chain (as bytes32).
     * @param _messageBody The raw byte data sent (the encoded string).
     */
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _messageBody
    ) external onlyMailbox {
        // 4. Decode the data
        // Since the sender used `bytes(string)`, we can cast it back directly.
        string memory receivedString = string(_messageBody);
        
        // Convert bytes32 sender back to address for easier readability (optional)
        address senderAddress = bytes32ToAddress(_sender);

        // 5. Application Logic
        // For this example, we just save the data to state
        lastMessage = receivedString;
        lastSender = senderAddress;
        lastOriginDomain = _origin;

        emit ReceivedMessage(_origin, senderAddress, receivedString);
    }

    /**
     * @dev Helper to convert bytes32 back to an Ethereum address.
     * Useful because Hyperlane sends the sender address as bytes32.
     */
    function bytes32ToAddress(bytes32 _buf) internal pure returns (address) {
        return address(uint160(uint256(_buf)));
    }
}