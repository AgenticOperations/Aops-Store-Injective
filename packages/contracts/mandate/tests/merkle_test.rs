use cosmwasm_std::testing::mock_dependencies;
use aops_mandate_contract::merkle_anchor::{record_daily_root, DAILY_ATTESTATION_ROOTS};

#[test]
fn test_merkle_root_storage() {
    let mut deps = mock_dependencies();
    record_daily_root(&mut deps.storage, 1729814400, "0xabcdef1234567890".to_string());
    let loaded = DAILY_ATTESTATION_ROOTS.load(&deps.storage, 1729814400).unwrap();
    assert_eq!(loaded, "0xabcdef1234567890");
}
