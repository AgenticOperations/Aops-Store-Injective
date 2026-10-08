use cosmwasm_std::Uint128;
use crate::state::{MandateConfig, PropSeatState, SeatStatus};

pub fn check_drawdown_breach(
    seat: &mut PropSeatState,
    current_equity: Uint128,
) -> bool {
    if current_equity > seat.high_water_mark {
        seat.high_water_mark = current_equity;
        return false;
    }

    let loss = seat.high_water_mark.saturating_sub(current_equity);
    let drawdown_bps = (loss.u128() * 10_000) / seat.high_water_mark.u128();

    if drawdown_bps >= seat.mandate.max_trailing_drawdown_bps as u128 {
        seat.status = SeatStatus::Breached;
        return true;
    }

    false
}
