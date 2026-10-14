use cosmwasm_std::{Addr, Uint128};
use aops_mandate_contract::state::{MandateConfig, PropSeatState, SeatStatus};
use aops_mandate_contract::order_validation::validate_order_intent;
use aops_mandate_contract::per_block_monitor::check_drawdown_breach;

#[test]
fn test_full_mandate_lifecycle() {
    let mut seat = PropSeatState {
        seat_id: "seat-lifecycle".to_string(),
        firm_admin: Addr::unchecked("admin"),
        agent_id: "agent-alpha".to_string(),
        subaccount_id: "0x123".to_string(),
        status: SeatStatus::ChallengeActive,
        initial_capital: Uint128::new(100),
        high_water_mark: Uint128::new(100),
        mandate: MandateConfig {
            allowed_market_ids: vec!["INJ/USDT".to_string()],
            max_notional_per_order: Uint128::new(500),
            max_net_leverage: 3,
            max_daily_loss_bps: 500,
            max_trailing_drawdown_bps: 1000,
        },
    };

    // 1. Submit valid order
    assert!(validate_order_intent(&seat.mandate, "INJ/USDT", Uint128::new(2), Uint128::new(25_000_000)).is_ok());

    // 2. High water mark update on profit
    check_drawdown_breach(&mut seat, Uint128::new(115));
    assert_eq!(seat.high_water_mark, Uint128::new(115));
}
