-- Rename notification taxonomy from admin -> landlord for consistency.

UPDATE notification_event_types
SET code = 'landlord_message_posted',
    name = 'Landlord message posted'
WHERE code = 'admin_message_posted';

