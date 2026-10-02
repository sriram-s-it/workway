-- ============================================================================
-- WORKWAY - INITIAL SEED DATA
-- Default Admin, Departments, and Initial Fixed-Price Services
-- Note: bcrypt hash for password 'Admin@WorkWay2026!' is:
-- $2b$10$w0995TzL4Y46zXgBw.91yeoXqf1a8eX5J3/G1gXyP4W9wQ/rG.W46
-- ============================================================================

USE `workway`;

-- Disable foreign key checks during seed
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create Default Super Admin Account
-- Email: demop293@gmail.com
-- Password: Admin@WorkWay2026!
INSERT INTO `users` (`id`, `full_name`, `email`, `phone`, `password_hash`, `address`, `role`, `email_verified`, `is_active`)
VALUES (
  1,
  'System Administrator',
  'demop293@gmail.com',
  '+919876543210',
  '$2a$10$5M8y3yqS87r7p2lYd7fSGOtG7.t70a/7R9P.3v5qJvI8P0rXFh1aW',
  'WORKWAY Central Headquarters, Tech Park Phase 2, Bangalore, Karnataka',
  'ADMIN',
  1,
  1
) ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- 2. Initial Departments
INSERT INTO `departments` (`id`, `name`, `description`, `head_user_id`, `icon`, `is_active`)
VALUES
  (1, 'Electrical & Power Systems', 'Residential and commercial electrical repairs, wiring, breaker fixes, and power installations.', NULL, 'Zap', 1),
  (2, 'Plumbing & Pipe Fitting', 'Emergency leak repair, bathroom fixtures, drain clearance, pipe routing, and sanitary fittings.', NULL, 'Wrench', 1),
  (3, 'HVAC & Air Conditioning', 'Air conditioning servicing, gas refills, deep coil cleaning, heating, and duct maintenance.', NULL, 'Wind', 1),
  (4, 'Home Appliances Repair', 'Washing machine, refrigerator, microwave oven, and kitchen appliance diagnostics & repair.', NULL, 'Cpu', 1),
  (5, 'Carpentry & Woodwork', 'Custom furniture repair, locks, doors, hinges, modular fittings, and interior woodwork.', NULL, 'Hammer', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. Initial Catalog of Fixed-Price Services
-- Fixed prices enforced by system. Customer cannot alter prices.
INSERT INTO `services` (`id`, `name`, `description`, `department_id`, `fixed_price`, `estimated_duration_minutes`, `is_active`)
VALUES
  (1, 'Ceiling Fan Installation & Repair', 'Full diagnostic check, capacitor replacement, mounting, or new fan installation.', 1, 349.00, 45, 1),
  (2, 'Complete Switchboard Diagnostic & Rewiring', 'Short circuit inspection, MCB replacement, and heavy appliance socket installation.', 1, 599.00, 60, 1),
  (3, 'Emergency Water Leak & Tap Replacement', 'High pressure leakage fix, washer replacement, tap mounting, and angle valve renewal.', 2, 299.00, 45, 1),
  (4, 'Deep Drain Unclogging & Jet Clean', 'Drain snakes and organic solvent clearing for kitchen sinks and bathroom lines.', 2, 699.00, 60, 1),
  (5, 'Split AC Foam Jet Deep Service', 'Indoor and outdoor unit pressure foam cleaning, filter sanitation, and airflow testing.', 3, 899.00, 90, 1),
  (6, 'AC Gas Leak Detection & Top-up', 'Nitrogen pressure testing, brazing of pinhole leaks, and eco refrigerant charging.', 3, 1499.00, 120, 1),
  (7, 'Refrigerator Cooling Diagnostic & Repair', 'Compressor relay check, thermostat adjustment, defrost timer, and coil maintenance.', 4, 749.00, 60, 1),
  (8, 'Door Lock Repair & Handle Fitting', 'Precision mortise lock replacement, latch adjustments, and hinge lubrication.', 5, 449.00, 45, 1)
ON DUPLICATE KEY UPDATE `fixed_price` = VALUES(`fixed_price`);

SET FOREIGN_KEY_CHECKS = 1;
