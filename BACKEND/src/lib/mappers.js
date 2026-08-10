// Maps DB rows (snake_case) to the camelCase shape the frontend's lib/types.ts expects.

function mapEmployee(row) {
  if (!row) return null;
  return {
    id: row.id,
    slNo: row.sl_no,
    name: row.name,
    pfNumber: row.pf_number,
    tokenNo: row.token_no,
    designation: row.designation,
    presentBatch: row.present_batch,
    batchId: row.batch_id ?? undefined,  
    groupType: row.group_type,
    address: row.address,
    phone: row.phone,
    dateOfBirth: row.date_of_birth ?? undefined,
    dateOfJoining: row.date_of_joining ?? undefined,
    status: row.status,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrain(row) {
  if (!row) return null;
  return {
    id: row.id,
    trainNumber: row.train_number,
    trainName: row.train_name,
    // category: row.category,
    pairedTrainId: row.paired_train_id ?? undefined,
    status: row.status,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDutySheet(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    trainIds: row.train_ids ?? [],
    manualTrainNote: row.manual_train_note ?? undefined,
    periodStartDate: row.period_start_date,
    periodEndDate: row.period_end_date,
    days: row.days, // jsonb comes back already parsed
    totalActualHours: Number(row.total_actual_hours),
    totalRosteredHours: Number(row.total_rostered_hours),
    statutoryHours: Number(row.statutory_hours),
    deductionType: row.deduction_type ?? undefined,
    deductionHours: Number(row.deduction_hours),
    otPayable: Number(row.ot_payable),
    isDraft: row.is_draft,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBatch(row, rosterDays = []) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    isDeleted: row.is_deleted,
    rosterConfigured: row.roster_configured, // add
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    days: rosterDays
      .sort((a, b) => a.day_number - b.day_number)
      .map(mapBatchRosterDay),
  };
}

function mapBatchRosterDay(row) {
  if (!row) return null;
  return {
    dayNumber: row.day_number,
    isRestDay: row.is_rest_day,
    slots: row.slots ?? [],
  };
}
function mapDesignation(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, isDeleted: row.is_deleted, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapGroupType(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, isDeleted: row.is_deleted, createdAt: row.created_at, updatedAt: row.updated_at };
}
module.exports = { mapEmployee, mapTrain, mapDutySheet, mapBatch, mapBatchRosterDay, mapDesignation, mapGroupType };
// module.exports = { mapEmployee, mapTrain, mapDutySheet, mapBatch, mapBatchRosterDay };
