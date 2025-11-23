// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Interface that must be implemented to receive entropy callbacks
interface IEntropyCallback {
    function receiveEntropy(bytes32 randomNumber, uint64 sequenceNumber) external;
}

// Interface for requesting entropy from HyperlaneCelo
interface IHyperlaneCelo {
    function requestEntropy() external payable;
    function quoteRequestEntropy() external view returns (uint256);
}

/**
 * @title ExampleEntropyConsumer
 * @notice Example contract showing how to request and receive entropy from HyperlaneCelo
 */
contract ExampleEntropyConsumer is IEntropyCallback {
    // The HyperlaneCelo contract address
    address public hyperlaneCelo;

    // Store the latest entropy received
    bytes32 public lastRandomNumber;
    uint64 public lastSequenceNumber;
    uint256 public entropyRequestCount;

    event EntropyReceived(bytes32 randomNumber, uint64 sequenceNumber);
    event EntropyRequested(uint256 requestNumber);

    constructor(address _hyperlaneCelo) {
        hyperlaneCelo = _hyperlaneCelo;
    }

    /**
     * @notice Request entropy from HyperlaneCelo
     * @dev This function will trigger the cross-chain entropy flow
     */
    function requestRandomness() external payable {
        // Get the quote for how much it costs
        uint256 quote = IHyperlaneCelo(hyperlaneCelo).quoteRequestEntropy();

        // Ensure enough payment was sent
        require(msg.value >= quote, "Insufficient payment");

        // Request the entropy
        IHyperlaneCelo(hyperlaneCelo).requestEntropy{value: quote}();

        entropyRequestCount++;
        emit EntropyRequested(entropyRequestCount);

        // Refund excess payment
        if (msg.value > quote) {
            payable(msg.sender).transfer(msg.value - quote);
        }
    }

    /**
     * @notice Callback function called by HyperlaneCelo when entropy is received
     * @dev This will be called automatically when the entropy arrives
     * @param randomNumber The 32-byte random number from Pyth
     * @param sequenceNumber The Pyth sequence number for this entropy
     */
    function receiveEntropy(bytes32 randomNumber, uint64 sequenceNumber) external override {
        // Only accept callbacks from HyperlaneCelo contract
        require(msg.sender == hyperlaneCelo, "Only HyperlaneCelo can call");

        // Store the entropy
        lastRandomNumber = randomNumber;
        lastSequenceNumber = sequenceNumber;

        emit EntropyReceived(randomNumber, sequenceNumber);

        // TODO: Add your custom logic here
        // For example:
        // - Use the random number for a lottery draw
        // - Generate random NFT traits
        // - Determine game outcomes
        // - etc.
    }

    /**
     * @notice Example: Convert random bytes32 to a number in a range
     * @param max The maximum value (exclusive)
     * @return A random number between 0 and max-1
     */
    function getRandomInRange(uint256 max) public view returns (uint256) {
        require(lastRandomNumber != bytes32(0), "No entropy received yet");
        return uint256(lastRandomNumber) % max;
    }

    /**
     * @notice Example: Generate multiple random numbers from the last entropy
     * @param count How many random numbers to generate
     * @param max The maximum value for each number
     * @return An array of random numbers
     */
    function getMultipleRandom(uint256 count, uint256 max) public view returns (uint256[] memory) {
        require(lastRandomNumber != bytes32(0), "No entropy received yet");
        require(count <= 10, "Max 10 numbers at once");

        uint256[] memory randoms = new uint256[](count);
        bytes32 seed = lastRandomNumber;

        for (uint256 i = 0; i < count; i++) {
            // Hash the seed to get a new random value
            seed = keccak256(abi.encodePacked(seed, i));
            randoms[i] = uint256(seed) % max;
        }

        return randoms;
    }

    /**
     * @notice Allow contract to receive CELO for paying entropy fees
     */
    receive() external payable {}
}
