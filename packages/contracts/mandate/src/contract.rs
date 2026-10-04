use cosmwasm_std::{
    entry_point, to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult,
};
use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use crate::state::{PropSeatState, SeatStatus, ADMIN, SEATS};
use crate::order_validation::validate_order_intent;

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let admin_addr = msg
        .admin
        .map(|a| deps.api.addr_validate(&a))
        .transpose()?
        .unwrap_or(info.sender);
    ADMIN.save(deps.storage, &admin_addr)?;
    Ok(Response::new().add_attribute("action", "instantiate"))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::CreateSeat { seat_id, subaccount_id, initial_capital, mandate } => {
            let seat = PropSeatState {
                seat_id: seat_id.clone(),
                firm_admin: info.sender,
                agent_id: String::new(),
                subaccount_id,
                status: SeatStatus::Open,
                initial_capital,
                high_water_mark: initial_capital,
                mandate,
            };
            SEATS.save(deps.storage, &seat_id, &seat)?;
            Ok(Response::new().add_attribute("action", "create_seat").add_attribute("seat_id", seat_id))
        }
        ExecuteMsg::SubmitOrderIntent { seat_id, market_id, quantity, price, .. } => {
            let seat = SEATS.load(deps.storage, &seat_id).map_err(|_| ContractError::SeatNotFound { seat_id })?;
            if seat.status == SeatStatus::Breached {
                return Err(ContractError::SeatBreached {});
            }
            validate_order_intent(&seat.mandate, &market_id, quantity, price)?;
            Ok(Response::new()
                .add_attribute("action", "order_approved")
                .add_attribute("market_id", market_id))
        }
        _ => Ok(Response::default()),
    }
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetSeat { seat_id } => {
            let seat = SEATS.load(deps.storage, &seat_id)?;
            to_json_binary(&seat)
        }
    }
}
