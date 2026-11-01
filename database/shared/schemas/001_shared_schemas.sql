-- ============================================================================
-- SHARED SCHEMA DDL - POSTGRESQL 16
-- Universal File Storage, Audit Trail, Event Outbox, Notifications
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS shared;

-- 1. Universal Stored Files
CREATE TABLE IF NOT EXISTS shared.stored_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    owner_type VARCHAR(100) NOT NULL,
    owner_id VARCHAR(100) NOT NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'local',
    storage_path VARCHAR(1024) NOT NULL,
    original_filename VARCHAR(512) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_hash CHAR(64) NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stored_files_owner ON shared.stored_files(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_tenant ON shared.stored_files(tenant_id);

-- 2. Immutable Cross-Cutting Audit Log
CREATE TABLE IF NOT EXISTS shared.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    module_code VARCHAR(64) NOT NULL,
    actor_id VARCHAR(150) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    changes JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_resource ON shared.audit_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON shared.audit_events(timestamp DESC);

-- 3. Transactional Event Outbox (Reliable Message Bus)
CREATE TABLE IF NOT EXISTS shared.event_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    event_topic VARCHAR(150) NOT NULL,
    event_key VARCHAR(100),
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) DEFAULT 'PENDING', -- PENDING, PUBLISHED, FAILED
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON shared.event_outbox(status, created_at);

-- 4. Central Notifications
CREATE TABLE IF NOT EXISTS shared.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    recipient_user VARCHAR(150) NOT NULL,
    channel VARCHAR(32) DEFAULT 'IN_APP', -- IN_APP, EMAIL, WEBHOOK, SMS
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'INFO', -- INFO, WARNING, ERROR, SUCCESS
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON shared.notifications(recipient_user, is_read);
