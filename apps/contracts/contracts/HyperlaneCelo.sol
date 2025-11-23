pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

// Interface that contracts must implement to receive entropy callbacks
interface IEntropyCallback {
    /**
     * @notice Called when entropy is received
     * @param randomNumber The 32-byte random number from Pyth
     * @param sequenceNumber The Pyth sequence number for this entropy
     */
    function receiveEntropy(bytes32 randomNumber, uint64 sequenceNumber) external;
}

interface IMailbox {
    function dispatch(
        uint32 _destinationDomain,
        bytes32 _recipientAddress,
        bytes calldata _messageBody
    ) external payable returns (bytes32);

    function quoteDispatch(
        uint32 _destinationDomain,
        bytes32 _recipientAddress,
        bytes calldata _messageBody
    ) external view returns (uint256);

    function addressToBytes32(address _addr) external pure returns (bytes32);
    function bytes32ToAddress(bytes32 _bytes32) external pure returns (address);
}

contract HyperlaneCelo is Ownable {
    // 1. The Mailbox address on the DESTINATION chain (Celo).
    // Source: https://docs.hyperlane.xyz/docs/reference/addresses/deployments/mailbox
    // Celo Chain ID: 42220
    address public constant MAILBOX_ADDRESS = 0x50da3B3907A08a24fe4999F4Dcf337E8dC7954bb; // Celo Mailbox

    IMailbox public mailbox;

    // Source chain configuration (Base is domain 8453)
    uint32 public sourceDomain;
    address public sourceContract;

    // Access control: only this contract can request entropy
    address public allowedRequester;

    // Struct for the entropy data received cross-chain
    struct EntropyData {
        bytes32 randomNumber;
        uint256 entropyLength;
        uint64 sequenceNumber;
        address sourceContract;
        address requester; // The original requester who should receive the callback
    }

    // 2. State variable to store the last received entropy data
    EntropyData public lastEntropyData;
    address public lastSender;
    uint32 public lastOriginDomain;

    event ReceivedMessage(
        uint32 indexed origin,
        address indexed sender,
        bytes32 randomNumber,
        uint256 entropyLength,
        uint64 sequenceNumber,
        address sourceContract,
        address requester
    );

    event EntropyRequested(address indexed requester, bytes32 messageId);
    event EntropyCallbackSent(address indexed requester, bytes32 randomNumber, uint64 sequenceNumber);
    event EntropyCallbackFailed(address indexed requester, bytes reason);
    event AllowedRequesterUpdated(address indexed oldRequester, address indexed newRequester);
    event SourceConfigUpdated(uint32 sourceDomain, address sourceContract);

    constructor(uint32 _sourceDomain, address _sourceContract) Ownable(msg.sender) {
        mailbox = IMailbox(MAILBOX_ADDRESS);
        sourceDomain = _sourceDomain;
        sourceContract = _sourceContract;
    }

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
     * @param _messageBody The raw byte data sent (the encoded EntropyData struct).
     */
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _messageBody
    ) external onlyMailbox {
        // 4. Decode the entropy data
        // The sender used `abi.encode(entropyData)`, so we decode it back to the struct
        EntropyData memory entropyData = abi.decode(_messageBody, (EntropyData));

        // Convert bytes32 sender back to address for easier readability
        address senderAddress = bytes32ToAddress(_sender);

        // 5. Application Logic
        // Save the entropy data to state
        lastEntropyData = entropyData;
        lastSender = senderAddress;
        lastOriginDomain = _origin;

        emit ReceivedMessage(
            _origin,
            senderAddress,
            entropyData.randomNumber,
            entropyData.entropyLength,
            entropyData.sequenceNumber,
            entropyData.sourceContract,
            entropyData.requester
        );

        // 6. Callback to the original requester if it's a contract
        // Check if the requester address has code (is a contract)
        if (_isContract(entropyData.requester)) {
            try IEntropyCallback(entropyData.requester).receiveEntropy(
                entropyData.randomNumber,
                entropyData.sequenceNumber
            ) {
                emit EntropyCallbackSent(
                    entropyData.requester,
                    entropyData.randomNumber,
                    entropyData.sequenceNumber
                );
            } catch (bytes memory reason) {
                // Callback failed, but don't revert - just emit event
                emit EntropyCallbackFailed(entropyData.requester, reason);
            }
        }
    }

    /**
     * @notice Request new entropy from the source chain
     * @dev Only callable by the allowed requester contract. Requires payment for Hyperlane gas.
     */
    function requestEntropy() external payable onlyAllowedRequester {
        require(sourceContract != address(0), "Source contract not set");
        require(sourceDomain != 0, "Source domain not set");

        // Convert recipient address to bytes32
        bytes32 recipientBytes32 = addressToBytes32(sourceContract);

        // Create a simple request message (could be expanded to include parameters)
        bytes memory messageBytes = abi.encode(msg.sender);

        // Get quote for sending the message
        uint256 quote = mailbox.quoteDispatch(
            sourceDomain,
            recipientBytes32,
            messageBytes
        );

        require(msg.value >= quote, "Insufficient payment for interchain gas");

        // Send the entropy request to the source chain
        bytes32 messageId = mailbox.dispatch{value: quote}(
            sourceDomain,
            recipientBytes32,
            messageBytes
        );

        emit EntropyRequested(msg.sender, messageId);

        // Refund excess payment
        if (msg.value > quote) {
            payable(msg.sender).transfer(msg.value - quote);
        }
    }

    /**
     * @notice Get a quote for how much it will cost to request entropy
     * @return The cost in wei required to request entropy
     */
    function quoteRequestEntropy() external view returns (uint256) {
        require(sourceContract != address(0), "Source contract not set");
        require(sourceDomain != 0, "Source domain not set");

        bytes32 recipientBytes32 = addressToBytes32(sourceContract);
        bytes memory messageBytes = abi.encode(msg.sender);

        return mailbox.quoteDispatch(
            sourceDomain,
            recipientBytes32,
            messageBytes
        );
    }

    /**
     * @notice Modifier to restrict function access to only the allowed requester contract
     */
    modifier onlyAllowedRequester() {
        require(msg.sender == allowedRequester, "Only allowed requester can call");
        _;
    }

    /**
     * @notice Set the allowed requester contract address (only owner)
     * @param _allowedRequester The address of the contract allowed to request entropy
     */
    function setAllowedRequester(address _allowedRequester) external onlyOwner {
        address oldRequester = allowedRequester;
        allowedRequester = _allowedRequester;
        emit AllowedRequesterUpdated(oldRequester, _allowedRequester);
    }

    /**
     * @notice Update the source chain configuration (only owner)
     * @param _sourceDomain The Hyperlane domain ID of the source chain
     * @param _sourceContract The address of the HyperlaneSource contract
     */
    function setSourceConfig(uint32 _sourceDomain, address _sourceContract) external onlyOwner {
        sourceDomain = _sourceDomain;
        sourceContract = _sourceContract;
        emit SourceConfigUpdated(_sourceDomain, _sourceContract);
    }

    /**
     * @dev Helper to convert bytes32 back to an Ethereum address.
     * Useful because Hyperlane sends the sender address as bytes32.
     */
    function bytes32ToAddress(bytes32 _buf) internal pure returns (address) {
        return address(uint160(uint256(_buf)));
    }

    /**
     * @dev Helper to convert an address to bytes32 (left-padded).
     */
    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    /**
     * @dev Check if an address is a contract
     */
    function _isContract(address _addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(_addr)
        }
        return size > 0;
    }
}