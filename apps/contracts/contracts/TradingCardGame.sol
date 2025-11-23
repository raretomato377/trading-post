// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TradingCardGame
 * @notice A game where players select prediction cards and earn points based on market outcomes
 * @dev Uses Pyth Network for price feeds and implements difficulty-based scoring
 */
contract TradingCardGame is Ownable {
    // ============ Constants ============

    uint256 public constant LOBBY_DURATION = 60 seconds; // 60 seconds to join
    uint256 public constant CHOICE_DURATION = 60 seconds; // 1 minute to commit choices
    uint256 public constant RESOLUTION_DURATION = 180 seconds; // 3 minutes for price resolution
    uint256 public constant MIN_PLAYERS = 2; // Minimum players to start game

    // Difficulty-based point values
    uint256 public constant POINTS_PRICE_UP_DOWN = 10;
    uint256 public constant POINTS_PRICE_ABOVE_BELOW = 15;
    uint256 public constant POINTS_MARKET_CAP_VOLUME = 18;
    uint256 public constant POINTS_PERCENTAGE_CHANGE = 20;

    // ============ Enums ============

    enum GameStatus {
        LOBBY, // Waiting for players (60s timer or 2+ players)
        ACTIVE, // Game started, generating cards
        CHOICE, // Players selecting/committing (1 minute)
        RESOLUTION, // Waiting for price resolution (10 minutes)
        ENDED // Game complete, scores calculated
    }

    enum PredictionType {
        PRICE_UP, // 0
        PRICE_DOWN, // 1
        PRICE_ABOVE, // 2
        PRICE_BELOW, // 3
        MARKET_CAP_ABOVE, // 4
        VOLUME_ABOVE, // 5
        PERCENTAGE_CHANGE // 6
    }

    // ============ Structs ============

    struct Game {
        uint256 gameId;
        GameStatus status;
        uint256 startTime;
        uint256 lobbyDeadline;
        uint256 choiceDeadline;
        uint256 resolutionDeadline;
        address[] players;
        uint256[] cards; // Array of 4-digit card numbers
        mapping(address => PlayerChoice) choices;
        mapping(uint256 => PredictionResult) results; // cardNumber => result
        bool resolved;
    }

    struct PlayerChoice {
        address player;
        uint256[3] selectedCards; // 3 card numbers
        uint256 committedAt;
        bool committed;
    }

    struct PredictionResult {
        uint256 cardNumber;
        bool correct;
        uint256 pointsEarned;
    }

    struct PlayerScore {
        address player;
        uint256 totalPoints;
        uint256 gamesPlayed;
        uint256 gamesWon;
    }

    // ============ State Variables ============

    IPyth public immutable pyth;
    uint256 private nextGameId;
    mapping(uint256 => Game) public games;
    mapping(address => PlayerScore) public playerScores;
    address[] public leaderboard; // Top players by total points
    
    // Track which game each player is currently in (0 means not in any game)
    mapping(address => uint256) public playerActiveGame;

    // Asset to Pyth price ID mapping
    // For simplicity, we'll use a mapping from asset index to price ID
    // Frontend will need to provide the correct price IDs when calling updatePricesAndResolve
    mapping(uint256 => bytes32) public assetPriceIds; // assetIndex => priceId

    // ============ Events ============

    event GameStarted(uint256 indexed gameId, address indexed starter);
    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event GameActive(uint256 indexed gameId, uint256[] cards);
    event ChoicesCommitted(
        uint256 indexed gameId,
        address indexed player,
        uint256[3] cards
    );
    event PricesUpdated(uint256 indexed gameId);
    event GameEnded(uint256 indexed gameId);
    event PointsAwarded(
        uint256 indexed gameId,
        address indexed player,
        uint256 points
    );
    event Withdrawn(address indexed recipient, uint256 amount);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        // Pyth contract address on Celo mainnet
        pyth = IPyth(0xff1a0f4744e8582DF1aE09D5611b887B6a12925C);
        nextGameId = 1;
    }

    // ============ Modifiers ============

    modifier validGame(uint256 _gameId) {
        require(_gameId > 0 && _gameId < nextGameId, "Invalid game ID");
        _;
    }

    modifier gameStatus(uint256 _gameId, GameStatus _status) {
        require(games[_gameId].status == _status, "Invalid game status");
        _;
    }

    /**
     * @notice Emergency withdraw function (owner only)
     * @dev Only use this to recover stuck funds
     * @param _amount The amount of ETH to withdraw in wei
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        payable(owner()).transfer(_amount);
        emit Withdrawn(owner(), _amount);
    }

    // ============ Public Functions ============

    /**
     * @notice Create a new game - anyone can call this
     * @dev Creates a new game in LOBBY state with 60s join window
     * @dev Enforces that a player can only be in one active game at a time
     * @return gameId The ID of the newly created game
     */
    function createGame() external returns (uint256) {
        // Check if player is already in an active game
        uint256 currentGameId = playerActiveGame[msg.sender];
        if (currentGameId > 0) {
            Game storage currentGame = games[currentGameId];
            require(
                currentGame.status == GameStatus.ENDED,
                "Already in an active game"
            );
            // Clear the mapping if the game has ended
            playerActiveGame[msg.sender] = 0;
        }

        uint256 gameId = nextGameId++;
        Game storage game = games[gameId];

        game.gameId = gameId;
        game.status = GameStatus.LOBBY; // Initial status, but phase is determined by timestamps
        game.startTime = block.timestamp;
        
        // Calculate ALL deadlines upfront when game is created
        game.lobbyDeadline = block.timestamp + LOBBY_DURATION;
        // Choice phase starts after lobby ends
        game.choiceDeadline = block.timestamp + LOBBY_DURATION + CHOICE_DURATION;
        // Resolution phase starts after choice phase ends
        game.resolutionDeadline = block.timestamp + LOBBY_DURATION + CHOICE_DURATION + RESOLUTION_DURATION;
        
        game.players.push(msg.sender);
        
        // Track that this player is now in this game
        playerActiveGame[msg.sender] = gameId;

        emit GameStarted(gameId, msg.sender);

        return gameId;
    }

    /**
     * @notice Join an existing game in LOBBY state
     * @param _gameId The game ID to join
     * @dev Enforces that a player can only be in one active game at a time
     */
    function joinGame(
        uint256 _gameId
    ) external validGame(_gameId) gameStatus(_gameId, GameStatus.LOBBY) {
        Game storage game = games[_gameId];
        require(block.timestamp <= game.lobbyDeadline, "Lobby closed");

        // Check if player already joined this game
        for (uint256 i = 0; i < game.players.length; i++) {
            require(game.players[i] != msg.sender, "Already joined");
        }

        // Check if player is already in a different active game
        uint256 currentGameId = playerActiveGame[msg.sender];
        if (currentGameId > 0 && currentGameId != _gameId) {
            Game storage currentGame = games[currentGameId];
            require(
                currentGame.status == GameStatus.ENDED,
                "Already in an active game"
            );
            // Clear the mapping if the game has ended
            playerActiveGame[msg.sender] = 0;
        }

        game.players.push(msg.sender);
        
        // Track that this player is now in this game
        playerActiveGame[msg.sender] = _gameId;
        
        emit PlayerJoined(_gameId, msg.sender);
    }

    /**
     * @notice Check if startGame can be called for a game
     * @param _gameId The game ID to check
     * @return canStart True if startGame can be called
     * @return reason Reason why it can't be called (empty if canStart is true)
     */
    function canStartGame(
        uint256 _gameId
    ) external view validGame(_gameId) returns (bool canStart, string memory reason) {
        Game storage game = games[_gameId];
        
        if (game.status != GameStatus.LOBBY) {
            return (false, "Game is not in LOBBY state");
        }
        
        if (block.timestamp < game.lobbyDeadline) {
            return (false, "Lobby deadline not reached");
        }
        
        return (true, "");
    }

    /**
     * @notice Start the game (DEPRECATED - cards are now generated lazily in commitChoices)
     * @param _gameId The game ID to start
     * @param _useSecureRandomness If true, uses secure randomness (placeholder for Pyth randomness). If false, uses block-based randomness.
     * @dev This function is kept for backwards compatibility but does nothing
     *      Cards are automatically generated when first player commits choices
     */
    /**
     * @notice Start the game and generate cards
     * @param _gameId The game ID
     * @param _useSecureRandomness If true, uses secure randomness (placeholder for Pyth randomness). If false, uses block-based randomness.
     * @dev Can be called by anyone after lobby deadline. Generates cards and transitions to CHOICE phase.
     */
    function startGame(
        uint256 _gameId,
        bool _useSecureRandomness
    ) external validGame(_gameId) {
        Game storage game = games[_gameId];
        
        // Validate lobby deadline has passed
        require(
            block.timestamp >= game.lobbyDeadline,
            "Lobby phase not ended yet"
        );
        
        // Validate we haven't passed choice deadline yet
        require(
            block.timestamp < game.choiceDeadline,
            "Choice deadline already passed"
        );
        
        // Validate cards haven't been generated yet
        require(game.cards.length == 0, "Cards already generated");
        
        // Generate cards
        _generateCards(_gameId, _useSecureRandomness);
        
        // Update status to CHOICE
        game.status = GameStatus.CHOICE;
        
        emit GameActive(_gameId, game.cards);
    }

    /**
     * @notice Generate 10 random 4-digit card numbers for the game (internal only)
     * @param _gameId The game ID
     * @param _useSecureRandomness If true, uses secure randomness (placeholder for Pyth randomness). If false, uses block-based randomness.
     * @dev When _useSecureRandomness is false, uses pseudo-random generation based on block data.
     *      When _useSecureRandomness is true, uses secure randomness (currently static, will be upgraded to Pyth randomness).
     */
    function _generateCards(
        uint256 _gameId,
        bool _useSecureRandomness
    ) internal {
        Game storage game = games[_gameId];
        require(game.cards.length == 0, "Cards already generated");

        // Generate 10 random 4-digit numbers (0000-9999)
        if (_useSecureRandomness) {
            _generateCardsSecure(_gameId);
        } else {
            _generateCardsInsecure(_gameId);
        }
    }

    /**
     * @notice Commit player's 3 selected cards
     * @param _gameId The game ID
     * @param _cardNumbers Array of 3 card numbers (4-digit numbers from game.cards)
     * @dev Validates that cards have been generated (game must be started) and we're in CHOICE phase
     */
    function commitChoices(
        uint256 _gameId,
        uint256[3] memory _cardNumbers
    ) external validGame(_gameId) {
        Game storage game = games[_gameId];
        
        // Validate cards have been generated (game must be started)
        require(game.cards.length > 0, "Game not started yet - cards not generated");
        
        // Validate we're in CHOICE phase based on timestamps
        require(
            block.timestamp >= game.lobbyDeadline,
            "Lobby phase not ended yet"
        );
        require(
            block.timestamp < game.choiceDeadline,
            "Choice deadline passed"
        );
        
        require(!game.choices[msg.sender].committed, "Already committed");

        // Verify player is in the game
        bool isPlayer = false;
        for (uint256 i = 0; i < game.players.length; i++) {
            if (game.players[i] == msg.sender) {
                isPlayer = true;
                break;
            }
        }
        require(isPlayer, "Not a player in this game");

        // Verify card numbers are valid (exist in game.cards)
        for (uint256 i = 0; i < 3; i++) {
            bool cardExists = false;
            for (uint256 j = 0; j < game.cards.length; j++) {
                if (game.cards[j] == _cardNumbers[i]) {
                    cardExists = true;
                    break;
                }
            }
            require(cardExists, "Invalid card number");
        }

        // Store choice
        game.choices[msg.sender] = PlayerChoice({
            player: msg.sender,
            selectedCards: _cardNumbers,
            committedAt: block.timestamp,
            committed: true
        });

        emit ChoicesCommitted(_gameId, msg.sender, _cardNumbers);
        
        // Update status to CHOICE if not already set (for consistency)
        if (game.status != GameStatus.CHOICE && game.status != GameStatus.RESOLUTION) {
            game.status = GameStatus.CHOICE;
        }
    }

    /**
     * @notice Transition game from CHOICE to RESOLUTION (DEPRECATED - phase is now timestamp-based)
     * @dev This function is kept for backwards compatibility but does nothing
     *      Phase transitions are now automatic based on timestamps
     */
    function transitionToResolution(
        uint256 _gameId
    ) external validGame(_gameId) {
        // Phase is now determined by timestamps, not explicit transitions
        // This function is a no-op for backwards compatibility
        Game storage game = games[_gameId];
        // Update status for consistency if we're past choice deadline
        if (block.timestamp >= game.choiceDeadline && game.status != GameStatus.ENDED) {
            game.status = GameStatus.RESOLUTION;
        }
    }

    /**
     * @notice Update Pyth prices and resolve predictions
     * @param _gameId The game ID
     * @param _priceUpdateData Array of price update data from Hermes API
     * @param _updateFee Fee to pay for price updates (in wei)
     * @dev This function calls Pyth's updatePriceFeeds, then resolves each prediction
     */
    function updatePricesAndResolve(
        uint256 _gameId,
        bytes[] memory _priceUpdateData,
        bytes32[] memory /* _priceIds */,
        uint256 _updateFee
    )
        external
        payable
        validGame(_gameId)
        gameStatus(_gameId, GameStatus.RESOLUTION)
    {
        Game storage game = games[_gameId];
        require(msg.value >= _updateFee, "Insufficient fee");
        require(!game.resolved, "Already resolved");

        // Update prices on-chain using Pyth
        pyth.updatePriceFeeds{value: _updateFee}(_priceUpdateData);

        emit PricesUpdated(_gameId);

        // Note: Actual price resolution logic would go here
        // For now, we'll mark as resolved. Full resolution happens in endGame
        // This is because we need to compare start prices (at game start) vs end prices (now)
        // We'll need to store start prices when game becomes ACTIVE

        game.resolved = true;
    }

    /**
     * @notice End the game and calculate final scores
     * @param _gameId The game ID
     * @dev Can be called by anyone after resolution deadline. Typically called by keeper bot/cron
     */
    function endGame(uint256 _gameId) external validGame(_gameId) {
        Game storage game = games[_gameId];
        
        // Validate we're past resolution deadline (timestamp-based validation)
        require(
            block.timestamp >= game.resolutionDeadline,
            "Resolution deadline not reached"
        );
        
        // Update status to RESOLUTION if not already set (for consistency)
        if (game.status != GameStatus.RESOLUTION && game.status != GameStatus.ENDED) {
            game.status = GameStatus.RESOLUTION;
        }
        
        // Prevent calling endGame multiple times
        require(game.status != GameStatus.ENDED, "Game already ended");

        // Resolve all predictions and calculate scores
        // For each player, check their selected cards and award points
        for (uint256 i = 0; i < game.players.length; i++) {
            address player = game.players[i];
            PlayerChoice storage choice = game.choices[player];

            if (!choice.committed) continue;

            uint256 playerPoints = 0;

            // Check each selected card
            for (uint256 j = 0; j < 3; j++) {
                uint256 cardNumber = choice.selectedCards[j];

                // If not already resolved, resolve it
                if (!game.results[cardNumber].correct) {
                    // TODO: Implement actual price resolution logic
                    // For now, we'll use a placeholder that needs to be implemented
                    // This requires:
                    // 1. Storing start prices when game becomes ACTIVE
                    // 2. Getting current prices from Pyth
                    // 3. Parsing card number to get prediction type and parameters
                    // 4. Checking if prediction is correct
                    // 5. Awarding points based on difficulty

                    // Placeholder: mark as correct for now (needs full implementation)
                    bool isCorrect = _resolvePrediction(_gameId, cardNumber);
                    uint256 points = isCorrect
                        ? _getPointsForCard(cardNumber)
                        : 0;

                    game.results[cardNumber] = PredictionResult({
                        cardNumber: cardNumber,
                        correct: isCorrect,
                        pointsEarned: points
                    });
                }

                playerPoints += game.results[cardNumber].pointsEarned;
            }

            // Update player's total score
            playerScores[player].totalPoints += playerPoints;
            playerScores[player].gamesPlayed++;
            if (playerPoints > 0) {
                playerScores[player].gamesWon++;
            }

            emit PointsAwarded(_gameId, player, playerPoints);
        }

        // Update game status
        game.status = GameStatus.ENDED;
        
        // Clear player active game mappings for all players in this game
        for (uint256 i = 0; i < game.players.length; i++) {
            if (playerActiveGame[game.players[i]] == _gameId) {
                playerActiveGame[game.players[i]] = 0;
            }
        }

        emit GameEnded(_gameId);
    }

    // ============ View Functions ============

    /**
     * @notice Simple function to verify contract is accessible
     * @return True if contract is working
     */
    function isContractActive() external pure returns (bool) {
        return true;
    }

    /**
     * @notice Diagnostic function to check why endGame might fail
     * @param _gameId The game ID
     * @return canEnd Whether endGame can be called
     * @return reason Reason why it can't be called (empty if canEnd is true)
     * @return gameStatus_ Current game status
     * @return resolutionDeadline_ Resolution deadline timestamp
     * @return currentTime Current block timestamp
     */
    function canEndGame(uint256 _gameId) external view returns (
        bool canEnd,
        string memory reason,
        GameStatus gameStatus_,
        uint256 resolutionDeadline_,
        uint256 currentTime
    ) {
        // Check if game exists
        if (_gameId == 0 || _gameId >= nextGameId) {
            return (false, "Invalid game ID", GameStatus.LOBBY, 0, block.timestamp);
        }

        Game storage game = games[_gameId];
        gameStatus_ = game.status;
        resolutionDeadline_ = game.resolutionDeadline;
        currentTime = block.timestamp;

        // Check game status
        if (game.status != GameStatus.RESOLUTION) {
            return (false, "Game is not in RESOLUTION status", gameStatus_, resolutionDeadline_, currentTime);
        }

        // Check resolution deadline
        if (currentTime < game.resolutionDeadline) {
            return (false, "Resolution deadline not reached", gameStatus_, resolutionDeadline_, currentTime);
        }

        // Check if resolutionDeadline is set (shouldn't be 0)
        if (game.resolutionDeadline == 0) {
            return (false, "Resolution deadline not set (game may not have transitioned properly)", gameStatus_, resolutionDeadline_, currentTime);
        }

        return (true, "", gameStatus_, resolutionDeadline_, currentTime);
    }

    /**
     * @notice Get the current phase of a game based on timestamps
     * @param _gameId The game ID
     * @return phase The current phase (LOBBY, CHOICE, RESOLUTION, or ENDED)
     * @dev Phase is determined by comparing current time to deadlines, not by status field
     */
    function getCurrentPhase(uint256 _gameId) public view validGame(_gameId) returns (GameStatus phase) {
        Game storage game = games[_gameId];
        
        // If game is explicitly ENDED, return ENDED
        if (game.status == GameStatus.ENDED) {
            return GameStatus.ENDED;
        }
        
        uint256 currentTime = block.timestamp;
        
        // Determine phase based on timestamps
        if (currentTime < game.lobbyDeadline) {
            return GameStatus.LOBBY;
        } else if (currentTime < game.choiceDeadline) {
            return GameStatus.CHOICE;
        } else if (currentTime < game.resolutionDeadline) {
            return GameStatus.RESOLUTION;
        } else {
            // Resolution deadline passed, but game not ended yet
            return GameStatus.RESOLUTION; // Still in resolution until endGame is called
        }
    }

    /**
     * @notice Get the next game ID that will be assigned
     * @return The next game ID
     */
    function getNextGameId() external view returns (uint256) {
        return nextGameId;
    }

    /**
     * @notice Get current game state
     * @param _gameId The game ID
     * @return status Current phase (computed from timestamps)
     * @return startTime Game start timestamp
     * @return lobbyDeadline Lobby deadline timestamp
     * @return choiceDeadline Choice deadline timestamp
     * @return resolutionDeadline Resolution deadline timestamp
     * @return playerCount Number of players
     * @return cardCount Number of cards generated
     * @dev Returns the computed phase based on timestamps, not the stored status
     */
    function getGameState(
        uint256 _gameId
    )
        external
        view
        validGame(_gameId)
        returns (
            GameStatus status,
            uint256 startTime,
            uint256 lobbyDeadline,
            uint256 choiceDeadline,
            uint256 resolutionDeadline,
            uint256 playerCount,
            uint256 cardCount
        )
    {
        Game storage game = games[_gameId];
        // Return computed phase based on timestamps
        return (
            getCurrentPhase(_gameId),
            game.startTime,
            game.lobbyDeadline,
            game.choiceDeadline,
            game.resolutionDeadline,
            game.players.length,
            game.cards.length
        );
    }

    /**
     * @notice Get game state with player-specific information
     * @param _gameId The game ID
     * @param _player The player address (can be address(0) if not needed)
     * @return status Game status
     * @return startTime Game start time
     * @return lobbyDeadline Lobby deadline timestamp
     * @return choiceDeadline Choice deadline timestamp
     * @return resolutionDeadline Resolution deadline timestamp
     * @return playerCount Number of players in the game
     * @return cardCount Number of cards generated
     * @return playerHasCommitted Whether the specified player has committed their choices
     * @return playerSelectedCards The player's selected cards (empty if not committed or address(0))
     */
    function getGameStateWithPlayer(
        uint256 _gameId,
        address _player
    )
        external
        view
        validGame(_gameId)
        returns (
            GameStatus status,
            uint256 startTime,
            uint256 lobbyDeadline,
            uint256 choiceDeadline,
            uint256 resolutionDeadline,
            uint256 playerCount,
            uint256 cardCount,
            bool playerHasCommitted,
            uint256[3] memory playerSelectedCards
        )
    {
        Game storage game = games[_gameId];
        
        // Initialize return values
        bool hasCommitted = false;
        uint256[3] memory selectedCards = [uint256(0), uint256(0), uint256(0)];
        
        // Get player-specific data if player address is provided
        if (_player != address(0)) {
            PlayerChoice storage choice = game.choices[_player];
            if (choice.committed) {
                hasCommitted = true;
                selectedCards = choice.selectedCards;
            }
        }
        
        // Return all game state data
        return (
            game.status,
            game.startTime,
            game.lobbyDeadline,
            game.choiceDeadline,
            game.resolutionDeadline,
            game.players.length,
            game.cards.length,
            hasCommitted,
            selectedCards
        );
    }

    /**
     * @notice Get all players in a game
     * @param _gameId The game ID
     * @return Array of player addresses
     */
    function getGamePlayers(
        uint256 _gameId
    ) external view validGame(_gameId) returns (address[] memory) {
        return games[_gameId].players;
    }

    /**
     * @notice Get all cards in a game
     * @param _gameId The game ID
     * @return Array of card numbers
     */
    function getGameCards(
        uint256 _gameId
    ) external view validGame(_gameId) returns (uint256[] memory) {
        return games[_gameId].cards;
    }

    /**
     * @notice Get the active game ID for a player
     * @param _player The player address
     * @return gameId The active game ID (0 if no active game)
     * @dev Returns 0 if player has no active game or if their game has ended
     */
    function getPlayerActiveGame(address _player) external view returns (uint256) {
        uint256 gameId = playerActiveGame[_player];
        if (gameId > 0) {
            Game storage game = games[gameId];
            // Only return gameId if the game is still active (not ENDED)
            if (game.status != GameStatus.ENDED) {
                return gameId;
            }
        }
        return 0;
    }

    /**
     * @notice Get player's committed choices
     * @param _gameId The game ID
     * @param _player The player address
     * @return selectedCards Array of 3 card numbers
     * @return committedAt Timestamp when choices were committed
     * @return committed Whether choices were committed
     */
    function getPlayerChoices(
        uint256 _gameId,
        address _player
    )
        external
        view
        validGame(_gameId)
        returns (
            uint256[3] memory selectedCards,
            uint256 committedAt,
            bool committed
        )
    {
        PlayerChoice storage choice = games[_gameId].choices[_player];
        return (choice.selectedCards, choice.committedAt, choice.committed);
    }

    /**
     * @notice Get prediction result for a card
     * @param _gameId The game ID
     * @param _cardNumber The card number
     * @return correct Whether prediction was correct
     * @return pointsEarned Points earned for this card
     */
    function getPredictionResult(
        uint256 _gameId,
        uint256 _cardNumber
    )
        external
        view
        validGame(_gameId)
        returns (bool correct, uint256 pointsEarned)
    {
        PredictionResult storage result = games[_gameId].results[_cardNumber];
        return (result.correct, result.pointsEarned);
    }

    /**
     * @notice Get player's lifetime score
     * @param _player The player address
     * @return totalPoints Total lifetime points
     * @return gamesPlayed Number of games played
     * @return gamesWon Number of games won
     */
    function getPlayerScore(
        address _player
    )
        external
        view
        returns (uint256 totalPoints, uint256 gamesPlayed, uint256 gamesWon)
    {
        PlayerScore storage score = playerScores[_player];
        return (score.totalPoints, score.gamesPlayed, score.gamesWon);
    }

    /**
     * @notice Get the current price for a single Pyth price feed
     * @param _priceId The Pyth price feed ID
     * @return price The price structure containing price, conf, expo, and publishTime
     * @dev This is a read-only view that gets the latest price from Pyth
     */
    function getFeedPrice(
        bytes32 _priceId
    ) external view returns (PythStructs.Price memory price) {
        return pyth.getPriceUnsafe(_priceId);
    }

    /**
     * @notice Get the current prices for multiple Pyth price feeds
     * @param _priceIds Array of Pyth price feed IDs
     * @return prices Array of price structures, one for each feed
     * @dev This is a read-only view that gets the latest prices from Pyth
     */
    function getFeedPrices(
        bytes32[] memory _priceIds
    ) external view returns (PythStructs.Price[] memory prices) {
        prices = new PythStructs.Price[](_priceIds.length);
        for (uint256 i = 0; i < _priceIds.length; i++) {
            prices[i] = pyth.getPriceUnsafe(_priceIds[i]);
        }
        return prices;
    }

    // ============ Internal Functions ============

    /**
     * @notice Internal function to begin a game
     * @param _gameId The game ID
     */
    function _startGame(uint256 _gameId, bool _useSecureRandomness) internal {
        Game storage game = games[_gameId];
        require(game.status == GameStatus.LOBBY, "Game not in lobby");

        // Generate cards automatically
        _generateCards(_gameId, _useSecureRandomness);

        // Transition directly to CHOICE phase
        game.status = GameStatus.CHOICE;
        game.choiceDeadline = block.timestamp + CHOICE_DURATION;

        emit GameActive(_gameId, game.cards);
    }

    /**
     * @notice Generate cards using insecure block-based randomness
     * @param _gameId The game ID
     * @dev Uses block.timestamp and block.prevrandao for randomness.
     *      This is not cryptographically secure, but sufficient for MVP/testing.
     */
    function _generateCardsInsecure(uint256 _gameId) internal {
        Game storage game = games[_gameId];
        
        // Generate 10 random 4-digit numbers (0000-9999)
        // Using block.timestamp and block.prevrandao for randomness
        // Note: This is not cryptographically secure, but sufficient for MVP
        for (uint256 i = 0; i < 10; i++) {
            uint256 random = uint256(
                keccak256(
                    abi.encodePacked(
                        block.timestamp,
                        block.prevrandao,
                        _gameId,
                        i,
                        msg.sender
                    )
                )
            ) % 10000;
            game.cards.push(random);
        }
    }

    /**
     * @notice Generate cards using secure randomness (placeholder for Pyth randomness)
     * @param _gameId The game ID
     * @dev Currently returns static values as a placeholder.
     *      Will be upgraded to use Pyth Network's randomness oracle in the future.
     */
    function _generateCardsSecure(uint256 _gameId) internal {
        Game storage game = games[_gameId];
        
        // TODO: Replace with Pyth Network randomness oracle
        // For now, use static values as a placeholder
        // This ensures the function signature and flow are ready for Pyth integration
        
        // Static placeholder values (will be replaced with Pyth randomness)
        uint256[10] memory staticCards = [
            uint256(1234),
            uint256(5678),
            uint256(9012),
            uint256(3456),
            uint256(7890),
            uint256(2345),
            uint256(6789),
            uint256(4567),
            uint256(8901),
            uint256(1357)
        ];
        
        for (uint256 i = 0; i < 10; i++) {
            game.cards.push(staticCards[i]);
        }
    }

    /**
     * @notice Resolve a prediction based on card number and price data
     * @return Whether the prediction was correct
     * @dev This is a placeholder - needs full implementation with price comparison
     */
    function _resolvePrediction(
        uint256 /* _gameId */,
        uint256 /* _cardNumber */
    ) internal pure returns (bool) {
        // TODO: Implement full prediction resolution
        // 1. Parse card number to get asset index, prediction type, etc.
        // 2. Get start price (stored when game became ACTIVE)
        // 3. Get end price (from Pyth, already updated)
        // 4. Check prediction based on type:
        //    - PRICE_UP: endPrice > startPrice
        //    - PRICE_DOWN: endPrice < startPrice
        //    - PRICE_ABOVE: endPrice > startPrice * (1 + targetValue)
        //    - PRICE_BELOW: endPrice < startPrice * (1 - targetValue)
        //    - etc.

        // Placeholder: return false for now
        // This needs to be fully implemented with actual price data
        return false;
    }

    /**
     * @notice Get points for a card based on its prediction type
     * @param _cardNumber The 4-digit card number
     * @return Points value for this card
     */
    function _getPointsForCard(
        uint256 _cardNumber
    ) internal pure returns (uint256) {
        // Parse card number to get prediction type
        // cardNumber format: ABCD where:
        // A = target index (0-9)
        // B = direction index (0-9)
        // C = prediction type index (0-9) -> maps to PredictionType enum
        // D = asset index (0-9)

        uint256 predictionTypeIndex = (_cardNumber / 10) % 10;

        // Map to PredictionType enum (0-6)
        PredictionType predType = PredictionType(predictionTypeIndex % 7);

        // Return points based on difficulty
        if (
            predType == PredictionType.PRICE_UP ||
            predType == PredictionType.PRICE_DOWN
        ) {
            return POINTS_PRICE_UP_DOWN;
        } else if (
            predType == PredictionType.PRICE_ABOVE ||
            predType == PredictionType.PRICE_BELOW
        ) {
            return POINTS_PRICE_ABOVE_BELOW;
        } else if (
            predType == PredictionType.MARKET_CAP_ABOVE ||
            predType == PredictionType.VOLUME_ABOVE
        ) {
            return POINTS_MARKET_CAP_VOLUME;
        } else if (predType == PredictionType.PERCENTAGE_CHANGE) {
            return POINTS_PERCENTAGE_CHANGE;
        }

        return 0;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set Pyth price ID for an asset index
     * @param _assetIndex The asset index (0-9)
     * @param _priceId The Pyth price ID (bytes32)
     * @dev This allows configuring which Pyth price feed to use for each asset
     */
    function setAssetPriceId(uint256 _assetIndex, bytes32 _priceId) external {
        // TODO: Add access control (onlyOwner or similar)
        assetPriceIds[_assetIndex] = _priceId;
    }
}
