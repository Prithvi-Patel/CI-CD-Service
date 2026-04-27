import cds from '@sap/cds';
import { getRedis } from './utils/redis.js';

export default cds.service.impl(async function () {

    const { Vehicles, States, Orders, OrderItems} = this.entities;
    // console.log(this.entities);

    
    //Based on states, Vehicle id Will get genetated.
    this.before('CREATE', 'Vehicles', async (req) => {
        const { state } = req.data;
        if (!state || !state.stateCode) {
            return req.error(400, "State is required to create Vehicle");
        }
        const stateData = await SELECT.one.from(States).where({ stateCode: state.stateCode });
        if (!stateData) {
            return req.error(400, "Invalid State");
        }
        const stateCode = stateData.stateCode;

        const vehicles = await SELECT.from(Vehicles).where({ state_stateCode: state.stateCode });
        let max = 0;
        for (const v of vehicles) {
            if (v.vehicleId) {
                const num = parseInt(v.vehicleId.split('-')[1]);
                if (num > max) max = num;
            }
        }
        const next = String(max + 1).padStart(4, '0');
        req.data.vehicleId = `${stateCode}-${next}`;
    });
   
    //Vehicle id will be Validated
    this.before('UPDATE', 'Vehicles', async (req) => {
        const vehicleId = req.data.vehicleId || req.params[0].vehicleId;
        if (!vehicleId) {
            return req.error(400, "Vehicle ID is required");
        }

        const prefix = vehicleId.split('-')[0];
        const state = await SELECT.one.from(States).where({ stateCode: prefix });
        if (!state) {
        return req.error(400, "Vehicle ID must start with valid State Code");
        }
    });

    //Vehicle price update logic
    this.before('UPDATE', 'Vehicles', async (req) => {
        const vehicleId = req.params[0].vehicleId;
        const { newPrice } = req.data;
        if (newPrice !== undefined && newPrice < 0) {
            return req.error(400, "Vehicle price cannot be negative");
        }
        const vehicle = await SELECT.one.from(Vehicles).where({ vehicleId });
        if (!vehicle) {
            return req.error(404, "Vehicle not found");
        }
        if (newPrice !== undefined) {
            req.data.oldPrice = vehicle.newPrice;
        }
    });

    //Get vehicleID's
    this.on('getVehicleIDs', async () => {
        const data = await SELECT.from(Vehicles).columns('vehicleId');
        return data.map(v => v.vehicleId);
    });

     //Get StateID's
    this.on('getStateIDs', async () => {
        const data = await SELECT.from(States).columns('stateCode');
        return data;
    });

    // order validation
    this.before('CREATE', 'Orders', async (req) => {
        const { quantity, customer, vehicle } = req.data;
        if (!customer || !customer.customerId) {
            return req.error(400, "Customer is required");
        }
        if (!vehicle || !vehicle.vehicleId) {
            return req.error(400, "Vehicle is required");
        }
        if (!quantity || quantity <= 0) {
            return req.error(400, "Quantity must be greater than 0");
        }

        const vehicleData = await SELECT.one.from(Vehicles).where({ vehicleId: vehicle.vehicleId });
        if (!vehicleData) {
            return req.error(404, "Vehicle not found");
        }
        if (vehicleData.stock < quantity) {
            return req.error(400, "Insufficient stock");
        }
    });

    //Deep insert (order + items)
    this.on('CREATE', 'Orders', async (req) => {
        const tx = cds.transaction(req);
        const data = req.data;
        try {
            // Insert Order
            await tx.run(INSERT.into(Orders).entries(data));

            // Handle Order Items (Composition)
            if (data.items && data.items.length > 0) {
                for (let item of data.items) {
                    await tx.run(INSERT.into(OrderItems).entries({...item,order_orderId: data.orderId}));
                    // Reduce stock
                    await tx.run(
                        UPDATE(Vehicles).set({ stock: { '-=': item.quantity } }).where({ vehicleId: item.vehicle_vehicleId })
                    );
                }
            }
            return data;
        } catch (error) {
            console.error(error);
            req.error(500, "Error creating Order");
        }
    });


    
    //Vehicle crud override
    this.on('READ', 'Vehicles', async (req, next) => {
    console.log('----------Instance-----------:', process.env.CF_INSTANCE_INDEX);
    const redis = await getRedis();
    const cacheKey = 'vehicles_all';

    //Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
        console.log('--------------From Redis Cache-------------------');
        return JSON.parse(cached);
    }
    //DB call
    const data = await next();
    //Store in Redis
    await redis.set(cacheKey, JSON.stringify(data), {
        EX: 60000
    });
    console.log('-------------------Stored in Redis-------------------');
    return data;
    });

    this.on('CREATE', 'Vehicles', async (req) => {
        await INSERT.into(Vehicles).entries(req.data);
        return { vehicleId: req.data.vehicleId, message: "Vehicle Created successfully" };
    });

    this.on('UPDATE', 'Vehicles', async (req) => {
        const vehicleId = req.params[0].vehicleId;
        
        const exists = await SELECT.one.from(Vehicles).where({ vehicleId });
        if (!exists) return req.error(404, "Vehicle not found");

        await UPDATE(Vehicles).set(req.data).where({ vehicleId });
        return { vehicleId };
    });

    this.on('DELETE', 'Vehicles', async (req) => {
        const vehicleId = req.params[0].vehicleId;

        const exists = await SELECT.one.from(Vehicles).where({ vehicleId });
        if (!exists) return req.error(404, "Vehicle not found");

        await DELETE.from(Vehicles).where({ vehicleId });
        return { message: "Vehicle deleted successfully" };
    });



    //Whenever data changes → clear cache
    this.after(['CREATE', 'UPDATE', 'DELETE'], 'Vehicles', async () => {

    const redis = await getRedis();
    await redis.del('vehicles_all');
    console.log('-------------Cache cleared');
    });


    //Global validation
    this.before(['CREATE', 'UPDATE'], '*', (req) => {
        for (let field in req.data) {
            if (req.data[field] === null || req.data[field] === '') {
                return req.error(400, `${field} cannot be empty`);
            }
        }
    });

});