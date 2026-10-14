use cosmwasm_std::Uint128;

pub trait MarkPriceOracle {
    fn get_mark_price(&self, market_id: &str) -> Option<Uint128>;
}

pub struct MockOracle;
impl MarkPriceOracle for MockOracle {
    fn get_mark_price(&self, _market_id: &str) -> Option<Uint128> {
        Some(Uint128::new(25_000_000))
    }
}
