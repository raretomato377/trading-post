#!/bin/bash
# Wrapper script to ensure HARDHAT_DISABLE_TELEMETRY is set before Hardhat runs
export HARDHAT_DISABLE_TELEMETRY=1
exec "$@"

