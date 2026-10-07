use cosmwasm_std::Uint128;

pub const BPS_DENOMINATOR: u128 = 10_000;

pub fn calculate_bps(amount: Uint128, bps: u32) -> Uint128 {
    amount.multiply_ratio(bps as u128, BPS_DENOMINATOR)
}
