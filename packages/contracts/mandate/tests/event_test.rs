use aops_mandate_contract::events::emit_seat_created_event;

#[test]
fn test_seat_created_event() {
    let event = emit_seat_created_event("seat-test", "inj1admin", 1000);
    assert_eq!(event.ty, "aops.mandate.seat_created");
    assert_eq!(event.attributes.len(), 3);
}
