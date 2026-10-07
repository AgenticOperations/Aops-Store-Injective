use cosmwasm_std::Uint128;

pub struct PositionSummary {
    pub total_notional: Uint128,
    pub collateral: Uint128,
}

pub fn calculate_effective_leverage(summary: &PositionSummary) -> u32 {
    if summary.collateral.is_zero() {
        return 0;
    }
    (summary.total_notional.u128() / summary.collateral.u128()) as u32
}
