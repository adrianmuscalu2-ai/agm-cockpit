export const CAR_MOVER_SCOPE = {
  productId: 'agm-car-mover',
  moduleId: 'jobs',
  subjectType: 'CarMoverJob',
  requiredRoles: ['PREMIUM_ACCESS'],
} as const;

export const vehicleClasses = ['PASSENGER_CAR','LIGHT_COMMERCIAL','VAN','TRUCK','TRACTOR_UNIT','OTHER_DRIVABLE_VEHICLE'] as const;
export type VehicleClass = typeof vehicleClasses[number];

export const carMoverStates = ['DRAFT','READY','ASSIGNED','ACCEPTED','IN_PROGRESS','ARRIVED','HANDOVER_PENDING','COMPLETED','CANCELLED','BLOCKED','ESCALATED'] as const;
export type CarMoverState = typeof carMoverStates[number];

const forward: Record<CarMoverState, readonly CarMoverState[]> = {
  DRAFT:['READY','CANCELLED','BLOCKED','ESCALATED'],
  READY:['ASSIGNED','CANCELLED','BLOCKED','ESCALATED'],
  ASSIGNED:['ACCEPTED','CANCELLED','BLOCKED','ESCALATED'],
  ACCEPTED:['IN_PROGRESS','CANCELLED','BLOCKED','ESCALATED'],
  IN_PROGRESS:['ARRIVED','BLOCKED','ESCALATED'],
  ARRIVED:['HANDOVER_PENDING','BLOCKED','ESCALATED'],
  HANDOVER_PENDING:['COMPLETED','BLOCKED','ESCALATED'],
  COMPLETED:[], CANCELLED:[], BLOCKED:[], ESCALATED:[],
};

export function canTransitionCarMoverJob(from: CarMoverState, to: CarMoverState) { return forward[from].includes(to); }

export type CarMoverJobFile = {
  contractVersion:'car-mover-job-file.v1'; productId:'agm-car-mover'; moduleId:'jobs'; subjectType:'CarMoverJob'; subjectId:string;
  job:Record<string,unknown>; vehicle:Record<string,unknown>; timeline:readonly Record<string,unknown>[];
  evidenceReferences:readonly string[]; auditReferences:readonly string[];
};
