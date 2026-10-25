#!/bin/bash
set -e
echo "Running Monte Carlo DSR benchmarks..."
bun test packages/scoring/tests/monte-carlo.test.ts
