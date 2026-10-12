use cosmwasm_std::Uint128;
use aops_mandate_contract::state::MandateConfig;
use aops_mandate_contract::order_validation::validate_order_intent;

#[test]
fn test_notional_boundary_extremes() {
    let mandate = MandateConfig {
        allowed_market_ids: vec!["BTC/USDT".to_string()],
        max_notional_per_order: Uint128::new(10_000_000),
        max_net_leverage: 5,
        max_daily_loss_bps: 500,
        max_trailing_drawdown_bps: 1000,
    };

    let result = validate_order_intent(&mandate, "BTC/USDT", Uint128::new(u128::MAX / 2), Uint128::new(100));
    assert!(result.is_err());
}
