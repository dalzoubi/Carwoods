-- Phase 1 seed: lookup tables for future maintenance requests + notification catalog.
-- Idempotent: safe to re-run.

-- Service categories (examples; extend via admin API later)
INSERT INTO service_categories (id, code, name, description, active, sort_order)
SELECT gen_random_uuid(), v.code, v.name, v.description, true, v.sort_order
FROM (VALUES
  ('plumbing', 'Plumbing', 'Water, drains, leaks', 10),
  ('hvac', 'HVAC', 'Heating and cooling', 20),
  ('electrical', 'Electrical', 'Outlets, breakers, lighting', 30),
  ('appliances', 'Appliances', 'Provided appliances', 40),
  ('general', 'General', 'Other maintenance', 90)
) AS v(code, name, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM service_categories c WHERE c.code = v.code);

-- Request priorities
INSERT INTO request_priorities (id, code, name, sort_order, active)
SELECT gen_random_uuid(), v.code, v.name, v.sort_order, true
FROM (VALUES
  ('routine', 'Routine', 10),
  ('urgent', 'Urgent', 20),
  ('emergency', 'Emergency', 30)
) AS v(code, name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM request_priorities p WHERE p.code = v.code);

-- Request statuses
INSERT INTO request_statuses (id, code, name, sort_order, system_default, active)
SELECT gen_random_uuid(), v.code, v.name, v.sort_order, v.system_default, true
FROM (VALUES
  ('NOT_STARTED', 'Not started', 10, true),
  ('ACKNOWLEDGED', 'Acknowledged', 20, false),
  ('SCHEDULED', 'Scheduled', 30, false),
  ('WAITING_ON_TENANT', 'Waiting on tenant', 40, false),
  ('WAITING_ON_VENDOR', 'Waiting on vendor', 50, false),
  ('COMPLETE', 'Complete', 60, false),
  ('CANCELLED', 'Cancelled', 70, false)
) AS v(code, name, sort_order, system_default)
WHERE NOT EXISTS (SELECT 1 FROM request_statuses s WHERE s.code = v.code);

-- Notification event type catalog (rules configured separately)
INSERT INTO notification_event_types (id, code, name, active)
SELECT gen_random_uuid(), v.code, v.name, true
FROM (VALUES
  ('request_submitted', 'Request submitted'),
  ('request_status_changed', 'Request status changed'),
  ('admin_message_posted', 'Admin message posted'),
  ('tenant_message_posted', 'Tenant message posted'),
  ('request_completed', 'Request completed'),
  ('invite_sent', 'Invite sent')
) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM notification_event_types t WHERE t.code = v.code);
