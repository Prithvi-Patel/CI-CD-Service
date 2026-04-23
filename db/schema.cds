namespace VOM;

aspect userInfo {
    createdBy : String;
}


entity States : userInfo{
    key stateCode : String;
        stateName : String;
        tax       : Decimal(10, 2);

        vehicle   : Association to many Vehicles on vehicle.state = $self;
        dealer    : Association to many Dealers on dealer.state = $self;
}

entity Dealers : userInfo {
    key dealerId   : String;
        dealerName : String;
        email      : String;
        phone      : String;

        state      : Association to one States;
}

entity Customers : userInfo {
    key customerId   : String;
        customerName : String;
        email        : String;
        phone        : String;

        state        : Association to one States;
}

entity Vehicles : userInfo {

    key vehicleId : String @readonly;
        modelName : String @mandatory not null;
        basePrice : Decimal(10, 2) @mandatory  not null  @assert.range: [1, 99999999];
        newPrice  : Decimal(10, 2) @readonly;
        oldPrice  : Decimal(10, 2) @readonly;
        stock     : Integer @assert.range: [ 0, 99999999];

        state     : Association to one States @assert.target;
        dealer    : Association to one Dealers;
}

entity Orders : userInfo {
    key orderId   : String;
        orderDate : Date;
        quantity  : Integer;
        status    : String;

        customer  : Association to one Customers;
        vehicle   : Association to one Vehicles;
        items     : Composition of many OrderItems on items.order = $self;
}

entity OrderItems : userInfo {
    key itemId   : String;
        quantity : Integer;

        order    : Association to one Orders;
        vehicle  : Association to one Vehicles;
}
