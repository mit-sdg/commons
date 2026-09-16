import { expect, test } from "vite-plus/test";
import { sumDecimals } from "../../src/computations/decimal-sum.ts";

test("sums decimal points without introducing binary addition artifacts", () => {
  expect(sumDecimals([0.1, 0.2])).toBe(0.3);
  expect(sumDecimals([0.29, 1.01])).toBe(1.3);
  expect(sumDecimals(Array(10).fill(0.1))).toBe(1);
  expect(sumDecimals([0.000123, 0.000456])).toBe(0.000579);
});

test("supports scientific notation and the finite number range", () => {
  expect(sumDecimals([1e-7, 2e-7])).toBe(3e-7);
  expect(sumDecimals([1e21, 2e21])).toBe(3e21);
  expect(sumDecimals([Number.MIN_VALUE, Number.MIN_VALUE])).toBe(1e-323);
  expect(sumDecimals([Number.MIN_VALUE, Number.MAX_VALUE])).toBe(Number.MAX_VALUE);
  expect(sumDecimals([Number.MAX_VALUE, Number.MAX_VALUE])).toBe(Infinity);
});

test("handles empty totals, zero, and cancellation", () => {
  expect(sumDecimals([])).toBe(0);
  expect(sumDecimals([0, -0, 0.123456789])).toBe(0.123456789);
  expect(sumDecimals([0.3, -0.1, -0.2])).toBe(0);
});

test("invalid inputs remain invalid for callers' finite-total validation", () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(sumDecimals([1, value])).toBeNaN();
  }
});
