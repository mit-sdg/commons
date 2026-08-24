export class VoucherInvalid extends Error {
  readonly code = "VOUCHER_INVALID";
}

export class VoucherExpiryInvalid extends Error {
  readonly code = "VOUCHER_EXPIRY_INVALID";
}
