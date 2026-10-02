export type UserRole = 'ADMIN' | 'DEPARTMENT_HEAD' | 'WORKER' | 'USER';

export type BookingStatus =
  | 'PENDING_HEAD_APPROVAL'
  | 'APPROVED'
  | 'ASSIGNED'
  | 'WORK_STARTED'
  | 'WORK_COMPLETED'
  | 'CUSTOMER_CONFIRMED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CANCELLED_WITH_FEE'
  | 'REJECTED';

export type WorkerAvailability = 'AVAILABLE' | 'BUSY';
export type AssignmentState = 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  address?: string;
  role: UserRole;
  email_verified: boolean;
  department_id?: number;
  worker_id?: number;
  created_at?: string;
}

export interface Department {
  id: number;
  name: string;
  description: string;
  head_user_id?: number | null;
  head_name?: string;
  head_email?: string;
  icon: string;
  is_active: number | boolean;
  services_count?: number;
  total_workers?: number;
  available_workers?: number;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  department_id: number;
  department_name?: string;
  fixed_price: number;
  estimated_duration_minutes: number;
  is_active: number | boolean;
}

export interface Worker {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone: string;
  department_id: number;
  department_name?: string;
  availability: WorkerAvailability;
  current_status: WorkerAvailability;
  rating: number;
  total_ratings_count: number;
  completed_jobs: number;
  joining_date: string;
  profile_photo?: string;
  bio?: string;
  experience_years?: number;
}

export interface Booking {
  id: string;
  booking_number: string;
  customer_id: number;
  customer_name?: string;
  customer_email?: string;
  department_id: number;
  department_name?: string;
  department_icon?: string;
  service_id: number;
  service_name_snapshot: string;
  service_price: number;
  customer_phone: string;
  service_address: string;
  description?: string;
  images?: string | string[];
  status: BookingStatus;
  assigned_worker_id?: number | null;
  worker_name?: string;
  worker_phone?: string;
  worker_photo?: string;
  worker_rating?: number;
  assigned_at?: string;
  work_started_at?: string;
  work_completed_at?: string;
  customer_confirmed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  cancellation_fee?: number;
  created_at: string;
  timeline?: TimelineEvent[];
  payment_status?: string;
  feedback?: any;
}

export interface TimelineEvent {
  id: number;
  booking_id: string;
  event: string;
  actor_name?: string;
  actor_role: string;
  previous_status?: string;
  new_status: string;
  reason?: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  booking_id?: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface AssignmentItem {
  assignment_id: number;
  booking_id: string;
  booking_number: string;
  service_name_snapshot: string;
  service_price: number;
  customer_name: string;
  customer_phone: string;
  service_address: string;
  description?: string;
  images?: string;
  state: AssignmentState;
  timeout_at: string;
  assigned_at: string;
}
