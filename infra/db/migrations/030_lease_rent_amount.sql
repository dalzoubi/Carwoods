-- Optional monthly rent amount on lease (USD; display layer — whole dollars + cents).

ALTER TABLE leases ADD rent_amount DECIMAL(12, 2) NULL;
