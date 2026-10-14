export interface RevokeParams {
  seatId: string;
  firmAddress: string;
}

export class SeatRevokeClient {
  formatRevokePayload(params: RevokeParams) {
    return {
      revoke_seat: {
        seat_id: params.seatId,
      }
    };
  }
}
