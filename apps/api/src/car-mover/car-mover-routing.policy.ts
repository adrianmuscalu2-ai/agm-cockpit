import { DEFAULT_CAR_MOVER_PROFILE, type RoutingVehicleClass, type VehicleClass } from './car-mover.contract';

export const CAR_MOVER_ROUTING_POLICY_VERSION = 'car-mover-routing-policy.v1';
export const optionalExternalProviders = ['here', 'tollguru'] as const;
export type OptionalExternalProvider = typeof optionalExternalProviders[number];

export type CarMoverRoutingPolicy = {
  contractVersion: typeof CAR_MOVER_ROUTING_POLICY_VERSION;
  vehicleClass: RoutingVehicleClass;
  defaultProfile: typeof DEFAULT_CAR_MOVER_PROFILE;
  routingProfile: 'PASSENGER_CAR_STANDARD'|'EXTENDED_VEHICLE'|'CONFIRMATION_REQUIRED';
  extendedRouting: boolean;
  requiresVehicleConfirmation: boolean;
  routeSourceOrder: readonly ('TOM'|'CACHE'|'VALHALLA'|'MANUAL_CONFIRMATION')[];
  automaticExternalLookupAllowed: false;
  hereRequired: false;
  tollGuruRequired: false;
  safetyState: 'READY'|'CONFIRMATION_REQUIRED';
};

const specialPatterns: ReadonlyArray<[RoutingVehicleClass, RegExp]> = [
  ['CAR_WITH_TRAILER', /\b(?:car\s+with\s+trailer|auto\s+cu\s+remorc[ăa]|pkw\s+mit\s+anh[aä]nger|remorc[ăa]|trailer|anh[aä]nger)\b/i],
  ['TRANSPORTER', /\b(?:car\s+carrier|auto\s*transporter|transporter|abschlepp|tow\s*truck|platform[ăa]\s+auto)\b/i],
  ['TRUCK', /\b(?:truck|lkw|camion|sattelzug|tractor\s*unit|cap\s+tractor)\b/i],
  ['VAN', /\b(?:van|sprinter|transit|crafter|ducato|boxer|jumper)\b/i],
  ['LIGHT_COMMERCIAL', /\b(?:light\s+commercial|utilitar[ăa]|kleintransporter)\b/i],
];
const passengerCarPattern = /\b(?:passenger\s+car|car|auto(?:turism)?|pkw|sedan|saloon|hatchback|coupe|cabrio|suv|estate|wagon|kombi|volkswagen|vw|audi|bmw|mercedes|skoda|seat|opel|ford|toyota|hyundai|kia|renault|peugeot|citro[eë]n|fiat|volvo|tesla|golf)\b/i;

export function classifyCarMoverVehicle(description?: string): RoutingVehicleClass {
  const normalized=description?.trim();
  if(!normalized)return 'UNKNOWN';
  for(const [vehicleClass,pattern] of specialPatterns)if(pattern.test(normalized))return vehicleClass;
  return passengerCarPattern.test(normalized)?'PASSENGER_CAR':'UNKNOWN';
}

export function routingPolicyFor(vehicleClass:RoutingVehicleClass):CarMoverRoutingPolicy {
  if(vehicleClass==='UNKNOWN')return{
    contractVersion:CAR_MOVER_ROUTING_POLICY_VERSION,vehicleClass,defaultProfile:DEFAULT_CAR_MOVER_PROFILE,
    routingProfile:'CONFIRMATION_REQUIRED',extendedRouting:false,requiresVehicleConfirmation:true,routeSourceOrder:[],
    automaticExternalLookupAllowed:false,hereRequired:false,tollGuruRequired:false,safetyState:'CONFIRMATION_REQUIRED',
  };
  const extended=vehicleClass!=='PASSENGER_CAR';
  const legacyUnspecified=vehicleClass==='OTHER_DRIVABLE_VEHICLE';
  return{
    contractVersion:CAR_MOVER_ROUTING_POLICY_VERSION,vehicleClass,defaultProfile:DEFAULT_CAR_MOVER_PROFILE,
    routingProfile:extended?'EXTENDED_VEHICLE':'PASSENGER_CAR_STANDARD',extendedRouting:extended,
    requiresVehicleConfirmation:legacyUnspecified,
    routeSourceOrder:extended?['TOM','CACHE','VALHALLA','MANUAL_CONFIRMATION']:['TOM','CACHE','VALHALLA'],
    automaticExternalLookupAllowed:false,hereRequired:false,tollGuruRequired:false,
    safetyState:legacyUnspecified?'CONFIRMATION_REQUIRED':'READY',
  };
}

export function confirmedRoutingPolicy(vehicleClass:VehicleClass){return routingPolicyFor(vehicleClass);}
