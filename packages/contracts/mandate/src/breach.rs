use cosmwasm_std::Response;
use crate::state::PropSeatState;

pub fn handle_seat_breach(seat: &PropSeatState) -> Response {
    Response::new()
        .add_attribute("action", "seat_breached")
        .add_attribute("seat_id", &seat.seat_id)
        .add_attribute("new_status", "CLOSE_ONLY")
}
