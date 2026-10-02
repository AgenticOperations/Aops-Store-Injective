use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::{Item, Map};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub enum SeatStatus {
    Open,
    ChallengeActive,
    Funded,
    Breached,
    Revoked,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct MandateConfig {
    pub allowed_market_ids: Vec<String>,
    pub max_notional_per_order: Uint128,
    pub max_net_leverage: u32,
    pub max_daily_loss_bps: u32,
    pub max_trailing_drawdown_bps: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct PropSeatState {
    pub seat_id: String,
    pub firm_admin: Addr,
    pub agent_id: String,
    pub subaccount_id: String,
    pub status: SeatStatus,
    pub initial_capital: Uint128,
    pub high_water_mark: Uint128,
    pub mandate: MandateConfig,
}

pub const SEATS: Map<&str, PropSeatState> = Map::new("seats");
pub const ADMIN: Item<Addr> = Item::new("admin");
