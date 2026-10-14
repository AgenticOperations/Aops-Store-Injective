use cosmwasm_std::{Addr, Uint128};
use aops_mandate_contract::state::{MandateConfig, PropSeatState, SeatStatus};
use aops_mandate_contract::per_block_monitor::check_drawdown_breach;

#[test]
fn test_drawdown_breach_detection() {
    let mut seat = PropSeatState {
        seat_id: "seat-1".to_string(),
        firm_admin: Addr::unchecked("admin"),
        agent_id: "agent-1".to_string(),
        subaccount_id: "0x123".to_string(),
        status: SeatStatus::Funded,
        initial_capital: Uint128::new(1000),
        high_water_mark: Uint128::new(1000),
        mandate: MandateConfig {
            allowed_market_ids: vec!["INJ/USDT".to_string()],
            max_notional_per_order: Uint128::new(5000),
            max_net_leverage: 3,
            max_daily_loss_bps: 500,
            max_trailing_drawdown_bps: 1000, // 10%
        },
    };

    // 8% drop: no breach
    assert!(!check_drawdown_breach(&mut seat, Uint128::new(920)));
    assert_eq!(seat.status, SeatStatus::Funded);

    // 12% drop: triggers breach!
    assert!(check_drawdown_breach(&mut seat, Uint128::new(880)));
    assert_eq!(seat.status, SeatStatus::Breached);
}
