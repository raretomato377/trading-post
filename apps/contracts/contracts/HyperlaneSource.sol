// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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

contract HyperlaneSender {
    // 2. The Hyperlane Mailbox address on Base Mainnet
    // Source: https://docs.hyperlane.xyz/docs/reference/addresses/deployments/mailbox
    address public constant MAILBOX_ADDRESS = 0xeA87ae93Fa0019a82A727bfd3eBd1cFCa8f64f1D;

    IMailbox public mailbox;

    // Events to track sent messages
    event MessageSent(bytes32 indexed messageId, uint32 destinationDomain, address recipient);

    constructor() {
        mailbox = IMailbox(MAILBOX_ADDRESS);
    }

    /**
     * @notice Sends a string message to a recipient on a destination chain.
     * @dev The caller must send enough native ETH (on Base) to cover the interchain gas fee.
     * 
     * @param _destinationDomain The Hyperlane Domain ID of the target chain (e.g., Optimism is 10).
     * @param _recipient The address of the contract/wallet receiving the message on the target chain.
     * @param _message The string message to send.
     */
    function sendMessage(
        uint32 _destinationDomain,
        address _recipient,
        string calldata _message
    ) external payable {
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