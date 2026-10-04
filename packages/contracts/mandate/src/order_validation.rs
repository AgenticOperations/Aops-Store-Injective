use cosmwasm_std::Uint128;
use crate::error::ContractError;
use crate::state::MandateConfig;

pub fn validate_order_intent(
    mandate: &MandateConfig,
    market_id: &str,
    quantity: Uint128,
    price: Uint128,
) -> Result<(), ContractError> {
    if !mandate.allowed_market_ids.iter().any(|m| m == market_id) {
        return Err(ContractError::MarketNotAllowed {
            market_id: market_id.to_string(),
        });
    }

    let notional = quantity.u128() * price.u128() / 1_000_000;
    if notional > mandate.max_notional_per_order.u128() {
        return Err(ContractError::OrderExceedsMaxNotional {
            notional,
            limit: mandate.max_notional_per_order.u128(),
        });
    }

    Ok(())
}
