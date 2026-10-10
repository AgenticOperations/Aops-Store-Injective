use cosmwasm_std::{Addr, Response};
use crate::error::ContractError;
use crate::state::{PropSeatState, SeatStatus};

pub fn execute_revoke(
    caller: &Addr,
    seat: &mut PropSeatState,
) -> Result<Response, ContractError> {
    if caller != &seat.firm_admin {
        return Err(ContractError::Unauthorized {});
    }
    seat.status = SeatStatus::Revoked;
    Ok(Response::new()
        .add_attribute("action", "seat_revoked")
        .add_attribute("seat_id", &seat.seat_id))
}
