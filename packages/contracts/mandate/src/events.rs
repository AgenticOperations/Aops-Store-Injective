use cosmwasm_std::Event;

pub fn emit_seat_created_event(seat_id: &str, firm_admin: &str, capital: u128) -> Event {
    Event::new("aops.mandate.seat_created")
        .add_attribute("seat_id", seat_id)
        .add_attribute("firm_admin", firm_admin)
        .add_attribute("capital", capital.to_string())
}

pub fn emit_order_approved_event(seat_id: &str, market_id: &str, notional: u128) -> Event {
    Event::new("aops.mandate.order_approved")
        .add_attribute("seat_id", seat_id)
        .add_attribute("market_id", market_id)
        .add_attribute("notional", notional.to_string())
}
