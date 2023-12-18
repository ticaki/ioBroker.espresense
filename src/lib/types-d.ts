export type room = {
    status: string;
    max_distance: number;
    absorption: number;
    tx_ref_rssi: number;
    rx_adj_rssi: number;
    include: string;
    count_ids: string;
    arduino_ota: boolean;
    auto_update: boolean;
    prerelease: boolean;
    motion: boolean;
    switch: boolean;
    button: boolean;
    pir_timeout: number;
    radar_timeout: number;
    switch_1_timeout: number;
    switch_2_timeout: number;
    button_1_timeout: number;
    button_2_timeout: number;
    known_irks: string;
    led_1: {
        state: boolean;
    };
    telemetry: {
        ip: string;
        uptime: number;
        firm: string;
        rssi: number;
        ver: string;
        count: number;
        adverts: number;
        seen: number;
        reported: number;
        freeHeap: number;
        maxHeap: number;
        scanStack: number;
        loopStack: number;
        bleStack: number;
    };
};

export type device = {
    mac: string;
    id: string;
    disc: string;
    idType: number;
    'rssi@1m': number;
    rssi: number;
    raw: number;
    distance: number;
    int: number;
};

export type settings = {
    id: string;
    name: string;
};
