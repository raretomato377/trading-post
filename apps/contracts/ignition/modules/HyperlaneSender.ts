import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const HyperlaneSenderModule = buildModule("HyperlaneSenderModule", (m) => {
  const hyperlaneSender = m.contract("HyperlaneSender", []);

  return { hyperlaneSender };
});

export default HyperlaneSenderModule;
