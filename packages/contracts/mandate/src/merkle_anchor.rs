use cw_storage_plus::Map;

pub const DAILY_ATTESTATION_ROOTS: Map<u64, String> = Map::new("daily_roots");

pub fn record_daily_root(storage: &mut dyn cosmwasm_std::Storage, day_timestamp: u64, root: String) {
    DAILY_ATTESTATION_ROOTS.save(storage, day_timestamp, &root).unwrap();
}
