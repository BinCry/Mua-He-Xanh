const axios = require('axios');

async function testOsrm() {
    // Coordinates for Bát Bửu Phật Đài -> Xưởng Nhang -> Chùa Pháp Tạng
    const coords = [
        [10.762622, 106.529845],
        [10.758311, 106.535921],
        [10.752102, 106.541203]
    ];

    const waypoints = coords.map(c => `${c[1]},${c[0]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;

    console.log("Fetching OSRM route from:", url);
    try {
        const res = await axios.get(url);
        if (res.data.code === 'Ok') {
            console.log("✅ OSRM Route Fetched Successfully!");
            console.log("   Total Distance:", (res.data.routes[0].distance / 1000).toFixed(2), "km");
            console.log("   Total Duration:", (res.data.routes[0].duration / 60).toFixed(1), "minutes");
            console.log("   Number of road geometry points:", res.data.routes[0].geometry.coordinates.length);
        } else {
            console.log("OSRM Error response:", res.data);
        }
    } catch(e) {
        console.error("OSRM Fetch Error:", e.message);
    }
    process.exit(0);
}

testOsrm();
