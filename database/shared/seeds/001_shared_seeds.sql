-- ============================================================================
-- SHARED SEEDS - POSTGRESQL 16
-- Initial File, Notification, and Audit baseline records
-- ============================================================================

-- 1. Initial Notification Broadcast
INSERT INTO shared.notifications (tenant_id, recipient_user, channel, title, message, severity, is_read)
VALUES (
    'default-tenant',
    'system-admin',
    'IN_APP',
    'Ecosystem Infrastructure Initialized',
    'Universal Reusable Business Modules Ecosystem v3.1 successfully configured with PostgreSQL 16 multi-schema engine.',
    'SUCCESS',
    FALSE
);

