/**
 * A number, written the way the product writes numbers.
 *
 * Pass `currency` and it becomes an amount of money -- symbol, separators
 * and the right number of decimals for that currency, decided by `Intl`
 * rather than by a table here. There is no separate `CurrencyDisplay`,
 * because an amount is a number with a currency and splitting them would
 * mean two components disagreeing about thousands separators.
 *
 *     <NumberDisplay value={row.quantity} decimals={3} />
 *     <NumberDisplay value={row.total} currency={row.currency} />
 *
 * Right-aligned by default when it is an amount: a column of money that
 * does not line up on the decimal point cannot be scanned, and scanning is
 * what a finance screen is for.
 */

import { EMPTY_MARK, formatCurrency, formatNumber, toNumber } from "../formatting";

function NumberDisplay({
  value,
  currency = null,
  locale = undefined,
  decimals = undefined,
  align = currency ? "end" : "auto",
  emptyText = "Not set",
}) {
  const number = toNumber(value);

  if (number === null) {
    return (
      <>
        <span aria-hidden="true">{EMPTY_MARK}</span>
        <span className="erp-visually-hidden">{emptyText}</span>
      </>
    );
  }

  const options =
    decimals === undefined
      ? {}
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };

  const text = currency
    ? formatCurrency(number, currency, { locale, ...options })
    : formatNumber(number, { locale, ...options });

  return (
    <span className={`erp-number erp-number-${align}`}>
      {/* Tabular figures, so digits in a column are the same width and the
          decimal points line up. Purely visual; see the CSS. */}
      {text}
    </span>
  );
}

export default NumberDisplay;
