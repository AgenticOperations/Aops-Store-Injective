use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cosmwasm_std::Uint128;
use crate::state::MandateConfig;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub admin: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    CreateSeat {
        seat_id: String,
        subaccount_id: String,
        initial_capital: Uint128,
        mandate: MandateConfig,
    },
    SubmitOrderIntent {
        seat_id: String,
        market_id: String,
        is_buy: bool,
        quantity: Uint128,
        price: Uint128,
    },
    CheckBlockRisk {
        seat_id: String,
        current_equity: Uint128,
    },
    RevokeSeat {
        seat_id: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetSeat { seat_id: String },
}
