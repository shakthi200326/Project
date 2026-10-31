/**
 * A button whose content is a symbol.
 *
 * The one rule it exists to enforce: `label` is required and becomes the
 * accessible name. A bare glyph in a button is announced as the glyph --
 * "times", "vertical ellipsis" -- or as nothing at all, and a row of icon
 * buttons becomes a row of unnamed controls. Making the name a required
 * prop is cheaper than finding that in an audit.
 *
 * The same name is the tooltip, so a sighted user who does not recognise
 * the symbol can find out what it does too.
 *
 *     <IconButton label="Remove line" onClick={remove}><Icon name="x" /></IconButton>
 */
function IconButton({
  children,
  label,
  onClick,
  disabled = false,
  variant = "ghost",
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`erp-icon-button erp-icon-button-${variant}`}
      aria-label={label}
      title={label}
    >
      {/* The symbol is decoration once the button has a name -- announcing
          both would read the control out twice. */}
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

export default IconButton;
