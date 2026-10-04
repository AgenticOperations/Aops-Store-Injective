use cosmwasm_std::Uint128;
use aops_mandate_contract::state::MandateConfig;
use aops_mandate_contract::order_validation::validate_order_intent;

#[test]
fn test_order_validation_success() {
    let mandate = MandateConfig {
        allowed_market_ids: vec!["INJ/USDT".to_string()],
        max_notional_per_order: Uint128::new(5000_000_000),
        max_net_leverage: 3,
        max_daily_loss_bps: 500,
        max_trailing_drawdown_bps: 1000,
    };

    let result = validate_order_intent(&mandate, "INJ/USDT", Uint128::new(10), Uint128::new(25_000_000));
    assert!(result.is_ok());
}

#[test]
fn test_order_validation_disallowed_market() {
    let mandate = MandateConfig {
        allowed_market_ids: vec!["INJ/USDT".to_string()],
        max_notional_per_order: Uint128::new(5000_000_000),
        max_net_leverage: 3,
        max_daily_loss_bps: 500,
        max_trailing_drawdown_bps: 1000,
    };

    let result = validate_order_intent(&mandate, "BTC/USDT", Uint128::new(1), Uint128::new(60_000_000));
    assert!(result.is_err());
}
