-- Reconcile the three canonical Premium linguist identities that already emit
-- real ComponentHeartbeat telemetry but were absent from the persistent
-- Production registry. This is identity provisioning only; it does not assert
-- runtime health or fabricate an observation.

INSERT INTO "PremiumNetworkRegistryEntry" (
  "id", "companyId", "canonicalId", "kind", "module", "ownerId", "supervisorId", "scope",
  "readPermissions", "writePermissions", "prohibitedActions", "capabilities",
  "humanApprovalBoundary", "telemetryRequirement", "allowedProviders", "fallbackProviders",
  "recoveryPolicy", "lifecycleStatus", "contractVersion", "createdAt", "updatedAt"
)
VALUES
  (
    'a6500000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001',
    'premium-linguist-it', 'AGENT', 'linguistic-agents', 'premium.orchestrator', 'premium.orchestrator', 'premium.linguistic.it',
    '["i18n.catalog.read"]'::jsonb, '[]'::jsonb, '["self.grant-authority","scope.expand","guardian.takeover"]'::jsonb,
    '["validate-source-text","suggest-contextual-correction","protect-operational-terms","adapt-professional-tone","explain-proposed-change"]'::jsonb,
    'Human approval required for irreversible, financial, contractual, or authority-changing actions.',
    'Component heartbeat from deterministic IT catalog audit; APP, Premium, Car Mover, Browser, and Android coverage.',
    '[]'::jsonb, '[]'::jsonb, 'RUNBOOK-ONLY', 'REGISTERED', 'AGM-PREMIUM-NETWORK-V1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'a6500000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000001',
    'premium-linguist-es', 'AGENT', 'linguistic-agents', 'premium.orchestrator', 'premium.orchestrator', 'premium.linguistic.es',
    '["i18n.catalog.read"]'::jsonb, '[]'::jsonb, '["self.grant-authority","scope.expand","guardian.takeover"]'::jsonb,
    '["validate-source-text","suggest-contextual-correction","protect-operational-terms","adapt-professional-tone","explain-proposed-change"]'::jsonb,
    'Human approval required for irreversible, financial, contractual, or authority-changing actions.',
    'Component heartbeat from deterministic ES catalog audit; APP, Premium, Car Mover, Browser, and Android coverage.',
    '[]'::jsonb, '[]'::jsonb, 'RUNBOOK-ONLY', 'REGISTERED', 'AGM-PREMIUM-NETWORK-V1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'a6500000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000001',
    'premium-linguist-sv', 'AGENT', 'linguistic-agents', 'premium.orchestrator', 'premium.orchestrator', 'premium.linguistic.sv',
    '["i18n.catalog.read"]'::jsonb, '[]'::jsonb, '["self.grant-authority","scope.expand","guardian.takeover"]'::jsonb,
    '["validate-source-text","suggest-contextual-correction","protect-operational-terms","adapt-professional-tone","explain-proposed-change"]'::jsonb,
    'Human approval required for irreversible, financial, contractual, or authority-changing actions.',
    'Component heartbeat from deterministic SV catalog audit; APP, Premium, Car Mover, Browser, and Android coverage.',
    '[]'::jsonb, '[]'::jsonb, 'RUNBOOK-ONLY', 'REGISTERED', 'AGM-PREMIUM-NETWORK-V1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("companyId", "canonicalId") DO UPDATE SET
  "kind" = EXCLUDED."kind",
  "module" = EXCLUDED."module",
  "ownerId" = EXCLUDED."ownerId",
  "supervisorId" = EXCLUDED."supervisorId",
  "scope" = EXCLUDED."scope",
  "readPermissions" = EXCLUDED."readPermissions",
  "writePermissions" = EXCLUDED."writePermissions",
  "prohibitedActions" = EXCLUDED."prohibitedActions",
  "capabilities" = EXCLUDED."capabilities",
  "humanApprovalBoundary" = EXCLUDED."humanApprovalBoundary",
  "telemetryRequirement" = EXCLUDED."telemetryRequirement",
  "allowedProviders" = EXCLUDED."allowedProviders",
  "fallbackProviders" = EXCLUDED."fallbackProviders",
  "recoveryPolicy" = EXCLUDED."recoveryPolicy",
  "contractVersion" = EXCLUDED."contractVersion",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "AuthorityScopePolicy" (
  "id", "companyId", "scopeId", "parentScopeId", "ownerId", "resourceOwnership",
  "allowedReadSet", "allowedWriteSet", "contractVersion", "status", "createdAt", "updatedAt"
)
VALUES
  ('a6510000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001', 'premium.linguistic.it', 'premium', 'premium.orchestrator', '{"productId":"agm-premium"}'::jsonb, '["*"]'::jsonb, '[]'::jsonb, 'AGM-PREMIUM-NETWORK-V1', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a6510000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000001', 'premium.linguistic.es', 'premium', 'premium.orchestrator', '{"productId":"agm-premium"}'::jsonb, '["*"]'::jsonb, '[]'::jsonb, 'AGM-PREMIUM-NETWORK-V1', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a6510000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000001', 'premium.linguistic.sv', 'premium', 'premium.orchestrator', '{"productId":"agm-premium"}'::jsonb, '["*"]'::jsonb, '[]'::jsonb, 'AGM-PREMIUM-NETWORK-V1', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("companyId", "scopeId") DO UPDATE SET
  "parentScopeId" = EXCLUDED."parentScopeId",
  "ownerId" = EXCLUDED."ownerId",
  "resourceOwnership" = EXCLUDED."resourceOwnership",
  "allowedReadSet" = EXCLUDED."allowedReadSet",
  "allowedWriteSet" = EXCLUDED."allowedWriteSet",
  "contractVersion" = EXCLUDED."contractVersion",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;
