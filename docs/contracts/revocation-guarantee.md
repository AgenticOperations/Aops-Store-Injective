# Revocation Guarantee
Because trading delegation is managed via the Mandate contract's approval allowance on 0x65,
calling `revoke_seat` immediately disables all order proxying for that subaccount.
Capital remains strictly in the allocator's subaccount, ready for transfer.
