export type Designation = "Asst" | "Tech-I" | "Tech-II" | "Tech-III" | "Sr.Tech" | "Helper" | string;
export type GroupType = "A" | "B" | "C" | "D" | "E" | "F";
export type TrainCategory = "Vande Bharat" | "Rajdhani" | "Shatabdi" | string;

export interface Employee {
  id: string;
  slNo: number;
  name: string;
  pfNumber: string;
  tokenNo: string;
  designation: Designation;
  presentBatch: string;
  groupType: GroupType;
  address: string;
  phone: string;
  dateOfBirth?: string;
  dateOfJoining?: string;
  status: "active" | "inactive";
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Train {
  id: string;
  trainNumber: string;
  trainName: string;
  category: TrainCategory;
  pairedTrainId?: string;
  status: "active" | "inactive";
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  from: string;
  to: string;
}

export type LeaveType = "None" | "CR" | "CL" | "LAP" | "NH" | "PL" | "SCL" | "Sick";

export interface DutyDay {
  date: string;
  dayName: string;
  isRestDay: boolean;
  rosteredSlots: TimeSlot[];
  rosteredHours: number;
  actualSlots: TimeSlot[];
  actualHours: number;
  extraHours: number;
  description: string;
  leave?: LeaveType;
}

/** Kept for back-compat with older stored sheets. */
export type DeductionType = "none" | "CR" | "CL_LAP_NH_PL_SCL_SICK";

export interface DutySheet {
  id: string;
  employeeId: string;
  trainIds: string[];
  manualTrainNote?: string;
  periodStartDate: string;
  periodEndDate: string;
  days: DutyDay[];
  totalActualHours: number;
  totalRosteredHours: number;
  statutoryHours: number;
  /** Legacy: kept for old records; new sheets rely on per-day `leave`. */
  deductionType?: DeductionType;
  deductionHours: number;
  otPayable: number;
  isDraft?: boolean;
  createdAt: string;
  updatedAt: string;
}
