/** Sum the decimal representations of finite numbers, rounding only the final result to a number. */
export function sumDecimals(values: readonly number[]): number {
  let total = BigInt(0);
  let scale = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) return NaN;
    const [mantissa, exponent = "0"] = value.toString().split("e");
    const [integer, fraction = ""] = mantissa!.split(".");
    const valueScale = fraction.length - Number(exponent);
    if (valueScale > scale) {
      total *= BigInt(10) ** BigInt(valueScale - scale);
      scale = valueScale;
    }
    total += BigInt(integer! + fraction) * BigInt(10) ** BigInt(scale - valueScale);
  }
  return Number(`${total}e${-scale}`);
}
