// using { Dealers as db } from '../db/schema';

using { VOM as db } from '../db/schema';


// @(impl: './Demo.js')
service MyService {
   
    @cds.redirection.target 
    entity States as projection on db.States;  
    @cds.redirection.target 
    entity Vehicles as projection on db.Vehicles;
    entity Dealers as projection on db.Dealers;
    entity Customers as projection on db.Customers;
    entity Orders as projection on db.Orders;
    entity OrderItems as projection on db.OrderItems;

    
    
    entity StateIDs as projection on States {stateCode};     
    entity VehicleIDs as projection on db.Vehicles {vehicleId};


    entity VehicleCountByState as
    select from Vehicles
    {
        key state.stateCode as stateCode,
            cast(count(*) as Integer) as vehicleCount
    }
    group by state.stateCode;

    // action testRedis returns String;

    // function getVehicleIDs() returns array of String;
    // function getStateIDs() returns array of String;
   
    // entity Dealers as projection on db;
}
