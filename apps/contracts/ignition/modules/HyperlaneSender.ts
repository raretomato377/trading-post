import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const HyperlaneBaseModule = buildModule("HyperlaneBaseModule", (m) => {
  // Pyth Entropy address on Base Mainnet
  // TODO: Replace with actual Pyth Entropy contract address on Base
  const entropyAddress = m.getParameter("entropyAddress", "0x6e7d74fa7d5c90fef9f0512987605a6d546181bb");

  const HyperlaneBase = m.contract("HyperlaneBase", [entropyAddress]);

  return { HyperlaneBase };
});

export default HyperlaneBaseModule;
