import { premiumNetworkSeed } from '../src/authority-control-plane/premium-network.seed';
import { classifyCarMoverVehicle, routingPolicyFor } from '../src/car-mover/car-mover-routing.policy';

describe('Car Mover routing policy',()=>{
  it.each([
    ['Volkswagen Golf','PASSENGER_CAR'],
    ['car with trailer','CAR_WITH_TRAILER'],
    ['auto transporter','TRANSPORTER'],
    ['Mercedes Sprinter','VAN'],
    ['40t truck','TRUCK'],
    ['unclassified vehicle','UNKNOWN'],
  ])('classifies %s as %s',(description,expected)=>expect(classifyCarMoverVehicle(description)).toBe(expected));

  it('uses passenger car as standard and activates the extended profile only conditionally',()=>{
    expect(routingPolicyFor('PASSENGER_CAR')).toMatchObject({routingProfile:'PASSENGER_CAR_STANDARD',extendedRouting:false,requiresVehicleConfirmation:false,automaticExternalLookupAllowed:false,hereRequired:false,tollGuruRequired:false});
    expect(routingPolicyFor('CAR_WITH_TRAILER')).toMatchObject({routingProfile:'EXTENDED_VEHICLE',extendedRouting:true,requiresVehicleConfirmation:false});
  });

  it('does not treat unknown as zero, safe, or accepted',()=>{
    expect(routingPolicyFor('UNKNOWN')).toMatchObject({routingProfile:'CONFIRMATION_REQUIRED',requiresVehicleConfirmation:true,safetyState:'CONFIRMATION_REQUIRED',routeSourceOrder:[]});
  });

  it('removes HERE and TollGuru from the required registry path',()=>{
    const entries=premiumNetworkSeed.filter((entry)=>entry.canonicalId.startsWith('premium.car-mover.')||entry.canonicalId.startsWith('premium.adapters.'));
    const providers=entries.flatMap((entry)=>[...entry.allowedProviders,...entry.fallbackProviders]);
    expect(providers).not.toContain('here');
    expect(providers).not.toContain('tollguru');
    expect(entries.find((entry)=>entry.canonicalId==='premium.adapters.toll')).toMatchObject({allowedProviders:['agm-toll-library']});
  });
});
