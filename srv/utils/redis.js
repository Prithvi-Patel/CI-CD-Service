import { createClient } from 'redis';

let client;

export async function getRedis() {
    if (client) return client;

    let redisUrl;

    // Get from BTP (VCAP_SERVICES)
    if (process.env.VCAP_SERVICES) {
        const vcap = JSON.parse(process.env.VCAP_SERVICES);

        if (vcap['redis-cache']) {
            redisUrl = vcap['redis-cache'][0].credentials.uri;
        }
    }

    // Local fallback
    if (!redisUrl) {
        redisUrl = process.env.REDIS_URL;
    }

    client = createClient({
        url: redisUrl,
        socket: {
            tls: true,
            rejectUnauthorized: false
        }
    });

    client.on('error', (err) => {
        console.error('Redis Error:', err);
    });

    await client.connect();
    console.log('--------Redis Connected---------------');

    return client;
}