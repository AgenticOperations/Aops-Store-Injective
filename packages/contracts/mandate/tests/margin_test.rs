use cosmwasm_std::Uint128;
use aops_mandate_contract::margin::{calculate_effective_leverage, PositionSummary};

#[test]
fn test_leverage_calculation() {
    let summary = PositionSummary {
        total_notional: Uint128::new(3000),
        collateral: Uint128::new(1000),
    };
    assert_eq!(calculate_effective_leverage(&summary), 3);
}
