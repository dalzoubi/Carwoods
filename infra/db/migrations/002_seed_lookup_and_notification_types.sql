-- Phase 1 seed: lookup tables for future maintenance requests + notification catalog.
-- Idempotent: safe to re-run (MERGE with WHEN NOT MATCHED only).

-- Service categories
MERGE service_categories AS target
USING (VALUES
  ('plumbing',    'Plumbing',    'Water, drains, leaks',          10),
  ('hvac',        'HVAC',        'Heating and cooling',           20),
  ('electrical',  'Electrical',  'Outlets, breakers, lighting',   30),
  ('appliances',  'Appliances',  'Provided appliances',           40),
  ('general',     'General',     'Other maintenance',             90)
) AS src (code, name, description, sort_order)
  ON target.code = src.code
WHEN NOT MATCHED THEN
  INSERT (id, code, name, description, active, sort_order)
  VALUES (NEWID(), src.code, src.name, src.description, 1, src.sort_order);

-- Request priorities
MERGE request_priorities AS target
USING (VALUES
  ('routine',   'Routine',   10),
  ('urgent',    'Urgent',    20),
  ('emergency', 'Emergency', 30)
) AS src (code, name, sort_order)
  ON target.code = src.code
WHEN NOT MATCHED THEN
  INSERT (id, code, name, sort_order, active)
  VALUES (NEWID(), src.code, src.name, src.sort_order, 1);

-- Request statuses
MERGE request_statuses AS target
USING (VALUES
  ('NOT_STARTED',       'Not started',       10, 1),
  ('ACKNOWLEDGED',      'Acknowledged',       20, 0),
  ('SCHEDULED',         'Scheduled',          30, 0),
  ('WAITING_ON_TENANT', 'Waiting on tenant',  40, 0),
  ('WAITING_ON_VENDOR', 'Waiting on vendor',  50, 0),
  ('COMPLETE',          'Complete',           60, 0),
  ('CANCELLED',         'Cancelled',          70, 0)
) AS src (code, name, sort_order, system_default)
  ON target.code = src.code
WHEN NOT MATCHED THEN
  INSERT (id, code, name, sort_order, system_default, active)
  VALUES (NEWID(), src.code, src.name, src.sort_order, src.system_default, 1);

-- Notification event type catalog
MERGE notification_event_types AS target
USING (VALUES
  ('request_submitted',      'Request submitted'),
  ('request_status_changed', 'Request status changed'),
  ('landlord_message_posted','Landlord message posted'),
  ('tenant_message_posted',  'Tenant message posted'),
  ('request_completed',      'Request completed'),
  ('invite_sent',            'Invite sent')
) AS src (code, name)
  ON target.code = src.code
WHEN NOT MATCHED THEN
  INSERT (id, code, name, active)
  VALUES (NEWID(), src.code, src.name, 1);
