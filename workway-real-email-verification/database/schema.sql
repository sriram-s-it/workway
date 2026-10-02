-- ============================================================================
-- WORKWAY - RELATIONAL DATABASE SCHEMA (MySQL 8.0+)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `workway` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `workway`;

-- Disable foreign key checks during schema creation
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE
-- Core identity table for ADMIN, DEPARTMENT_HEAD, WORKER, and USER.
-- Normal customer registration strictly assigns role = 'USER'.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(25) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `address` TEXT NOT NULL,
  `role` ENUM('ADMIN', 'DEPARTMENT_HEAD', 'WORKER', 'USER') NOT NULL DEFAULT 'USER',
  `email_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_phone` (`phone`),
  KEY `idx_users_email_verified` (`email_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. DEPARTMENTS TABLE
-- Business rule: Exactly ONE Department Head per department (`head_user_id` UNIQUE).
-- Multiple workers belong to one department.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `head_user_id` BIGINT UNSIGNED NULL,
  `icon` VARCHAR(50) NOT NULL DEFAULT 'Wrench',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_departments_name` (`name`),
  UNIQUE KEY `uq_departments_head_user` (`head_user_id`),
  CONSTRAINT `fk_departments_head_user`
    FOREIGN KEY (`head_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. SERVICES TABLE
-- Fixed-price catalog managed by Admin. Customers cannot alter price.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `services`;
CREATE TABLE `services` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NOT NULL,
  `department_id` INT UNSIGNED NOT NULL,
  `fixed_price` DECIMAL(10, 2) NOT NULL,
  `estimated_duration_minutes` INT UNSIGNED NOT NULL DEFAULT 60,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_services_department` (`department_id`),
  KEY `idx_services_active` (`is_active`),
  CONSTRAINT `fk_services_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. WORKERS TABLE
-- Created and managed by Department Head.
-- Enforces availability state: AVAILABLE or BUSY.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `workers`;
CREATE TABLE `workers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `department_id` INT UNSIGNED NOT NULL,
  `availability` ENUM('AVAILABLE', 'BUSY') NOT NULL DEFAULT 'AVAILABLE',
  `current_status` ENUM('AVAILABLE', 'BUSY') NOT NULL DEFAULT 'AVAILABLE',
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
  `total_ratings_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `completed_jobs` INT UNSIGNED NOT NULL DEFAULT 0,
  `joining_date` DATE NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workers_user_id` (`user_id`),
  KEY `idx_workers_dept_avail` (`department_id`, `availability`),
  KEY `idx_workers_current_status` (`current_status`),
  CONSTRAINT `fk_workers_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_workers_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. WORKER_PROFILES TABLE
-- Extended worker bio, photo uploaded by Department Head, and emergency contacts.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `worker_profiles`;
CREATE TABLE `worker_profiles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `worker_id` BIGINT UNSIGNED NOT NULL,
  `profile_photo` VARCHAR(500) NULL,
  `bio` TEXT NULL,
  `emergency_phone` VARCHAR(25) NULL,
  `experience_years` INT UNSIGNED NOT NULL DEFAULT 1,
  `skills_summary` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_worker_profiles_worker_id` (`worker_id`),
  CONSTRAINT `fk_worker_profiles_worker`
    FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. BOOKINGS TABLE
-- Immediate service booking record with trusted server-side price snapshot.
-- Controlled status state machine with strict state transitions.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `bookings`;
CREATE TABLE `bookings` (
  `id` VARCHAR(36) NOT NULL,
  `booking_number` VARCHAR(32) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `department_id` INT UNSIGNED NOT NULL,
  `service_id` INT UNSIGNED NOT NULL,
  `service_name_snapshot` VARCHAR(150) NOT NULL,
  `service_price` DECIMAL(10, 2) NOT NULL,
  `customer_phone` VARCHAR(25) NOT NULL,
  `service_address` TEXT NOT NULL,
  `description` TEXT NULL,
  `images` JSON NULL,
  `status` ENUM(
    'PENDING_HEAD_APPROVAL',
    'APPROVED',
    'ASSIGNED',
    'WORK_STARTED',
    'WORK_COMPLETED',
    'CUSTOMER_CONFIRMED',
    'PAYMENT_PENDING',
    'PAID',
    'COMPLETED',
    'CANCELLED',
    'CANCELLED_WITH_FEE',
    'REJECTED'
  ) NOT NULL DEFAULT 'PENDING_HEAD_APPROVAL',
  `assigned_worker_id` BIGINT UNSIGNED NULL,
  `assigned_at` TIMESTAMP NULL,
  `work_started_at` TIMESTAMP NULL,
  `work_completed_at` TIMESTAMP NULL,
  `customer_confirmed_at` TIMESTAMP NULL,
  `cancelled_at` TIMESTAMP NULL,
  `cancellation_reason` TEXT NULL,
  `cancellation_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bookings_booking_number` (`booking_number`),
  KEY `idx_bookings_customer` (`customer_id`),
  KEY `idx_bookings_department` (`department_id`),
  KEY `idx_bookings_service` (`service_id`),
  KEY `idx_bookings_worker` (`assigned_worker_id`),
  KEY `idx_bookings_status` (`status`),
  KEY `idx_bookings_created` (`created_at`),
  CONSTRAINT `fk_bookings_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_service`
    FOREIGN KEY (`service_id`) REFERENCES `services` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_worker`
    FOREIGN KEY (`assigned_worker_id`) REFERENCES `workers` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. BOOKING_ASSIGNMENTS TABLE
-- Tracks worker assignments, 10-minute timeout window, and decline reasons.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `booking_assignments`;
CREATE TABLE `booking_assignments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` VARCHAR(36) NOT NULL,
  `worker_id` BIGINT UNSIGNED NOT NULL,
  `assigned_by_head_id` BIGINT UNSIGNED NOT NULL,
  `state` ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'DECLINED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
  `decline_reason` TEXT NULL,
  `timeout_at` TIMESTAMP NOT NULL,
  `responded_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assignments_booking` (`booking_id`),
  KEY `idx_assignments_worker` (`worker_id`),
  KEY `idx_assignments_state` (`state`),
  KEY `idx_assignments_timeout` (`timeout_at`),
  CONSTRAINT `fk_assignments_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_assignments_worker`
    FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_assignments_head`
    FOREIGN KEY (`assigned_by_head_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. BOOKING_STATUS_HISTORY TABLE
-- Audit timeline for every state change in booking lifecycle.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `booking_status_history`;
CREATE TABLE `booking_status_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` VARCHAR(36) NOT NULL,
  `event` VARCHAR(60) NOT NULL,
  `actor_user_id` BIGINT UNSIGNED NULL,
  `actor_role` ENUM('SYSTEM', 'ADMIN', 'DEPARTMENT_HEAD', 'WORKER', 'USER') NOT NULL,
  `previous_status` VARCHAR(50) NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `reason` TEXT NULL,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_history_booking` (`booking_id`),
  KEY `idx_history_actor` (`actor_user_id`),
  KEY `idx_history_created` (`created_at`),
  CONSTRAINT `fk_history_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_history_actor`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. CANCELLATION_RECORDS TABLE
-- Enforces cancellation policies: Free before approval / within 30 min of assignment,
-- and ₹100 fee after 30 min (before work starts).
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `cancellation_records`;
CREATE TABLE `cancellation_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` VARCHAR(36) NOT NULL,
  `cancelled_by_user_id` BIGINT UNSIGNED NOT NULL,
  `cancelled_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` TEXT NOT NULL,
  `minutes_since_assignment` INT NOT NULL DEFAULT 0,
  `cancellation_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `fee_paid` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cancellation_booking` (`booking_id`),
  KEY `idx_cancellation_user` (`cancelled_by_user_id`),
  CONSTRAINT `fk_cancellation_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_cancellation_user`
    FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. PAYMENTS TABLE
-- Real Cashfree transaction records for service payments and cancellation fees.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_reference` VARCHAR(64) NOT NULL,
  `booking_id` VARCHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `payment_type` ENUM('SERVICE_CHARGE', 'CANCELLATION_FEE') NOT NULL DEFAULT 'SERVICE_CHARGE',
  `amount` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `cashfree_order_id` VARCHAR(100) NULL,
  `cashfree_payment_id` VARCHAR(100) NULL,
  `payment_method` VARCHAR(50) NULL,
  `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  `cf_payment_session_id` TEXT NULL,
  `cf_response_data` JSON NULL,
  `paid_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_reference` (`payment_reference`),
  UNIQUE KEY `uq_payments_cf_order` (`cashfree_order_id`),
  KEY `idx_payments_booking` (`booking_id`),
  KEY `idx_payments_user` (`user_id`),
  KEY `idx_payments_status` (`status`),
  CONSTRAINT `fk_payments_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. FEEDBACK TABLE
-- Star rating (1-5) and review submitted strictly once per completed booking.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `feedback`;
CREATE TABLE `feedback` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` VARCHAR(36) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `worker_id` BIGINT UNSIGNED NOT NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `comment` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feedback_booking` (`booking_id`),
  KEY `idx_feedback_worker` (`worker_id`),
  KEY `idx_feedback_customer` (`customer_id`),
  CONSTRAINT `chk_feedback_rating` CHECK (`rating` >= 1 AND `rating` <= 5),
  CONSTRAINT `fk_feedback_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_feedback_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_feedback_worker`
    FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. NOTIFICATIONS TABLE
-- Real-time and persistent in-app notifications for all four roles.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `booking_id` VARCHAR(36) NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read` (`user_id`, `is_read`),
  KEY `idx_notifications_created` (`created_at`),
  CONSTRAINT `fk_notifications_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_notifications_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. EMAIL_VERIFICATIONS TABLE
-- Secure verification codes with expiration, retry limit, and hash storage.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `email_verifications`;
CREATE TABLE `email_verifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `attempts_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `max_attempts` INT UNSIGNED NOT NULL DEFAULT 5,
  `expires_at` TIMESTAMP NOT NULL,
  `is_used` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_verif_user_unused` (`user_id`, `is_used`),
  KEY `idx_email_verif_email` (`email`, `is_used`),
  KEY `idx_email_verif_expires` (`expires_at`),
  CONSTRAINT `fk_email_verif_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 14. AUDIT_LOGS TABLE
-- Tracks sensitive admin actions, CRUD changes with before/after state snapshots.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_user_id` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(50) NOT NULL,
  `old_value` JSON NULL,
  `new_value` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_admin` (`admin_user_id`),
  KEY `idx_audit_entity` (`entity`, `entity_id`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_admin`
    FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
