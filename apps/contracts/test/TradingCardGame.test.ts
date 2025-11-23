import { expect } from "chai";
import { ethers } from "hardhat";
import { TradingCardGame } from "../typechain-types";
import { IPyth } from "../typechain-types";

describe("TradingCardGame", function () {
  let tradingCardGame: TradingCardGame;
  let pyth: IPyth;
  let owner: any;
  let player1: any;
  let player2: any;

  // Mock Pyth address (in real tests, you'd deploy or use a testnet Pyth contract)
  const MOCK_PYTH_ADDRESS = "0x0000000000000000000000000000000000000001";
  // Mock HyperlaneCelo address (in real tests, you'd deploy or use a testnet HyperlaneCelo contract)
  const MOCK_HYPERLANE_CELO_ADDRESS = "0x0000000000000000000000000000000000000002";

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    // Deploy TradingCardGame contract
    const TradingCardGameFactory = await ethers.getContractFactory("TradingCardGame");
    tradingCardGame = await TradingCardGameFactory.deploy(MOCK_PYTH_ADDRESS, MOCK_HYPERLANE_CELO_ADDRESS);
    await tradingCardGame.waitForDeployment();
  });

  describe("Game Creation", function () {
    it("Should allow anyone to create a game", async function () {
      const tx = await tradingCardGame.connect(player1).createGame();
      const receipt = await tx.wait();
      
      // Check event was emitted
      expect(receipt?.logs.length).to.be.greaterThan(0);
    });

    it("Should create game in LOBBY status", async function () {
      await tradingCardGame.connect(player1).createGame();
      
      const gameState = await tradingCardGame.getGameState(1);
      expect(gameState.status).to.equal(0); // LOBBY = 0
    });

    it("Should allow players to join a game in LOBBY", async function () {
      await tradingCardGame.connect(player1).createGame();
      await tradingCardGame.connect(player2).joinGame(1);
      
      const gameState = await tradingCardGame.getGameState(1);
      expect(gameState.status).to.equal(0); // Still in LOBBY
      expect(gameState.playerCount).to.equal(2);
    });
  });

  describe("Player Actions", function () {
    beforeEach(async function () {
      await tradingCardGame.connect(player1).createGame();
      await tradingCardGame.connect(player2).joinGame(1);
      // Fast forward past lobby deadline to allow starting the game
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);
      await tradingCardGame.connect(player1).startGame(1, false); // Use insecure randomness for testing
    });

    it("Should automatically generate cards when starting the game", async function () {
      const gameState = await tradingCardGame.getGameState(1);
      expect(gameState.cardCount).to.equal(10);
      expect(gameState.status).to.equal(2); // CHOICE = 2 (cards auto-generated, game in CHOICE phase)
    });

    it("Should allow players to commit choices", async function () {
      const cards = await tradingCardGame.getGameCards(1);
      const selectedCards: [bigint, bigint, bigint] = [
        cards[0],
        cards[1],
        cards[2]
      ];
      
      await tradingCardGame.connect(player1).commitChoices(1, selectedCards);
      
      const choice = await tradingCardGame.getPlayerChoices(1, player1.address);
      expect(choice.committed).to.be.true;
      expect(choice.selectedCards[0]).to.equal(cards[0]);
    });

    it("Should generate cards with secure randomness when starting (static placeholder)", async function () {
      // Create a new game for this test
      await tradingCardGame.connect(player1).createGame();
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);
      await tradingCardGame.connect(player1).startGame(2, true); // Use secure randomness
      
      const gameState = await tradingCardGame.getGameState(2);
      expect(gameState.cardCount).to.equal(10);
      expect(gameState.status).to.equal(2); // CHOICE = 2
      
      const cards = await tradingCardGame.getGameCards(2);
      // Secure randomness currently returns static values
      // This is a placeholder for future Pyth randomness integration
      expect(cards.length).to.equal(10);
    });
  });

  describe("Scoring", function () {
    it("Should track player scores", async function () {
      const score = await tradingCardGame.getPlayerScore(player1.address);
      expect(score.totalPoints).to.equal(0);
      expect(score.gamesPlayed).to.equal(0);
    });
  });

  describe("Constants", function () {
    it("Should have correct point values", async function () {
      expect(await tradingCardGame.POINTS_PRICE_UP_DOWN()).to.equal(10);
      expect(await tradingCardGame.POINTS_PRICE_ABOVE_BELOW()).to.equal(15);
      expect(await tradingCardGame.POINTS_MARKET_CAP_VOLUME()).to.equal(18);
      expect(await tradingCardGame.POINTS_PERCENTAGE_CHANGE()).to.equal(20);
    });

    it("Should have correct duration constants", async function () {
      expect(await tradingCardGame.LOBBY_DURATION()).to.equal(60);
      expect(await tradingCardGame.CHOICE_DURATION()).to.equal(60);
      expect(await tradingCardGame.RESOLUTION_DURATION()).to.equal(600);
    });
  });
});

