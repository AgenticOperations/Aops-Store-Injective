use cosmwasm_std::{Addr, Uint128};
use aops_mandate_contract::state::{MandateConfig, PropSeatState, SeatStatus};
use aops_mandate_contract::revoke::execute_revoke;

#[test]
fn test_revocation_permissions() {
    let admin = Addr::unchecked("firm-admin");
    let attacker = Addr::unchecked("attacker");
    let mut seat = PropSeatState {
        seat_id: "seat-1".to_string(),
        firm_admin: admin.clone(),
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
            max_trailing_drawdown_bps: 1000,
        },
    };

    assert!(execute_revoke(&attacker, &mut seat).is_err());
    assert_eq!(seat.status, SeatStatus::Funded);

    assert!(execute_revoke(&admin, &mut seat).is_ok());
    assert_eq!(seat.status, SeatStatus::Revoked);
}
