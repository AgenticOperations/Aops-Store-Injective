use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("SeatNotFound: {seat_id}")]
    SeatNotFound { seat_id: String },

    #[error("MarketNotAllowed: {market_id}")]
    MarketNotAllowed { market_id: String },

    #[error("OrderExceedsMaxNotional: notional {notional} > limit {limit}")]
    OrderExceedsMaxNotional { notional: u128, limit: u128 },

    #[error("SeatBreached: account in CloseOnly mode")]
    SeatBreached {},
}
