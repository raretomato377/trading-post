// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

// 1. Define the minimal IMailbox interface required to send messages
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
}

contract HyperlaneSender is Ownable, IEntropyConsumer {
    // The Hyperlane Mailbox address on Base Mainnet
    // Source: https://docs.hyperlane.xyz/docs/reference/addresses/deployments/mailbox
    address public constant MAILBOX_ADDRESS = 0xeA87ae93Fa0019a82A727bfd3eBd1cFCa8f64f1D;

    // Pyth Entropy address on Base Mainnet
    // Source: https://docs.pyth.network/entropy/contract-addresses
    address public constant ENTROPY_ADDRESS = 0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb;

    IMailbox public mailbox;
    IEntropyV2 public entropy;

    // Struct to track pending entropy requests
    struct EntropyRequest {
        uint32 destinationDomain;
        address recipient;
        uint256 length;
        uint256 hyperlaneValue; // ETH sent for Hyperlane gas
    }

    // Struct for the entropy data sent cross-chain
    struct EntropyData {
        bytes32 randomNumber;
        uint256 entropyLength;
        uint64 sequenceNumber;
        address sourceContract;
    }

    // Mapping from sequence number to entropy request details
    mapping(uint64 => EntropyRequest) public pendingRequests;

    // Events to track sent messages
    event MessageSent(bytes32 indexed messageId, uint32 destinationDomain, address recipient);
    event EntropyRequested(uint64 indexed sequenceNumber, uint32 destinationDomain, address recipient, uint256 length);
    event EntropySent(uint64 indexed sequenceNumber, bytes32 messageId, bytes32 randomNumber);

    constructor() Ownable(msg.sender) {
        mailbox = IMailbox(MAILBOX_ADDRESS);
        entropy = IEntropyV2(ENTROPY_ADDRESS);
    }

    // Required by IEntropyConsumer interface
    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    // Callback function called by Entropy contract with the random number
    function entropyCallback(
        uint64 sequence,
        address, // provider - not used
        bytes32 randomNumber
    ) internal override {
        EntropyRequest memory request = pendingRequests[sequence];
        require(request.destinationDomain != 0, "No pending request for this sequence");

        // Create structured entropy data for clarity on block explorers
        EntropyData memory entropyData = EntropyData({
            randomNumber: randomNumber,
            entropyLength: 32, // bytes32 = 32 bytes
            sequenceNumber: sequence,
            sourceContract: address(this)
        });

        // Convert address to bytes32 for Hyperlane
        bytes32 recipientBytes32 = addressToBytes32(request.recipient);

        // Send the structured entropy data via Hyperlane
        bytes32 messageId = mailbox.dispatch{value: request.hyperlaneValue}(
            request.destinationDomain,
            recipientBytes32,
            abi.encode(entropyData)
        );

        emit EntropySent(sequence, messageId, randomNumber);

        // Clean up the pending request
        delete pendingRequests[sequence];
    }

    /**
     * @notice Get a quote for how much it will cost to request and relay entropy.
     * @dev This is a view function - it costs no gas to call.
     *
     * @param _destinationDomain The Hyperlane Domain ID of the target chain.
     * @param _recipient The address of the contract/wallet receiving the random number.
     * @return The total cost in wei (Entropy fee + Hyperlane gas).
     */
    function quoteEntropyRelay(
        uint32 _destinationDomain,
        address _recipient
    ) external view returns (uint256) {
        uint128 entropyFee = entropy.getFeeV2();

        bytes32 recipientBytes32 = addressToBytes32(_recipient);
        bytes memory dummyMessage = abi.encode(bytes32(0));
        uint256 hyperlaneQuote = mailbox.quoteDispatch(
            _destinationDomain,
            recipientBytes32,
            dummyMessage
        );

        return uint256(entropyFee) + hyperlaneQuote;
    }

    /**
     * @notice Request entropy and relay it to a recipient on a destination chain.
     * @dev Owner only. Requires payment for both Entropy fee and Hyperlane gas.
     *
     * @param _destinationDomain The Hyperlane Domain ID of the target chain.
     * @param _recipient The address of the contract/wallet receiving the random number.
     */
    function requestAndRelayEntropy(
        uint32 _destinationDomain,
        address _recipient
    ) external payable onlyOwner {
        // Calculate required fees
        uint128 entropyFee = entropy.getFeeV2();

        // Estimate Hyperlane cost for sending 32 bytes (the random number)
        bytes32 recipientBytes32 = addressToBytes32(_recipient);
        bytes memory dummyMessage = abi.encode(bytes32(0));
        uint256 hyperlaneQuote = mailbox.quoteDispatch(
            _destinationDomain,
            recipientBytes32,
            dummyMessage
        );

        uint256 totalRequired = uint256(entropyFee) + hyperlaneQuote;
        require(msg.value >= totalRequired, "Insufficient payment");

        // Request entropy from Pyth
        uint64 sequenceNumber = entropy.requestV2{value: entropyFee}();

        // Store the request details for the callback
        pendingRequests[sequenceNumber] = EntropyRequest({
            destinationDomain: _destinationDomain,
            recipient: _recipient,
            length: 32,
            hyperlaneValue: hyperlaneQuote
        });

        emit EntropyRequested(sequenceNumber, _destinationDomain, _recipient, 32);

        // Refund any excess payment
        if (msg.value > totalRequired) {
            payable(msg.sender).transfer(msg.value - totalRequired);
        }
    }

    /**
     * @notice Get a quote for how much it will cost to send a message.
     * @dev This is a view function - it costs no gas to call.
     *
     * @param _destinationDomain The Hyperlane Domain ID of the target chain (e.g., Celo is 42220).
     * @param _recipient The address of the contract/wallet receiving the message on the target chain.
     * @param _message The string message you want to send.
     * @return The cost in wei (native token) required to send this message.
     */
    function quoteSendMessage(
        uint32 _destinationDomain,
        address _recipient,
        string calldata _message
    ) external view returns (uint256) {
        bytes32 recipientBytes32 = addressToBytes32(_recipient);
        bytes memory messageBytes = bytes(_message);

        return mailbox.quoteDispatch(
            _destinationDomain,
            recipientBytes32,
            messageBytes
        );
    }

    /**
     * @notice Sends a string message to a recipient on a destination chain.
     * @dev The caller must send enough native ETH (on Base) to cover the interchain gas fee.
     *      Only the contract owner can call this function.
     *
     * @param _destinationDomain The Hyperlane Domain ID of the target chain (e.g., Optimism is 10).
     * @param _recipient The address of the contract/wallet receiving the message on the target chain.
     * @param _message The string message to send.
     */
    function sendMessage(
        uint32 _destinationDomain,
        address _recipient,
        string calldata _message
    ) external payable onlyOwner {
        // 3. Convert the address to bytes32 (Hyperlane standard format)
        bytes32 recipientBytes32 = addressToBytes32(_recipient);
        bytes memory messageBytes = bytes(_message);

        // 4. Calculate the required fee (gas payment) for the message
        // This ensures the relayer has funds to deliver the message on the destination chain.
        uint256 quote = mailbox.quoteDispatch(
            _destinationDomain,
            recipientBytes32,
            messageBytes
        );

        // 5. Ensure the user sent enough ETH to cover the quote
        require(msg.value >= quote, "Insufficient payment for interchain gas");

        // 6. Dispatch the message
        // We pass the quoted fee as the 'value' for the call
        bytes32 messageId = mailbox.dispatch{value: quote}(
            _destinationDomain,
            recipientBytes32,
            messageBytes
        );

        emit MessageSent(messageId, _destinationDomain, _recipient);

        // 7. Refund any excess payment to the sender
        if (msg.value > quote) {
            payable(msg.sender).transfer(msg.value - quote);
        }
    }

    /**
     * @dev Helper to convert an address to bytes32 (left-padded).
     * Hyperlane requires all recipient addresses to be bytes32.
     */
    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }
}