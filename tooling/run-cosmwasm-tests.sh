#!/bin/bash
set -e
echo "Running CosmWasm Mandate test suite..."
cargo test --manifest-path packages/contracts/mandate/Cargo.toml
