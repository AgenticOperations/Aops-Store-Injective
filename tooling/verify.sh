#!/bin/bash
set -e
bun tooling/check-boundaries.ts
echo "Boundary verification complete."
