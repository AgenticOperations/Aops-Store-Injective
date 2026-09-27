# Architecture Boundary Guidelines
To maintain strict non-custodial integrity:
1. Web UI components must never import execution keys or direct database models.
2. Domain types remain strictly pure and decoupled from infrastructure logic.
3. Every order submission must pass through the mandate contract verification.
