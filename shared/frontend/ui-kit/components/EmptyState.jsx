function EmptyState({ title, description = null, action = null }) {
  return (
    <div className="erp-empty">
      <p className="erp-empty-title">{title}</p>
      {description && <p className="erp-empty-description">{description}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
